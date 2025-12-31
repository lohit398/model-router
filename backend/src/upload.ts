// src/upload.ts
import express from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

router.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const id = randomUUID();
    const ext = req.file.originalname.split('.').pop();
    const storagePath = `raw/${id}.${ext}`;

    const { error: storageErr } = await supabase.storage
      .from('airr-raw-files')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (storageErr) throw storageErr;

    const { data: fileRow, error: fileErr } = await supabase
      .from('uploaded_files')
      .insert({
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        storage_path: storagePath,
        status: 'uploaded',
      })
      .select()
      .single();

    if (fileErr) throw fileErr;

    const { data: transcriptRow, error: trErr } = await supabase
      .from('transcripts')
      .insert({
        file_id: fileRow.id,
        status: 'processing',
      })
      .select()
      .single();

    if (trErr) throw trErr;

    // Notify n8n
    if (process.env.N8N_FILE_WEBHOOK_URL) {
      await fetch(process.env.N8N_FILE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: fileRow.id,
          transcriptId: transcriptRow.id,
        }),
      });
    }

    res.json({ file: fileRow, transcript: transcriptRow });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
