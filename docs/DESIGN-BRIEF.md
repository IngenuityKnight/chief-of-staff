# Design Brief — Household OS Redesign (Pass 1)

## What this product is actually trying to be

Chief of Staff is not an app you check — it's a layer that runs underneath a home. The vision documents are unambiguous: the enemy is the *mental load*, the invisible 10–15 hours a week of "did I pay / when did I last / what's for dinner." The product's promise is the feeling shift from "something's slipping" to "it's handled" — delivered by specialist agents who coordinate like an executive office, propose rather than execute, and earn trust gradually (nothing auto-runs past $200 or a must-follow rule). The user's mental model is a *household with a heartbeat*: domains (meals, home, money, schedule, roster) each have their own rhythm, and a Chief of Staff synthesizes them into decisions waiting on a human. The emotional register is **calm authority** — proactive, never frantic, never an error console. The interface's single job is to answer, within two seconds, "is my house okay, and what's waiting on me?" — and then get out of the way.

## Why the old direction was rejected

The v0.1 design language — near-black "glass cockpit," radial blue gradients, Space Grotesk, signal-blue accents — is precisely the *generic dark dashboard* the redesign brief forbids. A cockpit is the wrong metaphor: pilots are operators under load; this product exists to *remove* load. A house at rest should not look like an aircraft at altitude.

## Conceptual anchor: **the Hearth**

The hearth is the oldest household status display in existence: glance at the fire and you know the state of the home. Warm and steady = all is well. Flaring = something needs tending. The redesign keeps the dark, ambient, wall-panel quality (this runs on a kitchen tablet) but trades the cockpit's cold blue-black for **charred oak and ember** — a dark interface that is *warm*, domestic, and alive.

## Token system

### Color — "Hearth" palette
| Token | Hex | Meaning |
|---|---|---|
| `ink-950` | `#14100B` | Charred oak — the room at night |
| `ink-900` | `#191410` | Primary surface |
| `ink-800` | `#241D16` | Raised surface |
| `edge` | `#2E261C` | Hairline borders — warm, not gray |
| `signal-green` | `#97B873` | Sage — "the house is well" |
| `signal-amber` | `#E8A857` | Ember — "needs tending," never an error |
| `signal-red` | `#E07856` | Clay — urgent, still warm, never alarm-red |
| `signal-blue` | `#7FA5D6` | Dusk — the Chief / capture (the one cool note, deliberately) |
| `signal-purple` | `#B59AC6` | Heather — Money |
| `signal-cyan` | `#7FBDB0` | Eucalyptus — Schedule |
| `signal-pink` | `#D98E9F` | Rose clay — Roster |

Text runs on a warmed neutral ramp (parchment `#EFE9DF` → umber `#857A67`) replacing Tailwind's cool `slate`, so every existing page warms up through the token layer.

### Typography
- **Display: Bricolage Grotesque** — a grotesque with visible hand and warmth; authority without coldness. Used for state lines, page titles, big numerics.
- **Body/UI: Instrument Sans** — highly legible at small sizes and at arm's length (wall-tablet requirement), quiet enough to disappear.
- **Data: Spline Sans Mono** — softer than JetBrains Mono; amounts, dates, metadata.

Scale: display 30/36 · heading 20 · subheading 16 · body 14 · caption 12 · label 11 tracked-caps.

### Spatial system
4px base grid. Radius philosophy: **12px standard, 20px for the pulse surfaces, 6px for pills** — surfaces feel like worn river stones, neither pill-shaped nor razor-sharp.

### Motion
- **Ambient:** `breathe` — a 6s opacity/glow cycle on the Hearth line and on any agent currently working. The system breathing, not performing.
- **Interaction:** `rise` — 400ms translateY(8px)+fade on panel entry, `cubic-bezier(0.16,1,0.3,1)`.
- `prefers-reduced-motion` disables both.

### Signature element — **the Hearth line**
A 2px gradient line across the very top of every screen that *breathes* in the household's current state color: sage when all is well, ember when something needs tending, clay when something is urgent. On the briefing it expands into the **Household Pulse** — an arc-of-the-day horizon with the six agents as glowing nodes. The user reads house state before reading a single word. No other app has this.

## Layout philosophy

- 80% of time is on the **Pulse** (briefing) — it owns the center column at generous width.
- The ambient status is the **Hearth line + domain rail dots** — visible from every screen.
- The AI layer surfaces as **"Waiting on you"** (decisions/approvals) and **"The desk"** (agent activity narrative) — never as a chat window bolted to the side. The Command Dock (⌘K) remains the capture affordance.
- Navigation is a **domain rail** grouped by rhythm — Flow (inbox/tasks/decisions), Domains (the five agents), Stores (inventory/shopping/vehicles/appliances), System — with attention dots, so the rail itself is a status display, not tab-switching.

Layouts compared:

```
A) Classic left-nav + card grid          B) CHOSEN: Hearth shell
┌────┬───────────────────┐               ┌──────────────────────────┐
│nav │ ┌────┐ ┌────┐     │               │ ~~hearth line (breathes)~~│
│    │ │card│ │card│     │               ├────┬─────────────────────┤
│    │ └────┘ └────┘     │               │rail│   HOUSEHOLD PULSE    │
│    │ ┌────┐ ┌────┐     │               │ •  │  "2 calls waiting"   │
│    │ │card│ │card│     │               │ •  │   ◠ arc + 6 nodes    │
└────┴───────────────────┘               │ •  │  Waiting on you      │
   (rejected: spreadsheet               │    │  Today · The desk    │
    tab-switching, SaaS-generic)        └────┴─────────────────────┘
```

## Decisions log

**Chosen:** dark-warm "Hearth" direction — charred oak surfaces, ember/sage/clay state colors, Bricolage Grotesque + Instrument Sans + Spline Sans Mono, Hearth line as the signature, briefing rebuilt as a state-first command center (Pulse → Waiting on you → Today → The desk).
**Rejected:** the existing glass-cockpit dark-blue dashboard (explicitly forbidden as generic, and metaphorically wrong); a light cream/serif domestic theme (forbidden default, and wrong for a wall panel that's on at night); a full layout teardown of all 15 pages in one pass (token-level redesign restyles every page immediately; screen-by-screen rebuilds follow in pass 2 — see gaps).

**Delivery strategy:** the redesign is applied at the **token layer** (`tailwind.config.js`, `globals.css`, `lib/agents.ts`) so all 15 pages adopt the new language without touching their files or any backend code, plus a ground-up rebuild of the shell (`layout.tsx`, domain rail, status bar, hearth line) and the home screen (`app/page.tsx`, Household Pulse).

## Known gaps (pass 2)

- Screen-by-screen rebuilds of `/inbox` (triage as narrative, inline approve), `/tasks` (threads-by-agent, not kanban-with-checkboxes), `/money`, `/meals`, `/schedule` domain rhythms.
- Morning/evening context-aware modes (vision supports it; needs a time-of-day layout switch).
- Command Dock restyle to the Hearth language (currently inherits tokens only).
- Agent activity history page (`/activity`) as a legible narrative.
