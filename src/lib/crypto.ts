import crypto from "crypto";

function key() {
  const secret = process.env.CREDENTIALS_KEY;
  if (!secret || secret.length < 16) {
    throw new Error("CREDENTIALS_KEY must be set to at least 16 characters");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptPem(pem: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(pem, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptPem(payload: string) {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function normalizePem(pem: string) {
  return pem.replace(/\\n/g, "\n").trim();
}

export function describeKey(pem: string) {
  const normalized = normalizePem(pem);
  const keyObj = crypto.createPrivateKey(normalized);
  return { pem: normalized, type: keyObj.asymmetricKeyType || "unknown" };
}
