import { describe, expect, it } from "vitest";
import { describeFlaskNetworkFailure, extractNetworkErrorCode } from "@/lib/flask/server-fetch";

describe("extractNetworkErrorCode", () => {
  it("reads code from Error with cause", () => {
    const err = new Error("fetch failed");
    (err as Error & { cause?: { code?: string } }).cause = { code: "ECONNREFUSED" };
    expect(extractNetworkErrorCode(err)).toBe("ECONNREFUSED");
  });

  it("maps AbortError to ETIMEDOUT", () => {
    const err = new Error("Aborted");
    err.name = "AbortError";
    expect(extractNetworkErrorCode(err)).toBe("ETIMEDOUT");
  });
});

describe("describeFlaskNetworkFailure", () => {
  const url = "http://127.0.0.1:8765/api/internal/v2/pipeline";

  it("classifies connection refused", () => {
    const msg = describeFlaskNetworkFailure(url, "ECONNREFUSED", "fetch failed");
    expect(msg).toContain("127.0.0.1:8765");
    expect(msg).toContain("Connection refused");
    expect(msg).not.toBe("fetch failed");
  });

  it("classifies EAI_AGAIN", () => {
    const msg = describeFlaskNetworkFailure(url, "EAI_AGAIN", "getaddrinfo EAI_AGAIN");
    expect(msg).toContain("Temporary DNS");
  });

  it("classifies ENETUNREACH", () => {
    const msg = describeFlaskNetworkFailure(url, "ENETUNREACH", "connect ENETUNREACH");
    expect(msg).toContain("No route to host");
  });

  it("includes host and code when message is only fetch failed", () => {
    const msg = describeFlaskNetworkFailure(url, undefined, "fetch failed");
    expect(msg).toContain("127.0.0.1:8765");
    expect(msg).toContain("fetch failed");
    expect(msg).toContain("no code");
  });
});
