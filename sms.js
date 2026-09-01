const fetch = require("node-fetch");

// Sends a real SMS via Arkesel. Swap this out for mNotify/Hubtel by changing the
// URL and payload shape if you'd rather use a different provider.
async function sendSms(toPhone, message) {
  if (!process.env.ARKESEL_API_KEY) {
    console.log(`[SMS not configured] Would send to ${toPhone}: ${message}`);
    return { ok: false, reason: "ARKESEL_API_KEY missing" };
  }
  // Arkesel expects Ghanaian numbers like 233XXXXXXXXX (no leading 0, no +).
  const formatted = toPhone.replace(/^0/, "233").replace(/\D/g, "");
  const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
    method: "POST",
    headers: {
      "api-key": process.env.ARKESEL_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sender: process.env.ARKESEL_SENDER_ID || "DataLane",
      message,
      recipients: [formatted]
    })
  });
  const data = await res.json();
  return { ok: res.ok, raw: data };
}

module.exports = { sendSms };
