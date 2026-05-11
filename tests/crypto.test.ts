import { describe, it, expect } from "vitest";

// Set encryption key for tests
process.env.ENCRYPTION_KEY = "0000000000000000000000000000000000000000000000000000000000000000";

import { encrypt, decrypt } from "../app/services/crypto.server";

describe("encrypt/decrypt", () => {
  it("round-trips a string", () => {
    const original = "super-secret-token-123";
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  it("produces different ciphertext each call", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toBe(b);
  });
});
