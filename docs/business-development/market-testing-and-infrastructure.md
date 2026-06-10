# Chief of Staff Business Development Notes

Last updated: 2026-06-10

This document is a working resource for turning the current Chief of Staff prototype into a validated household operations product, private beta, client service, or investor-backed company. Keep adding research, interview notes, pricing evidence, competitor screenshots, user quotes, and technical decisions here as the idea matures.

## Current Product Thesis

Chief of Staff is a household operating system: an AI-assisted command center for the mental load of running a home.

The product should not be positioned as another calendar, task manager, or chatbot. The stronger position is:

> Stop being the household operating system. Forward, text, or capture anything, and Chief of Staff turns it into tasks, decisions, reminders, shopping lists, calendar blocks, and household follow-through.

The codebase already points toward a deeper product than ordinary family organization apps:

- Inbox triage for unstructured household input.
- Task approval flow.
- Daily briefing and top-priority surfacing.
- Meals, shopping, and inventory.
- Bills, Plaid-connected balances/spend, and subscription tracking.
- Google Calendar sync.
- Vehicles, appliances, home maintenance, and warranty/service memory.
- Decision support for household choices.
- Rules/preferences as agent memory.
- Activity log and admin/data editing.

The core strategic question is not "can this exist?" The market already shows demand. The better question is:

> Can this become a trusted, deeper, higher-value household operations layer that people use every week after the novelty wears off?

## Recommended Validation Path

Do this in stages.

1. Use it for your own life first.
2. Enhance only from real usage pain.
3. Give it free to family members as a private beta.
4. Watch behavior, not compliments.
5. Do deeper market research after you have actual usage patterns.
6. Package the repeated setup into either a client service or consumer app.

The strongest early signal is weekly reuse. Ask:

- Do people keep adding real household data?
- Do they trust it with school schedules, bills, groceries, maintenance, or calendar changes?
- What features do they ignore?
- What do they still do manually?
- What creates anxiety or privacy concern?
- What saves them measurable time?
- What would they pay for if it disappeared?

## Competitor Map

These references were checked on 2026-06-10. Re-verify before fundraising, publishing, or making pricing claims.

### Ohai.ai

Website: https://www.ohai.ai/

Ohai is the closest direct competitor. It positions itself as a household manager where users can text or talk to get things done. Its public site describes support for calendars, to-dos, meals, emails, and docs. The FAQ says Ohai has a free version and premium plans starting at $9.99/month. It also says Ohai combines AI automation with human support when needed and can scan emails, PDFs, photos, school newsletters, team schedules, and camp calendars to suggest calendar events, reminders, or tasks.

Business implication:

- This validates the "AI household manager" category.
- The winning wedge appears to be unstructured intake: text, email, screenshot, PDF, or document into structured household action.
- Ohai is strong on emotional positioning around parents, moms, ADHD, school chaos, and mental load.
- It may be less deep on home maintenance, financial operations, vehicle/appliance memory, inventory economics, and cross-domain decision support.

### Hearth Display

Website: https://hearthdisplay.com/

Hearth is a family command-center product with hardware. Its public site describes a shared system replacing whiteboards, wall calendars, chore charts, and scattered reminders. Listed features include smart calendar, kid-friendly routines, AI-powered meal planning, one app to manage it all, Hearth Helper, family dashboard, routines/rewards, family rhythm summary, meal planning, and "loved by 40,000+ families."

Business implication:

- Hearth validates that families will pay for a dedicated household coordination system.
- Hearth's center of gravity is family rhythm, kids, routines, chore delegation, and visible shared hardware.
- A software-only Chief of Staff product can avoid the hardware constraint but must be much easier to adopt.
- Differentiation should not be "we also have a family dashboard." It should be deeper operational intelligence and follow-through.

### Skylight Calendar

Website: https://myskylight.com/products/skylight-calendar/

Skylight is another family calendar hardware/app product. Its product page lists calendar devices, mobile app, custom lists, tasks, color coding, weather, parental lock, device linking, shared access, meal planning, and Magic Import. The page says Magic Import can forward an email or PDF from school and convert it into calendar events. The product page also lists auto-sync support with Google, Outlook, Apple, Cozi, and Yahoo. The current public page shows a 15-inch Calendar 2 at $279.99, with Plus at $79/year after a free month.

