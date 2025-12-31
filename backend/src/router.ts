// src/router.ts
export type TaskType = 'summary' | 'classification' | 'extraction';
export type SlaTier = 'low_latency' | 'low_cost' | 'high_quality';
export type ModelName = 'gpt_4_1' | 'gpt_4_1_mini' | 'rules_engine';

interface RouteInput {
  taskType: TaskType;
  sla: SlaTier;
  maxCostCents: number;
}

interface RouteOutput {
  model: ModelName;
  estimatedCostCents: number;
  estimatedLatencyMs: number;
  reason: string;
}

const MODEL_PROFILE: Record<ModelName, { costPerTask: number; latencyMs: number }> = {
  gpt_4_1: { costPerTask: 40, latencyMs: 1800 },
  gpt_4_1_mini: { costPerTask: 10, latencyMs: 600 },
  rules_engine: { costPerTask: 1, latencyMs: 100 },
};

export function routeTask(input: RouteInput): RouteOutput {
  const { taskType, sla, maxCostCents } = input;

  let candidate: ModelName;
  if (sla === 'high_quality') candidate = 'gpt_4_1';
  else if (sla === 'low_latency') candidate = 'gpt_4_1_mini';
  else candidate = 'rules_engine';

  let chosen = candidate;
  if (MODEL_PROFILE[chosen].costPerTask > maxCostCents) {
    if (chosen === 'gpt_4_1') chosen = 'gpt_4_1_mini';
    if (MODEL_PROFILE[chosen].costPerTask > maxCostCents) chosen = 'rules_engine';
  }

  const profile = MODEL_PROFILE[chosen];
  const reason = `Selected ${chosen} based on SLA=${sla}, taskType=${taskType}, maxCost=${maxCostCents}c`;

  return {
    model: chosen,
    estimatedCostCents: profile.costPerTask,
    estimatedLatencyMs: profile.latencyMs,
    reason,
  };
}
