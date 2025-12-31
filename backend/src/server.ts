// src/server.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { routeTask } from './router';
import uploadRouter from './upload';

const app = express();
app.use(cors());
app.use(express.json());
app.use(uploadRouter);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

app.post('/api/tasks', async (req, res) => {
  try {
    const { taskType, sla, inputText, maxCostCents, transcriptId } = req.body;

    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .insert({
        task_type: taskType,
        sla,
        input_text: inputText,
        max_cost_cents: maxCostCents,
        transcript_id: transcriptId ?? null,
      })
      .select()
      .single();

    if (taskErr) throw taskErr;

    const routing = routeTask({ taskType, sla, maxCostCents });

    const { data: decision, error: decErr } = await supabase
      .from('routing_decisions')
      .insert({
        task_id: task.id,
        chosen_model: routing.model,
        reason: routing.reason,
        estimated_cost_cents: routing.estimatedCostCents,
        estimated_latency_ms: routing.estimatedLatencyMs,
      })
      .select()
      .single();

    if (decErr) throw decErr;

    const latency = routing.estimatedLatencyMs + Math.round(Math.random() * 200);
    const cost = routing.estimatedCostCents;

   const { error: runErr, data: runData } = await supabase
  .from('model_runs')
  .insert({
    task_id: task.id,
    model: routing.model,        // must match enum model_name
    token_input: 500,
    token_output: 200,
    latency_ms: latency,
    cost_cents: cost,
    success: true,
  })
  .select()
  .single();

if (runErr) {
  console.error('model_runs insert error:', runErr);
  // optional: surface it to caller
  // throw runErr;
}

    await supabase
      .from('tasks')
      .update({ status: 'completed' })
      .eq('id', task.id);

    res.json({ task, decision, routing });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// simple list endpoints for UI
app.get('/api/routing-decisions', async (_req, res) => {
  const { data, error } = await supabase
    .from('routing_decisions')
    .select('*, tasks(*)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/transcribe-and-route', async (req, res) => {
  try {
    const { fileId, transcriptId } = req.body;

    if (!fileId || !transcriptId) {
      return res.status(400).json({ error: 'fileId and transcriptId are required' });
    }

    // 1) Get uploaded file row
    const { data: fileRow, error: fileErr } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileErr || !fileRow) {
      throw new Error(`File not found: ${fileErr?.message ?? 'no row'}`);
    }

    // 2) Download file from Supabase Storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from('airr-raw-files')              // your bucket name
      .download(fileRow.storage_path);     // e.g. raw/<uuid>.ext

    if (downloadErr || !fileData) {
      throw new Error(`Download failed: ${downloadErr?.message ?? 'no data'}`);
    }

    // 3) Convert file to text (mock / simple)
    // If your files are text-based, this works. For audio we’d send to STT API instead.
    let transcriptText: string;

    if (typeof (fileData as any).text === 'function') {
      // In modern Node, fileData is a Blob with text()
      transcriptText = await (fileData as any).text();
    } else {
      // Fallback: assume Buffer-like
      // @ts-ignore
      const buffer = Buffer.from(await fileData.arrayBuffer());
      transcriptText = buffer.toString('utf8');
    }

    // If the file isn't really text (e.g. audio), you can mock:
    if (!transcriptText || transcriptText.trim().length === 0) {
      transcriptText = `Mock transcript for ${fileRow.file_name} stored at ${fileRow.storage_path}.
This simulates a real transcript generated from the uploaded file.`;
    }

    // 4) Update transcripts table
    const { error: trErr } = await supabase
      .from('transcripts')
      .update({
        text: transcriptText,
        language: 'en',
        duration_seconds: 3600,
        status: 'ready',
      })
      .eq('id', transcriptId);

    if (trErr) {
      throw new Error(`Transcript update failed: ${trErr.message}`);
    }

    // 5) Create task + routing + model_run (similar to /api/tasks)
    const taskType = 'summary';
    const sla = 'high_quality';
    const maxCostCents = 100;

    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .insert({
        task_type: taskType,
        sla,
        input_text: transcriptText,
        max_cost_cents: maxCostCents,
        transcript_id: transcriptId,
      })
      .select()
      .single();

    if (taskErr || !task) {
      throw new Error(`Task insert failed: ${taskErr?.message ?? 'no row'}`);
    }

    const routing = routeTask({ taskType, sla, maxCostCents });

    const { data: decision, error: decErr } = await supabase
      .from('routing_decisions')
      .insert({
        task_id: task.id,
        chosen_model: routing.model,
        reason: routing.reason,
        estimated_cost_cents: routing.estimatedCostCents,
        estimated_latency_ms: routing.estimatedLatencyMs,
      })
      .select()
      .single();

    if (decErr) {
      throw new Error(`Routing decision insert failed: ${decErr.message}`);
    }

    const latency = routing.estimatedLatencyMs + Math.round(Math.random() * 200);
    const cost = routing.estimatedCostCents;

    const { error: runErr } = await supabase.from('model_runs').insert({
      task_id: task.id,
      model: routing.model,
      token_input: 500,
      token_output: 200,
      latency_ms: latency,
      cost_cents: cost,
      success: true,
    });

    if (runErr) {
      throw new Error(`Model run insert failed: ${runErr.message}`);
    }

    // 6) Mark file as processed (optional)
    await supabase
      .from('uploaded_files')
      .update({ status: 'ready' })
      .eq('id', fileId);

    return res.json({
      status: 'ok',
      task,
      decision,
    });
  } catch (e: any) {
    console.error('transcribe-and-route error:', e);
    return res.status(500).json({ error: e.message ?? 'Unknown error' });
  }
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend on ${PORT}`));
