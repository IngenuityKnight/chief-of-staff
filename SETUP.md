# Chief of Staff — Setup & Population Guide

App URL: https://chief-of-staff-pied.vercel.app
Data editor: https://chief-of-staff-pied.vercel.app/data
Settings: https://chief-of-staff-pied.vercel.app/settings

---

## What's Already Done

| Area | Status | Notes |
|------|--------|-------|
| Household members | ✅ | Cameron (principal), Corine (partner), Charlie (child) |
| Household context | ✅ Seeded | Needs real values — edit at /settings |
| Rules | ✅ 8 rules | Peanut allergy, no meetings before 9am, $500 repair quotes, etc. |
| Vehicles | ✅ 2 vehicles | Lexus ES 350 2008, Volvo XC60 2011 — need gaps filled |
| Maintenance | ✅ 11 items | HVAC, oil changes, gutters, smoke detectors, etc. |
| Bills | ✅ 14 seeded | Placeholder amounts — update to real figures at /money |
| Appliances | ✅ 11 seeded | No purchase dates yet — add at /appliances |
| Inventory | ✅ 54 items | Quantities are estimates — adjust to what you actually have |
| Gmail | ✅ Connected | Runs 7am + 7pm UTC daily, Primary + Updates only |
| Google Calendar | ✅ Connected | Syncs daily at 7am UTC |

---

## Priority 1 — Settings Page (/settings)

Fill in everything here first — it gets prepended to every AI call.

- **Household name**: e.g. "Burden Household"
- **Address**: Your full home address (used for local vendor context)
- **Monthly budget**: Your actual total household monthly spend target
- **Frugal mode**: Toggle on if you want AI to always prioritize cost savings
- **Goals**: What you're working toward (financial independence, family time, etc.)
- **AI persona**: How you want the AI to communicate (direct, concise, risk-aware, etc.)

---

## Priority 2 — Bills (/money)

14 bills were seeded with placeholder amounts. Update each one to your actual numbers.
Click the pencil icon on any bill to edit.

**Bills to verify/update:**
- Mortgage / Rent — update to actual amount and due date
- Electric — update average and change kind to "variable"
- Gas — update average
- Water / Sewer — update amount and confirm quarterly vs monthly
- Internet — update to actual provider amount
- Phone — update to actual plan cost
- Car Insurance — Lexus (due July 8 — urgent) and Volvo
- Health Insurance — update to actual premium
- Home / Renters Insurance — update to actual premium
- Netflix, Spotify — confirm you still have these, update if needed
- Amazon Prime — $139/yr, confirm
- Grocery delivery — update if using Instacart/Shipt/etc.

**Add any missing bills:**
- Life insurance
- Dental / vision insurance
- Car payment(s)
- Student loans
- HOA fees
- Gym membership
- Other streaming services (Disney+, HBO, Apple TV, etc.)
- Cloud storage (iCloud, Google One)
- Software subscriptions (Adobe, Microsoft 365, etc.)
- Pest control, lawn service, cleaning service

---

## Priority 3 — Appliances (/appliances)

11 appliances were seeded with no dates. For each one, add:
- **Brand + model number** (check the appliance tag/manual)
- **Purchase date** (check receipts, credit card history, or estimate)
- **Warranty expires** (most major appliances = 1 year parts, 5-10 yr compressor)
- **Purchase price** (for repair vs replace decisions)

**Appliances seeded:**
1. Refrigerator
2. Dishwasher (has active drain issue in maintenance log)
3. Washing Machine
4. Dryer
5. HVAC / Furnace
6. Water Heater
7. Microwave
8. Oven / Range
9. Garbage Disposal
10. Main TV
11. Garage Door Opener (recent service from Live Garage Doors)

**Common warranties by type:**
- Refrigerator: 1yr parts, 5yr compressor
- Washer/Dryer: 1yr parts, limited lifetime on drum
- HVAC: 10yr parts if registered, 1yr labor
- Water Heater: 6-12yr tank warranty (check label)
- Dishwasher: 1yr parts and labor

---

## Priority 4 — Vehicles (/vehicles)

### Lexus ES 350 2008 (plate 2GS2844)
- **Insurance expires: July 8, 2026 — URGENT** (inbox alert created)
- **Oil**: Set last_oil_change_miles = 197,000 (estimate). Update when you get the actual service record. At 200,240 miles it's ~3,240 miles overdue.
- Missing: VIN number

### Volvo XC60 2011
- **Insurance expires**: Not set — add immediately
- **Registration expires**: Not set — add immediately
- **Oil**: No last oil change miles set. Next service at 143,066 (currently 139,555 — ~3,500 miles away)
- Missing: VIN number, license plate

