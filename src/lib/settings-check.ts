import { describeKey, encryptPem, normalizePem } from "./crypto";
import { query } from "./db";
import { dollarsFromBalance, kalshiRequest } from "./kalshi";
import { provePaperFailures } from "./paper";

export type Checklist = {
  pem: boolean;
  balanceOk: boolean;
  positionsOk: boolean;
  probeOk: boolean;
  balance: number | null;
  message: string;
};

export async function testLiveKey(userId: string, keyId: string, pemInput: string) {
  const checklist: Checklist = {
    pem: false,
    balanceOk: false,
    positionsOk: false,
    probeOk: false,
    balance: null,
    message: "",
  };
  let pem = "";
  try {
    const described = describeKey(pemInput);
    pem = described.pem;
    checklist.pem = described.type === "ed25519" || described.type === "rsa";
    if (!checklist.pem) checklist.message = "The private key did not parse. Paste the PEM Kalshi showed you once.";
  } catch {
    checklist.message = "The private key did not parse. Paste the PEM Kalshi showed you once.";
  }

  if (checklist.pem) {
    try {
      const balance = await kalshiRequest(keyId, pem, "GET", "/trade-api/v2/portfolio/balance");
      checklist.balance = dollarsFromBalance(balance.json);
      checklist.balanceOk = balance.status === 200 && checklist.balance !== null && !Number.isNaN(checklist.balance);
      if (!checklist.balanceOk) {
        checklist.message = balance.status === 401
          ? "Kalshi rejected this key. Check the key id and the PEM from kalshi.com."
          : `Balance call failed (${balance.status}).`;
      }
    } catch (error) {
      checklist.message = error instanceof Error ? error.message : "Balance call failed.";
    }
  }

  if (checklist.balanceOk) {
    try {
      const positions = await kalshiRequest(keyId, pem, "GET", "/trade-api/v2/portfolio/positions");
      checklist.positionsOk = positions.status === 200;
      if (!checklist.positionsOk) checklist.message = `Positions call failed (${positions.status}).`;
    } catch (error) {
      checklist.message = error instanceof Error ? error.message : "Positions call failed.";
    }
  }

  if (checklist.positionsOk) {
    try {
      checklist.message = await provePaperFailures(userId);
      checklist.probeOk = checklist.message === "";
    } catch (error) {
      checklist.message = error instanceof Error ? error.message : "Paper failure check failed.";
    }
  }

  if (checklist.probeOk) checklist.message = `Production key reads. Balance $${checklist.balance?.toFixed(2)}. Paper will simulate orders, including dropped calls.`;

  const encrypted = checklist.pem ? encryptPem(normalizePem(pemInput)) : null;
  if (encrypted) {
    await query(
      `insert into kalshi_credentials (user_id, environment, api_key_id, private_key_encrypted, last_balance, last_error, checklist)
       values ($1, 'live', $2, $3, $4, $5, $6::jsonb)
       on conflict (user_id, environment)
       do update set api_key_id = $2, private_key_encrypted = $3, last_balance = $4, last_error = $5, checklist = $6::jsonb, updated_at = now()`,
      [userId, keyId.trim(), encrypted, checklist.balance, checklist.probeOk ? null : checklist.message, JSON.stringify(checklist)],
    );
  }
  return checklist;
}
