import { getAppMode } from "@/lib/config/app-mode";

/** True when Next.js should call the Python Flask pipeline instead of mocks. */
export function isFlaskPipelineEnabled(): boolean {
  if (getAppMode() === "mock") return false;
  const url = process.env.FLASK_BASE_URL?.trim();
  const key = process.env.HIRELENS_INTERNAL_API_KEY?.trim();
  return Boolean(url && key);
}

export function getFlaskBaseUrl(): string {
  return (process.env.FLASK_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
}
