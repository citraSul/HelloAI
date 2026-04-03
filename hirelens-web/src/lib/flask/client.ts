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
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey(),
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[HireLens] Flask pipeline network error", { url, error: err });
    throw new Error(`Flask pipeline unreachable: ${err}`);
  }

  let data: FlaskPipelineResponse;
  try {
    data = JSON.parse(await res.text()) as FlaskPipelineResponse;
  } catch {
    logFlaskFailure("pipeline", url, res.status, "non-JSON body", undefined);
    throw new Error(`Flask pipeline returned non-JSON (${res.status})`);
  }

  if (!res.ok || !data.ok) {
    logFlaskFailure("pipeline", url, res.status, data.message, data.ok);
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
  const url = `${base}/api/internal/evaluate-impact`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey(),
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[HireLens] Flask evaluate-impact network error", { url, error: err });
    throw new Error(`Flask impact unreachable: ${err}`);
  }

  let data: Record<string, unknown> & { ok?: boolean; message?: string };
  try {
    data = JSON.parse(await res.text()) as Record<string, unknown> & { ok?: boolean; message?: string };
  } catch {
    logFlaskFailure("evaluate-impact", url, res.status, "non-JSON body", undefined);
    throw new Error(`Flask impact returned non-JSON (${res.status})`);
  }

  if (!res.ok || !data.ok) {
    logFlaskFailure("evaluate-impact", url, res.status, String(data.message ?? ""), Boolean(data.ok));
    throw new Error(String(data.message || `Flask impact failed (${res.status})`));
  }
  const { ok, message, ...rest } = data;
  void ok;
  void message;
  return rest;
}
