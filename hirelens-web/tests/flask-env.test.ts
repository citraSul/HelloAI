import { describe, expect, it } from "vitest";
import { parseFlaskBaseUrl } from "@/lib/flask/url-validation";

describe("parseFlaskBaseUrl", () => {
  it("accepts origin with port (loopback)", () => {
    const r = parseFlaskBaseUrl("http://127.0.0.1:8765");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.baseUrl).toBe("http://127.0.0.1:8765");
      expect(r.info.host).toBe("127.0.0.1");
      expect(r.info.port).toBe("8765");
      expect(r.info.isLoopback).toBe(true);
    }
  });

  it("treats localhost as loopback", () => {
    const r = parseFlaskBaseUrl("http://localhost:8765/");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.info.isLoopback).toBe(true);
  });

  it("treats service hostname as non-loopback (Docker/K8s)", () => {
    const r = parseFlaskBaseUrl("http://hirelens-flask:8765");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.info.host).toBe("hirelens-flask");
      expect(r.info.isLoopback).toBe(false);
    }
  });

  it("rejects path segments", () => {
    expect(parseFlaskBaseUrl("http://127.0.0.1:8765/api").ok).toBe(false);
  });

  it("rejects query string", () => {
    expect(parseFlaskBaseUrl("http://127.0.0.1:8765/?x=1").ok).toBe(false);
  });

  it("rejects hash fragment", () => {
    expect(parseFlaskBaseUrl("http://127.0.0.1:8765#frag").ok).toBe(false);
  });

  it("rejects empty string", () => {
    const r = parseFlaskBaseUrl("   ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("empty");
  });

  it("rejects non-http(s) protocol", () => {
    const r = parseFlaskBaseUrl("ftp://127.0.0.1:8765");
    expect(r.ok).toBe(false);
  });
});
