// Shared cron/webhook bearer auth (audit B1). Fail closed: a missing
// CRON_SECRET only passes in development — a production deployment without
// the secret gets 401s on every cron route instead of a public job surface.

export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
