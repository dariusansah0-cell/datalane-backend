const fetch = require("node-fetch");

// Confirms a transaction actually succeeded, using the SECRET key server-side.
// This is the step that a browser can never safely do — never move this to the frontend.
async function verifyPaystackTransaction(reference) {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
  });
  const data = await res.json();
  if (!data.status || data.data.status !== "success") {
    return { ok: false, raw: data };
  }
  return { ok: true, amountPesewas: data.data.amount, currency: data.data.currency, raw: data.data };
}

module.exports = { verifyPaystackTransaction };
