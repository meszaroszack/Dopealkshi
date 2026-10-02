import crypto from "crypto";

export const LIVE_BASE = "https://external-api.kalshi.com";

export function signRequest(pem: string, timestamp: string, method: string, signPath: string) {
  const key = crypto.createPrivateKey(pem);
  const message = Buffer.from(`${timestamp}${method}${signPath}`);
  if (key.asymmetricKeyType === "ed25519") {
    return crypto.sign(null, message, key).toString("base64");
  }
  return crypto.sign("sha256", message, {
    key,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  }).toString("base64");
}

export type KalshiResult = {
  status: number;
  json: Record<string, unknown> | null;
  text: string;
};

export async function kalshiRequest(
  keyId: string,
  pem: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<KalshiResult> {
  const timestamp = Date.now().toString();
  const signPath = path.split("?")[0];
  const signature = signRequest(pem, timestamp, method, signPath);
  const response = await fetch(`${LIVE_BASE}${path}`, {
    method,
    headers: {
      "KALSHI-ACCESS-KEY": keyId,
      "KALSHI-ACCESS-SIGNATURE": signature,
      "KALSHI-ACCESS-TIMESTAMP": timestamp,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  const text = await response.text();
  let json: Record<string, unknown> | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = null;
    }
  }
  return { status: response.status, json, text };
}

export async function publicGet(path: string) {
  const response = await fetch(`${LIVE_BASE}${path}`, {
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  const text = await response.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

export function dollarsFromBalance(json: Record<string, unknown> | null) {
  if (!json) return null;
  if (typeof json.balance_dollars === "string" || typeof json.balance_dollars === "number") {
    return Number(json.balance_dollars);
  }
  if (typeof json.balance === "number") return json.balance / 100;
  if (typeof json.balance === "string") return Number(json.balance) / 100;
  return null;
}

export function formatPrice(dollars: number) {
  return dollars.toFixed(4);
}

export function formatCount(contracts: number) {
  return contracts.toFixed(2);
}
