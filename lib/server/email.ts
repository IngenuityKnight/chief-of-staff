// Thin Resend HTTP wrapper. No SDK — fetch only, per the "no new heavyweight
// deps" constraint. Returns true on success.
//
// env: RESEND_API_KEY (required), RESEND_FROM (default: chief@chiefofstaff.app).

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const from = process.env.RESEND_FROM ?? "Chief of Staff <chief@chiefofstaff.app>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Resend send failed:", res.status, body);
    return false;
  }
  return true;
}
