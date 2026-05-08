import { describe, expect, it } from "vitest";
import { hashIdentityToken } from "@/lib/auth/identity-token";

describe("identity-token", () => {
  it("hashes tokens deterministically", () => {
    const raw = "test-token-value";
    expect(hashIdentityToken(raw)).toBe(hashIdentityToken(raw));
    expect(hashIdentityToken(raw)).not.toContain(raw);
  });
});
