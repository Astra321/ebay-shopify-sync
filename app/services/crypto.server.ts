import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

// Lazy key loading — only creates the Buffer when first accessed.
// In standalone/demo mode, encryption is never used, so ENCRYPTION_KEY is optional.
let _key: Buffer | null = null;

function getKey(): Buffer {
  if (!_key) {
    const envKey = process.env.ENCRYPTION_KEY;
    if (!envKey) {
      throw new Error(
        "ENCRYPTION_KEY environment variable is required for encryption operations. " +
        "Generate one with: openssl rand -hex 32"
      );
    }
    _key = Buffer.from(envKey, "hex");
  }
  return _key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
