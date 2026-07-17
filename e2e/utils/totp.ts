import { createHmac } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;

function decodeBase32(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/[\s=-]/g, "");
  if (!normalized || /[^A-Z2-7]/.test(normalized)) {
    throw new Error("E2E_ADMIN_TOTP_SECRET must be a valid base32 TOTP secret.");
  }

  let bitBuffer = 0;
  let bitCount = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
    bitBuffer = (bitBuffer << 5) | BASE32_ALPHABET.indexOf(character);
    bitCount += 5;

    while (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bitBuffer >>> bitCount) & 0xff);
      bitBuffer &= (1 << bitCount) - 1;
    }
  }

  return Buffer.from(bytes);
}

export function secondsUntilNextTotp(timestampMs = Date.now()): number {
  const elapsed = Math.floor(timestampMs / 1000) % TOTP_PERIOD_SECONDS;
  return TOTP_PERIOD_SECONDS - elapsed;
}

export function generateTotp(secret: string, timestampMs = Date.now()): string {
  const counter = BigInt(Math.floor(timestampMs / 1000 / TOTP_PERIOD_SECONDS));
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(counter);

  const digest = createHmac("sha1", decodeBase32(secret))
    .update(counterBytes)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, "0");
}
