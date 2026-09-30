const fetch = require("node-fetch");
const crypto = require("crypto");

const BASE_URL = process.env.BIGNASH_BASE_URL || "https://api.bignashdatahub.com/api/v1";

// Maps DataLane's network names to BigNash's carrier codes.
// Their docs example only confirmed "MTN" — TELECEL and AT are our best-guess
// mapping based on their naming convention. If a purchase comes back with a
// "carrier" validation error, check BigNash's dashboard / offers list for the
// exact strings they expect and adjust this map.
const CARRIER_MAP = {
  MTN: "MTN",
  Telecel: "TELECEL",
  AirtelTigo: "AT"
};

// Pulls the numeric GB size out of a label like "5GB" -> "5" (BigNash wants
// capacity as a plain string in GB, e.g. "1", "2", "10").
function parseCapacityGB(bundleLabel) {
  const match = String(bundleLabel).match(/(\d+(\.\d+)?)/);
  return match ? match[1] : String(bundleLabel);
}

// Places a real data bundle order with BigNash so it actually lands on the
// customer's phone. Call this AFTER Paystack payment is verified.
async function purchaseBundle({ recipientPhone, network, bundleLabel, reference }) {
  if (!process.env.BIGNASH_API_KEY) {
    return { ok: false, error: "BIGNASH_API_KEY not configured" };
  }
  const carrier = CARRIER_MAP[network];
  if (!carrier) {
    return { ok: false, error: `No BigNash carrier mapping for network "${network}"` };
  }

  const idempotencyKey = crypto.randomUUID();
  try {
    const res = await fetch(`${BASE_URL}/purchases`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.BIGNASH_API_KEY}`,
        "Idempotency-Key": idempotencyKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        recipient_number: recipientPhone,
        carrier,
        capacity: parseCapacityGB(bundleLabel),
        reference
      })
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      return { ok: false, error: data.message || data.error || `BigNash returned ${res.status}`, raw: data };
    }
    return { ok: true, carrier, raw: data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Verifies an incoming webhook really came from BigNash, using the raw
// (unparsed) request body and the X-Webhook-Signature header, before you
// trust anything in it. Uses HMAC-SHA256 with your webhook secret — the
// standard scheme; confirm against BigNash's docs if verification fails.
function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!process.env.BIGNASH_WEBHOOK_SECRET || !signatureHeader) return false;
  const expected = crypto
    .createHmac("sha256", process.env.BIGNASH_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false; // lengths differ, etc. — treat as invalid
  }
}

module.exports = { purchaseBundle, verifyWebhookSignature, parseCapacityGB, CARRIER_MAP };
