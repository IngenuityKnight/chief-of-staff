# VISION.md

**Chief of Staff — Home Platform**

> The operating system for your household. Where AI agents handle the mental load, so you can focus on what matters.

---

## The problem

Running a modern household is a full-time job that nobody gets paid for. It's not the tasks — it's the *thinking about* the tasks.

- "What's for dinner?" — asked roughly 1,095 times per year
- "When did I last change the HVAC filter?"
- "Did I pay the gas bill?"
- "Is the dishwasher under warranty?"
- "Are we on track with the grocery budget?"
- "How do I fit meal prep into this crazy week?"

This invisible, unending cognitive overhead — **the household mental load** — quietly consumes 10-15 hours per week for the typical family, creates friction in relationships, and drains energy that could go to work, kids, health, or anything meaningful.

Existing tools don't solve it:

- **Task managers** (Todoist, Things) just store what you already thought of. They don't think for you.
- **AI assistants** (ChatGPT, Siri) have no memory, no execution, no integration.
- **Human assistants** (Magic, Fancy Hands) cost $3-10k/month and don't scale.
- **Single-domain apps** (meal planners, budget apps) fragment the problem into five apps that don't talk.

---

## The solution

A multi-agent AI system organized the way a real executive office is:

- A **Chief of Staff** at the top — triages, coordinates, synthesizes.
- **Specialist agents** under it — each an expert in one domain.

```
You: "I'm stressed about this week."
  ↓
Chief of Staff:
  Reads calendar (Schedule) → busy week confirmed
  Reads budget (Money) → grocery budget tight
  Reads inbox (Meals) → no meal plan yet

Chief of Staff: "Here's the play.
  Meals agent built a budget-friendly 5-day plan.
  Schedule agent blocked 90 min Sunday for prep.
  Money agent confirmed you're $60 under grocery budget.
  Approve?"
```

That coordination — across domains, under a single executive brain — is the thing nothing else does.

---

## The agents

| Agent | Owns | Makes you stop worrying about |
|---|---|---|
| **Chief of Staff** | Routing, synthesis | Triage overhead |
| **Meals** | Plans, groceries, prep | "What's for dinner?" |
| **Home** | Maintenance, repairs | "When did I last..." |
| **Money** | Bills, budget, subscriptions | Late fees, forgotten subs |
| **Schedule** | Calendar, time protection | Conflicts, over-commitment |
| **Roster** | Household, relationships | Who, how, with whom |

Each one has deep domain expertise, reads its own Rules & Preferences database, and coordinates with the others through the Chief of Staff.

---

## What makes this different

**Memory & context.** Agents remember preferences forever. Must-follow rules are binding. Every decision consults the Rules & Preferences database first.

**Proactive intelligence.** Not just reactive. Noticing the HVAC filter is due in 2 weeks and ordering one. Seeing the busy week ahead and proposing a simpler meal plan. Flagging an overdue bill before the late fee hits.

**Cross-domain coordination.** Budget constraints inform meal planning. Calendar availability gates repair scheduling. The agents talk.

**Human-in-the-loop by default.** Nothing auto-executes past $200 or a must-follow rule. Trust is built gradually. Control is never fully delegated.

**Privacy-first.** Self-hostable from day one. Your household data, your infrastructure. No vendor lock-in.

---

## The user experience

**Morning:** Wake to a briefing — 3 priorities surfaced, grocery run queued, bill due Friday.

**During the day:** Text the system: "overwhelmed with meals this week." Two minutes later: meal plan + grocery list + prep block ready for one-click approval.

**Evening:** "Reminder: meal prep tomorrow 2pm (calendar already blocked)." Done.

**Weekly:** "Saved $85 this week by consolidating errands. 4/5 tasks completed. HVAC maintenance due next month — want me to order the filter now?"

**The feeling shift:**

| From | To |
|---|---|
| "I'm forgetting something..." | "It's handled." |
| "I don't have time." | "I have a plan." |
| "Why is this so hard?" | "I'm on top of things." |
| "Something's slipping." | "I have time for what matters." |

---

## Go-to-market (compressed)

### Year 1 — High-touch consulting
Busy professionals ($200k+ HHI). Custom setup in Notion + n8n, $3,500-5,000. Optional retainer $500-1,000/mo. Target: 10 clients, $50k+ revenue, 95%+ margins.

### Year 2 — Templatized service
Cohort-based onboarding. Reusable templates. Junior consultant for setup. Target: 30 clients, $150k+ revenue.

### Year 3+ — Decide based on data
- **Boutique consulting firm** (premium, high-touch, ~$500k-1M revenue)
- **Product company** (scale via software, fundraise, exit potential)
- **Infrastructure** (license the framework to other consultants)

The consulting-first path means profitability from client #1, real feedback, real case studies. You only productize what's been validated.

---

## Why we win

- **First to nail multi-agent household management.** Most competitors are single-domain. The coordination is the moat.
- **Human-in-the-loop trust model.** Others are racing toward full automation (and failing). We embrace gradual trust-building.
- **Privacy-first.** Self-hosting is a selling point for the exact customers who can afford this.
- **Consulting-first GTM.** Fast revenue, deep learning, real case studies before any big rebuild.
- **99% margins during consulting phase.** Undercut human assistants by 70-90% while staying highly profitable.
- **Founder-market fit.** Build for yourself first. Use it daily. Authenticity shows.

---

## The north star

Not revenue. Not user count. Not features shipped.

**Time reclaimed.** **Stress reduced.** **Lives changed.**

Every hour spent on household logistics is an hour stolen from family, health, creativity, purpose. Our job is to return that time — not by doing less, but by thinking smarter. Through specialized AI agents that coordinate like a world-class Chief of Staff, we're building the operating system for the modern household.

One where the mental load is managed, decisions are optimized, and people are free to focus on what makes life meaningful.

---

## Current status

**v0.1.0 — Working prototype.** This repo is the front-end command surface. All 8 pages render from a realistic mock dataset. The intake API uses heuristic routing that can be swapped for an LLM or forwarded to n8n.

Next: real LLM routing, Notion adapter, in-app approval UI, n8n workflow templates.

See `docs/PROJECT.md` for the build spec.