To update vehicle fields: click the pencil icon on the vehicle card at /vehicles.

---

## Priority 5 — Inventory (/inventory)

54 items are seeded. Walk through your home and adjust quantities to match reality.
Focus first on items that are actually low — the shopping list auto-generates from this.

**Most important fields per item:**
- **Quantity**: What you actually have right now
- **Min quantity**: The point at which you want a shopping alert
- **Est. weekly consumption**: How fast you go through it (drives restock forecasting)
- **Package price + units per package**: Needed for accurate shopping list cost estimates

**Categories to walk through:**
- Pantry (kitchen cabinet): grains, canned goods, oils, spices, snacks
- Refrigerator: dairy, produce, proteins
- Bathrooms: toiletries, cleaning supplies
- Laundry room: detergent, dryer sheets
- Garage: motor oil, cleaning supplies, tools consumables
- Paper goods closet: toilet paper, paper towels, napkins

**Add items that are missing entirely** — things you buy regularly that aren't tracked yet.

---

## Priority 6 — Plaid / Bank Connection (/money)

Connect your bank and credit cards to unlock:
- Auto-discovery of recurring bills from transaction history
- Live account balances and net worth tracking
- 30-day spend breakdown by category
- Cash flow trends

To connect: go to /money and look for the "Connect Account" or Plaid link button.

---

## Recurring Setup — Rules (/roster)

Review the 8 existing rules and add any missing household policies:
- Dietary restrictions (Charlie: no peanut butter — already set)
- Meal preferences (cuisines you like, nights you cook vs. order)
- Work schedule rules (no meetings before 9am — already set)
- Spending rules ($500 repair quotes, $200 approval — already set)
- Vendor preferences (ClearGutter, Fixd Appliance, GreenScape — already set)

The more specific your rules, the better the AI recommendations get.

---

## Google Credentials — Rotate Secret

**Action required**: The GOOGLE_CLIENT_SECRET was shared in chat and should be rotated.

1. Go to console.cloud.google.com → Credentials → your OAuth client
2. Click "Regenerate secret"
3. Run: `echo "new_secret" | vercel env add GOOGLE_CLIENT_SECRET production`
4. Redeploy: push any small commit to trigger a new deployment

---

## Cron Jobs (automatic)

| Job | Schedule | What it does |
|-----|----------|-------------|
| Gmail | 7am + 7pm UTC | Pulls unread Primary + Updates emails → intake pipeline |
| Calendar | 7am UTC | Syncs Google Calendar events → schedule page |
| Plaid | 2am UTC | Syncs bank balances + recurring bills |
| Maintenance | 8am UTC | Auto-creates tasks for overdue items + vehicle checks |
| Bills | 9am UTC | Creates inbox reminders for bills due in 1-7 days |
| Shopping | 6am Sundays | Auto-generates shopping list from low-stock inventory |
| Digest | 6pm UTC | Evening summary of overdue tasks, bills due, low stock |

---

## Key Pages Reference

| Page | URL | Primary use |
|------|-----|-------------|
| Today / Briefing | / | Daily overview, priorities, cross-agent insights |
| Inbox | /inbox | Email captures, system alerts, manual intake |
| Tasks | /tasks | Task queue by agent + quick templates |
| Decisions | /decisions | Open choices waiting on you |
| Inventory | /inventory | Stock levels, log purchases, price history |
| Shopping | /shopping | AI-generated list by store |
| Meals | /meals | Plan meals, generate grocery ingredients |
| Home | /home | Maintenance tracker |
| Money | /money | Bills, spend breakdown, bank accounts |
| Schedule | /schedule | Calendar events |
| Vehicles | /vehicles | Vehicle info + maintenance lookup |
| Appliances | /appliances | Appliance tracker + warranty status |
| Roster | /roster | Household members + rules |
| Settings | /settings | Household context + AI configuration |
| Data | /data | Raw data editor for all tables |

---

## Mass Import Tips

For large data entry, use the **Data page** (/data):
- Select any resource from the dropdown
- Use the inline form at the bottom to add rows one at a time
- Or edit existing rows with the pencil icon

For bulk SQL inserts, use **Supabase dashboard**:
- Go to supabase.com → your project → SQL Editor
- Paste INSERT statements and run

---

## What Unlocks What

```
household_context filled   → Better AI on every feature (intake, shopping, meals, decisions)
bills filled               → Money page, bill reminders, spend alerts
appliances filled          → Warranty alerts, repair vs replace advice
vehicles gaps filled       → Oil change alerts, insurance/registration reminders
inventory accurate         → Smart shopping list, low-stock alerts, price tracking
Plaid connected            → Auto bill discovery, live net worth, spend trends
rules filled               → Meal planning respects preferences, AI advice is contextual
```
