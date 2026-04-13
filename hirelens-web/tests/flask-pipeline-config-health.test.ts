import { afterEach, describe, expect, it, vi } from "vitest";
import { getFlaskPipelineConfigHealth } from "@/lib/flask/env";

describe("getFlaskPipelineConfigHealth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("has no syntax error when FLASK_BASE_URL unset", () => {
    vi.stubEnv("FLASK_BASE_URL", "");
    const h = getFlaskPipelineConfigHealth();
    expect(h.urlSyntaxError).toBeNull();
    expect(h.normalizedBaseUrl).toBeNull();
    expect(h.dockerLoopbackMisconfig).toBe(false);
  });

  it("detects Docker + loopback misconfiguration", () => {
    vi.stubEnv("FLASK_BASE_URL", "http://127.0.0.1:8765");
    vi.stubEnv("RUNNING_IN_DOCKER", "1");
    const h = getFlaskPipelineConfigHealth();
    expect(h.runningInDocker).toBe(true);
    expect(h.dockerLoopbackMisconfig).toBe(true);
    expect(h.pipelineConfigWarnings.some((w) => w.includes("hirelens-flask") || w.includes("service"))).toBe(
      true,
    );
  });

  it("does not flag loopback when not in Docker", () => {
    vi.stubEnv("FLASK_BASE_URL", "http://127.0.0.1:8765");
    vi.stubEnv("RUNNING_IN_DOCKER", "");
    const h = getFlaskPipelineConfigHealth();
    expect(h.runningInDocker).toBe(false);
    expect(h.dockerLoopbackMisconfig).toBe(false);
  });

  it("returns syntax error for invalid URL", () => {
    vi.stubEnv("FLASK_BASE_URL", "http://127.0.0.1:8765/v2");
    const h = getFlaskPipelineConfigHealth();
    expect(h.urlSyntaxError).toBeTruthy();
    expect(h.normalizedBaseUrl).toBeNull();
  });
});
