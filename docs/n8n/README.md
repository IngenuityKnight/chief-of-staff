# n8n Intake Workflow

Available workflow artifacts:
- [chief-of-staff-intake.workflow.json](/Users/cameronburden/chief-of-staff/docs/n8n/chief-of-staff-intake.workflow.json): minimal intake receiver that returns `200`
- [chief-of-staff-intake-enrich.workflow.json](/Users/cameronburden/chief-of-staff/docs/n8n/chief-of-staff-intake-enrich.workflow.json): intake receiver that enriches the payload and updates the matching `inbox_items` row in Supabase

Import [chief-of-staff-intake.workflow.json](/Users/cameronburden/chief-of-staff/docs/n8n/chief-of-staff-intake.workflow.json) into n8n as a starting point for the Vercel intake handoff.

What it does:
- Accepts `POST` requests on the same webhook path currently configured in Vercel: `8ec029ae-1ed4-42e4-b6ea-b106612d1e9b`
- Normalizes the payload coming from `/api/intake`
- Returns a `200` JSON response via `Respond to Webhook`

Expected request shape from the app:

```json
{
  "id": "inb_...",
  "capturedAt": "2026-04-19T06:04:06.966Z",
  "text": "example capture",
  "analysis": "Captured. Primary domain: ...",
  "routing": {
    "primary": "chief",
    "secondary": [],
    "category": "Admin"
  },
  "urgency": "medium",
  "proposedTasks": [
    "Ask one clarifying question",
    "Hold briefly pending input"
  ]
}
```

How to use it:
1. In n8n, import the JSON file.
2. Save the workflow.
3. Activate the workflow.
4. Keep the webhook path as-is if you want to preserve the current Vercel env.
5. Send a test POST from the live app.

Expected response:

```json
{
  "ok": true,
  "eventType": "chief_of_staff.intake.received",
  "id": "inb_...",
  "capturedAt": "...",
  "text": "...",
  "analysis": "...",
  "routing": {
    "primary": "chief",
    "secondary": [],
    "category": "Admin"
  },
  "urgency": "medium",
  "proposedTasks": [],
  "needsEscalation": false,
  "receivedAt": "...",
  "source": "vercel-app"
}
```

Next extensions after import:
- Add an OpenAI node after `Normalize Intake` to rewrite or enrich the analysis.
- Add Supabase nodes or HTTP requests to update the `inbox_items` row after automation runs.
- Add `If` branching on `needsEscalation` to notify Slack/SMS/email for high urgency items.

## Enrich + Supabase update workflow

Use [chief-of-staff-intake-enrich.workflow.json](/Users/cameronburden/chief-of-staff/docs/n8n/chief-of-staff-intake-enrich.workflow.json) when you want n8n to perform actual post-ingest work.

What it does:
- receives the same webhook payload from the app
- normalizes and enriches the intake in a `Code` node
- updates the existing `inbox_items` row in Supabase over the REST API
- flags high/critical urgency items as escalation candidates
- returns a `200` JSON response so the app reports `forwarded: true`

Required n8n environment variables:

```bash
SUPABASE_URL=https://ufhaiecfyndrxkvfabno.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Expected response shape from the enrich workflow:

```json
{
  "ok": true,
  "eventType": "chief_of_staff.intake.processed",
  "id": "inb_...",
  "inboxStatus": "processed",
  "escalation": false,
  "alertSummary": "",
  "supabaseUpdated": true,
  "routing": {
    "primary": "chief",
    "secondary": [],
    "category": "Admin"
  },
  "urgency": "medium",
  "proposedTasks": [],
  "processedAt": "..."
}
```

Practical next upgrade:
- replace the `Enrich Intake` code node with an OpenAI node or AI Agent node
- add a Slack or email webhook after `Needs Escalation?`
- add approval-task creation in Supabase instead of only updating the inbox row