The Verge reviewed Skylight Calendar Max and Sidekick in 2025, describing AI-powered import for emails, photos, flyers, and spreadsheets into calendar entries, plus meal planning and to-do support.

Business implication:

- Skylight validates the "chaos intake" use case: turning school/team/family documents into structured calendar data.
- It also validates that families tolerate subscriptions for family operations if the product saves repetitive admin time.
- Hardware gives Skylight strong visibility in the home but also raises adoption cost and logistics.
- Chief of Staff can compete as a higher-touch, cross-domain intelligence layer.

### Cozi

Website: https://www.cozi.com/

Cozi is the mature family organizer category incumbent. Its public site positions it as the "#1 family organizer app" and describes shared family calendar, color coding, automatic notifications, agenda emails, grocery lists, to-dos, recipes, meal planner, and availability on mobile and computer.

Business implication:

- Cozi validates the mainstream need for shared household coordination.
- Cozi is likely less AI-native and less proactive.
- Competing directly as "family calendar plus lists" is a weak position.
- Chief of Staff should compete above Cozi, not beside it: intake, reasoning, prioritization, decisions, integrations, and operational memory.

## Differentiation Hypothesis

The opportunity is not to build a better to-do list. The opportunity is to build a household operations layer that coordinates across domains.

Potential differentiators:

- Multi-agent model: Chief of Staff plus Meals, Home, Money, Schedule, Roster.
- Cross-domain reasoning: budget affects meals, calendar affects meal prep, maintenance affects money, vehicle expiration affects schedule.
- Durable household memory: rules, preferences, vendor history, appliance info, warranties, vehicle info, recurring tasks.
- Human-in-the-loop execution: suggestions and approvals before costly or sensitive action.
- Premium/private option: self-hostable or privacy-forward architecture for families with sensitive data.
- Concierge setup: initial human-assisted onboarding for busy households.
- Home maintenance and finances: broader than school/calendar chaos.

Avoid generic claims like "AI for families." Stronger claims:

- "Turn household chaos into approved next actions."
- "One command center for the decisions, tasks, money, meals, maintenance, and schedule that run your home."
- "The app that remembers how your household works."
- "An AI Chief of Staff for busy households."

## Target Customer Wedges

Start narrow. Good early customer segments:

- Dual-income parents with school-age kids.
- ADHD parents or households struggling with executive function.
- High-income busy professionals who already pay for convenience.
- Caregivers coordinating appointments, medications, bills, and family logistics.
- Homeowners with many recurring maintenance, appliance, vehicle, and vendor tasks.
- Families with complex school/sports/activity schedules.

Do not start with "everyone who has a household." That is too broad.

## Recommended Business Model Progression

### Stage 1: Personal Operating System

Goal: make it indispensable for your own life.

Success criteria:

- 5+ captures per week.
- Daily or near-daily dashboard check.
- Real tasks completed from the system.
- At least one real calendar, shopping, bill, maintenance, or decision workflow handled end-to-end.
- Clear list of missing automations.

### Stage 2: Private Family Beta

Goal: prove it works outside your own head.

Approach:

- Invite 3-5 family households.
- Offer free access in exchange for honest usage and feedback.
- Set up each household manually at first.
- Run weekly check-ins.
- Track which workflows actually get used.

Success criteria:

- 60-90 days of weekly use.
- At least 2 households continue without prompting.
- Users add sensitive/real data, not only demo data.
- Users ask for enhancements because they want to keep using it.
- You can identify the top 3 repeated jobs-to-be-done.

### Stage 3: Concierge Client Service

Goal: validate willingness to pay before scaling software.

Possible offer:

- $1,500-$5,000 household setup.
- $200-$1,000/month ongoing support depending on depth.
- Done-with-you onboarding: calendar, email, bills, maintenance, vehicle, pantry, family rules, recurring routines.

Why this path is attractive:

- Revenue from first clients.
- Deep learning.
- Case studies.
- Less pressure to solve self-serve onboarding immediately.
- Lets you discover which parts deserve productization.

