// Twilio SMS via the REST API — plain fetch + Basic auth, no SDK needed.
// Activates automatically when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and
// TWILIO_PHONE are set (in .env or the environment); otherwise isConfigured()
// is false and the auth flow stays in dev mode (code returned in the response).
const config = require('./config');
config.load();

function isConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID &&
            process.env.TWILIO_AUTH_TOKEN &&
            process.env.TWILIO_PHONE);
}

/// Normalizes Egyptian/local numbers to E.164 (+20XXXXXXXXXX).
function toE164(raw) {
  let digits = String(raw || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('0')) return `+20${digits.slice(1)}`; // local Egyptian
  if (digits.length === 10) return `+20${digits}`;            // w/o leading 0
  return `+${digits}`;
}

/// Sends an SMS. Returns true on success, false otherwise (never throws).
async function sendSms(to, body) {
  if (!isConfigured()) return false;
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const params = new URLSearchParams({ To: toE164(to), From: process.env.TWILIO_PHONE, Body: body });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!res.ok) {
      console.error('[twilio] send failed:', res.status, (await res.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[twilio] send error:', err.message);
    return false;
  }
}

module.exports = { isConfigured, sendSms, toE164 };
