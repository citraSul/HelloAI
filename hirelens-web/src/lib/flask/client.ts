import { getFlaskBaseUrl } from "@/lib/flask/env";

function apiKey(): string {
  const k = process.env.HIRELENS_INTERNAL_API_KEY?.trim();
  if (!k) throw new Error("HIRELENS_INTERNAL_API_KEY is not set");
  return k;
}

export type FlaskPipelineBody = {
  job_description: string;
  resume: string;
  include_tailoring?: boolean;
  include_impact?: boolean;
};

export type FlaskPipelineResponse = {
  ok: boolean;
  message?: string;
  brand?: string;
  job_data?: unknown;
  resume_data?: unknown;
  match_analysis?: {
    match_score: number;
    verdict: string;
    strengths?: unknown;
    gaps?: unknown;
    reasoning?: string;
  };
  match_components?: Record<string, number> | null;
  tailoring?: {
    tailored_resume: string;
    changes?: unknown[];
    warnings?: unknown[];
  };
  impact?: Record<string, unknown>;
  warnings?: string[];
};

export async function callFlaskPipeline(body: FlaskPipelineBody): Promise<FlaskPipelineResponse> {
  const base = getFlaskBaseUrl();
  const res = await fetch(`${base}/api/internal/v2/pipeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey(),
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as FlaskPipelineResponse;
  if (!res.ok || !data.ok) {
    throw new Error(data.message || `Flask pipeline failed (${res.status})`);
  }
  return data;
}

export type FlaskEvaluateImpactBody = {
  job_description: string;
  original_resume: string;
  tailored_resume: string;
  match_result?: { correlated_score?: number; match_level?: string };
};

export async function callFlaskEvaluateImpact(body: FlaskEvaluateImpactBody): Promise<Record<string, unknown>> {
  const base = getFlaskBaseUrl();
  const res = await fetch(`${base}/api/internal/evaluate-impact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey(),
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as Record<string, unknown> & { ok?: boolean; message?: string };
  if (!res.ok || !data.ok) {
    throw new Error(String(data.message || `Flask impact failed (${res.status})`));
  }
  const { ok, message, ...rest } = data;
  void ok;
  void message;
  return rest;
}