### Stage 4: Consumer App or Premium SaaS

Only after the workflows are proven.

Required before consumer scale:

- Multi-tenant auth.
- Self-serve onboarding.
- Household invite flow.
- Secure data isolation.
- Mobile-first experience.
- Billing.
- Clear privacy and data retention policies.
- Notification system.
- Support process.
- Observability and backup strategy.

## Recommended Infrastructure Stack

For the next serious phase:

| Layer | Recommendation |
| --- | --- |
| App hosting | Vercel |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| Tenant isolation | Household-based row-level security |
| Background jobs | Vercel Cron initially |
| AI calls | Server-side only |
| File storage | Supabase Storage later |
| Payments | Stripe later |
| Error monitoring | Sentry or Logtail later |
| Product analytics | PostHog or Vercel Analytics later |
| Email | Resend, Postmark, or Gmail API depending on use case |
| SMS, later | Twilio |

## Multi-Tenant Data Model

The app needs to move from "one household" to "many isolated households."

Core model:

```text
auth.users
  -> household_memberships
  -> households
  -> all household data
```

Recommended tables:

```sql
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now()
);

create table public.household_memberships (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'adult', 'child', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
```

Every household-private table needs a `household_id`, including:

- `inbox_items`
- `tasks`
- `bills`
- `calendar_events`
- `rules`
- `meal_plan_days`
- `household_context`
- `household_members`
- `inventory_items`
- `shopping_list_items`
- `vehicles`
- `appliances`
- `decisions`
- `activity_log`
- `plaid_connections`
- `google_connections`

The current app has `household_context` as a single default row. That must become per-household before other people can safely sign in.

## Security Requirements

This product will hold sensitive household data: calendars, finances, children, appointments, vehicles, addresses, emails, bills, and preferences.

Minimum requirements before family beta:

- Supabase Auth enabled.
- Row-level security enabled on all exposed tables.
- Policies only allow household members to access rows for their household.
- Server routes always resolve the current user's household.
- No browser access to `SUPABASE_SERVICE_ROLE_KEY`.
- Service role used only server-side.
- All service-role queries include explicit `household_id` filters.
- Per-household storage for Google/Plaid tokens.
- No global OAuth refresh token shared across all users.
- Privacy policy draft before expanding beyond close family.

Policy concept:

```sql
exists (
  select 1
  from public.household_memberships hm
  where hm.household_id = table_name.household_id
    and hm.user_id = auth.uid()
)
```

## Integration Model

App-level API credentials can stay in environment variables:

- Google client ID/secret.
- Plaid client ID/secret.
- Anthropic/OpenAI API keys.
- Kroger app credentials.

User/household-specific tokens should live in database tables scoped to `household_id`:

```text
google_connections
  household_id
  user_id
  provider_account_email
  refresh_token
  calendar_id
  scopes
  created_at

plaid_connections
  household_id
  user_id
  item_id
  access_token
  institution_name
  created_at
```

## Research Prompt For Later

Use this prompt when you are ready to do serious market testing, investor prep, or positioning work.

