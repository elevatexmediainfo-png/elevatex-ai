import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, maskSecret } from "./encryption";

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a plaintext value", () => {
    const plaintext = "sk-live-abc123XYZ";
    const encrypted = encryptSecret(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV) but both decrypt correctly", () => {
    const plaintext = "same-secret-value";
    const a = encryptSecret(plaintext);
    const b = encryptSecret(plaintext);
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(plaintext);
    expect(decryptSecret(b)).toBe(plaintext);
  });

  it("stores the iv/authTag/ciphertext as a single colon-separated hex string", () => {
    const encrypted = encryptSecret("hello");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      expect(part).toMatch(/^[0-9a-f]+$/);
    }
  });

  it("throws on a malformed payload", () => {
    expect(() => decryptSecret("not-a-valid-payload")).toThrow();
    expect(() => decryptSecret("onlyone:partial")).toThrow();
  });

  it("throws when the ciphertext has been tampered with (GCM auth failure)", () => {
    const encrypted = encryptSecret("tamper-test");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tamperedByte = ciphertext.slice(0, -2) + (ciphertext.slice(-2) === "00" ? "01" : "00");
    expect(() => decryptSecret(`${iv}:${authTag}:${tamperedByte}`)).toThrow();
  });
});

describe("maskSecret", () => {
  it("keeps only the last 4 characters visible", () => {
    const plaintext = "sk-live-abc123XYZ";
    const masked = maskSecret(plaintext);
    expect(masked.endsWith("3XYZ")).toBe(true);
    expect(masked).toBe("•".repeat(plaintext.length - 4) + "3XYZ");
  });

  it("masks the full value for strings of 4 characters or fewer", () => {
    expect(maskSecret("abcd")).toBe("••••");
    expect(maskSecret("ab")).toBe("••••");
    expect(maskSecret("")).toBe("••••");
  });

  it("never returns the original plaintext as a substring of unmasked characters beyond the last 4", () => {
    const plaintext = "supersecretvalue1234";
    const masked = maskSecret(plaintext);
    expect(masked.endsWith("1234")).toBe(true);
    expect(masked).not.toContain("supersecret");
  });
});
