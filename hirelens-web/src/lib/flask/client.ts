import { getFlaskBaseUrl, getFlaskFetchMaxRetries, getFlaskFetchTimeoutMs } from "@/lib/flask/env";
import { FlaskPipelineError } from "@/lib/flask/pipeline-error";
import { flaskFetchJson } from "@/lib/flask/server-fetch";

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

function logFlaskFailure(endpoint: string, url: string, status: number, message?: string, bodyOk?: boolean) {
  console.error("[HireLens] Flask pipeline failure", {
    endpoint,
    url,
    status,
    responseOk: bodyOk,
    message: message ?? null,
  });
}

export async function callFlaskPipeline(body: FlaskPipelineBody): Promise<FlaskPipelineResponse> {
  const base = getFlaskBaseUrl();
  const url = `${base}/api/internal/v2/pipeline`;
  const result = await flaskFetchJson<FlaskPipelineResponse>({
    operation: "POST /api/internal/v2/pipeline",
    url,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey(),
      },
      body: JSON.stringify(body),
    },
    timeoutMs: getFlaskFetchTimeoutMs(),
    maxRetries: getFlaskFetchMaxRetries(),
  });

  if (!result.ok) throw result.error;

  const data = result.data;
  if (!data.ok) {
    logFlaskFailure("pipeline", url, result.status, data.message, data.ok);
    throw new FlaskPipelineError(data.message || `Flask pipeline failed (${result.status})`, {
      kind: "upstream",
      operation: "POST /api/internal/v2/pipeline",
      url,
      httpStatus: result.status,
      attempts: 1,
    });
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
  const url = `${base}/api/internal/evaluate-impact`;
  const result = await flaskFetchJson<Record<string, unknown> & { ok?: boolean; message?: string }>({
    operation: "POST /api/internal/evaluate-impact",
    url,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey(),
      },
      body: JSON.stringify(body),
    },
    timeoutMs: getFlaskFetchTimeoutMs(),
    maxRetries: getFlaskFetchMaxRetries(),
  });

  if (!result.ok) throw result.error;

  const data = result.data;
  if (!data.ok) {
    logFlaskFailure("evaluate-impact", url, result.status, data.message, Boolean(data.ok));
    throw new FlaskPipelineError(String(data.message || `Flask impact failed (${result.status})`), {
      kind: "upstream",
      operation: "POST /api/internal/evaluate-impact",
      url,
      httpStatus: result.status,
      attempts: 1,
    });
  }
  const { ok: _ok, message: _msg, ...rest } = data;
  void _ok;
  void _msg;
  return rest;
}