```text
You are a market research and product strategy analyst helping evaluate a startup called Chief of Staff.

Product context:
Chief of Staff is an AI household operating system. It captures unstructured household input from web, email, SMS, voice, screenshots, or documents; routes it through a Chief of Staff agent; delegates to specialist domains like Meals, Home, Money, Schedule, Roster, Inventory, Vehicles, Appliances, and Decisions; then proposes tasks, calendar blocks, reminders, shopping items, bill actions, maintenance actions, and decisions for human approval.

Core thesis:
Busy households do not need another task list. They need an operational layer that remembers household context, turns chaos into structured next actions, coordinates across calendar/money/meals/home maintenance, and reduces the mental load of being the household operating system.

Current validation plan:
1. Use it personally.
2. Improve it from real usage.
3. Give it free to family households.
4. Measure repeated weekly usage and trust.
5. Research competitors deeply.
6. Decide between concierge service, premium SaaS, or consumer app.

Known competitors to analyze:
- Ohai.ai: AI household manager, text/talk interface, calendars, tasks, meals, emails/docs, human support, premium plans from around $9.99/month as of 2026-06-10.
- Hearth Display: family command-center hardware, smart calendar, kid routines, AI meal planning, Hearth Helper, family dashboard.
- Skylight Calendar: family calendar hardware/app, Magic Import, meal planning, tasks, lists, calendar sync, Plus subscription.
- Cozi: mature shared family calendar, shopping lists, to-dos, recipes, meal planner.
- Also research adjacent products: Todoist, Notion templates, Google Calendar workflows, Apple Reminders, AnyList, Paprika, Monarch Money, Rocket Money, Tody, Sweepy, HomeZada, Thumbtack, Angi, Alexa/Google Assistant, ChatGPT/Gemini custom workflows.

Research goals:
1. Map the competitive landscape.
2. Identify the strongest wedge for Chief of Staff.
3. Find underserved customer segments.
4. Compare pricing models and willingness-to-pay signals.
5. Identify which features are table stakes vs differentiators.
6. Find trust, privacy, and onboarding objections.
7. Recommend a go-to-market path for the next 12 months.
8. Recommend metrics to track during private beta.
9. Suggest interview questions for target users.
10. Produce a positioning statement, landing page copy, and first paid offer.

Output format:
- Executive summary.
- Competitor table.
- Category map.
- Jobs-to-be-done.
- Customer segments.
- Pricing and packaging recommendations.
- Risks and objections.
- Recommended beta plan.
- Investor-facing narrative.
- Open questions that require primary research.

Important:
Distinguish confirmed source facts from assumptions. Include source URLs and dates checked for every competitor claim.
```

## User Interview Questions

Use these during family beta or discovery calls.

- Who currently carries most of the household planning load?
- What household tasks live only in someone's head?
- What do you forget most often?
- What creates the most friction between adults in the household?
- What comes in through email, paper, screenshots, or texts that should become calendar events or tasks?
- How do you currently manage groceries, meals, bills, chores, school, activities, and maintenance?
- What tools do you already use?
- What would you never trust an AI to do?
- What would you trust AI to draft, but not execute?
- What would you happily let AI handle automatically?
- What would save you 3 hours per week?
- What would make you pay $20/month?
- What would make you pay $200/month?
- What would make you pay $2,000+ for setup?
- If this product disappeared after a month, what would you miss?

## Beta Metrics

Track behavior, not only opinions.

- Captures per household per week.
- Approvals per household per week.
- Tasks created from intake.
- Tasks completed.
- Calendar events created.
- Shopping items generated.
- Meal plans generated.
- Bills or subscriptions reviewed.
- Maintenance reminders acted on.
- Decisions resolved.
- Number of repeat weekly active households.
- Time-to-first-use after signup.
- Time-to-first-value after signup.
- Manual interventions required by you.
- Privacy/support issues raised.
- Features ignored.

## Near-Term Build Priorities

Before broader family beta:

1. Add Supabase Auth.
2. Add `households`.
3. Add `household_memberships`.
4. Add `household_id` to all private tables.
5. Update server reads/writes to filter by current household.
6. Add RLS policies.
7. Replace global Google/Plaid tokens with per-household connections.
8. Add basic onboarding.
9. Add household invite flow.
10. Add a private-beta feedback capture mechanism.

## Investor/Partner Narrative Seed

Household management is an enormous category hidden in plain sight. Families already spend money across calendars, grocery apps, meal planners, budgeting apps, home maintenance services, family organizers, and human help. The pain is not lack of tools. The pain is fragmentation and mental load.

Chief of Staff is building the coordination layer for the modern household. It turns messy inputs into structured action, remembers household context, coordinates across domains, and keeps humans in control through approval-based workflows.

The first wedge is high-friction household intake: emails, school notices, screenshots, bills, repairs, grocery needs, and scheduling chaos. The long-term opportunity is a trusted household operations platform.

## Resource Backlog

Add future research here:

- Competitor screenshots.
- Pricing screenshots.
- App Store reviews.
- Reddit threads about household mental load.
- Parent/ADHD/caregiver community pain points.
- Interview transcripts.
- Beta usage exports.
- Churn reasons.
- Case studies.
- Security/privacy requirements.
- Investor pitch notes.
- Client onboarding checklist.
