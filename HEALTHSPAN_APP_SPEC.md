# Primedy Healthspan Challenge Calculator

**What it is:** A web app where an athlete types in their raw Healthspan Challenge results and instantly gets a tier, points and an exact functional age for each of the 10 stations, plus their overall Healthspan Score, band and Healthspan Age.

**Why:** The paper scorecard only places people in a decade ("somewhere in your 40s"). Averaging ten rough guesses gives a rough answer. This app calculates an exact age for every station, so the final Healthspan Age is precise and changes meaningfully from one re-test to the next.

**Files in this folder**
- `HEALTHSPAN_APP_SPEC.md`: this document, the build instructions.
- `scoring-tables.json`: every threshold and median from the scorecard. This is the only place scoring numbers live. To re-calibrate the norms later, edit this file and nothing else.

---

## Part 1: Owner decisions

These are already set to the recommended option. Change any line before building if you'd like something different. Each decision becomes a setting in `config.js`, so it can also be changed later without touching code.

| # | Question | Setting | Options |
|---|---|---|---|
| 1 | An athlete can do some pull-ups but also has a long dead hang. Which counts? | **Better of the two** | `best_of_both` · `scorecard` (pull-ups always win if 1+ rep) |
| 2 | At-home athletes have no body fat %. How is body composition scored? | **Placeholder tiers from waist-to-height, and left out of the Healthspan Age** | Keep placeholder · Replace with your own numbers |
| 3 | InBody shows muscle mass (ASMI) below the sarcopenia line. Effect? | **Tier capped at Fair** | Cap at Fair · Cap at At-Risk |
| 4 | A station wasn't tested. Effect? | **0 points; left out of the age average** | Fixed by the scorecard |
| 5 | Send results to HubSpot? | **Off** | On (uses the existing quiz form) · Off |
| 6 | Show band descriptions exactly as written on the scorecard? | **Yes, but the Strong band reads "typically younger than chronological age"** instead of "10–15 years younger" | Scorecard wording · Softened wording |

Why decision 1 matters: under the scorecard rule, a man under 40 doing 2 pull-ups scores At-Risk, while one doing 0 pull-ups with a 90-second hang scores Strong. Getting better at pull-ups would lower his score. "Better of the two" removes that trap.

---

## Part 2: What the athlete sees

**Step 1: About you.** First name, age, sex, bodyweight (lb), height, In-Gym or At-Home, test date (defaults to today).

**Step 2: Enter results.** One screen per station, with a progress bar. Each screen shows:
- the station name and a one-line reminder of how it's tested
- a choice of test version where one exists (e.g. full or knee push-ups)
- the input boxes, with units shown
- a "Didn't test this" button

Results update as values are typed, and athletes can go back and edit anything.

| # | Station | Versions | What they enter |
|---|---|---|---|
| 1 | Body Composition | InBody · Tape measure | InBody: body fat %, ASMI. Tape: waist and calf (cm) |
| 2 | Sitting-Rising Test | none | Score 0–10 (half points allowed) |
| 3 | Single-Leg Stance | none | Best hold in seconds |
| 4 | Grip Strength | Dynamometer · Bathroom scale | Kg, or scale reading and empty reading in lb |
| 5 | Deadlift | none | Weight (lb) and reps (default 3) |
| 6 | Strict Press | Barbell · Dumbbells/KBs | Weight (lb, total of both DBs) and reps (default 3) |
| 7 | Push-Ups | Full · Knee | Reps |
| 8 | Pull-Ups / Dead Hang | Pull-ups · Dead hang · Both | Reps and/or seconds |
| 9 | Cardio | 1-mile run · 2K row · Rockport walk (at-home) · Known VO₂ max | Time (mm:ss); walk also asks finish heart rate |
| 10 | Jump | Vertical · Broad | Inches |

If a value looks unrealistic (a 3-minute mile, say), show a gentle "Double-check this?" note. Don't block it.

**Step 3: Results.**
- **Headline:** Healthspan Age, big, next to their real age, with a line like "8 years younger than your actual age."
- **Score:** Healthspan Score out of 100, the band name and its description.
- **Station breakdown:** for each station, what they entered, the calculated figure (e.g. "1.75× bodyweight" or "est. VO₂ 37"), tier badge, points and functional age. Add a simple bar chart of the 10 ages against a line at their real age.
- **Focus next:** the two stations with the lowest points, with ties going to the one furthest above their real age.
- **Missing stations:** if some weren't tested, show "Based on X of 10 stations."
- **Buttons:** Print / Save PDF · Edit results · Start over.
- **Footer:** "Estimates based on population norms, not a medical assessment. Re-test in 12 weeks using the same test versions."

---

## Part 3: Build instructions (for Claude Code)

### Tech
- A static, browser-only single-page app: no backend, logins or database. It must work as a standalone page and inside an iframe on the gym's website.
- Keep the scoring engine as a pure module (`src/scoring/`) with no UI code. Write unit tests from Part 4 and get them passing **before** building any screens.
- Read every number from `scoring-tables.json`, and put owner decisions in `config.js`. Don't hard-code either.
- Build mobile-first and accessible (labeled inputs, keyboard navigation, visible focus, good contrast), and include a print stylesheet for the results page.
- Style it to match the existing website quiz. Use Montserrat (Bold for headlines and large text). Colors: ink `#18242E`, background `#F2F4F1`, teal `#1F6F6B`, yellow `#E8B931`, lines `#C9D3D0`, secondary text `#5B6B72`, warning `#B5542E`.
- Store each session as one results object with a date, so history and re-test comparison can be added later.

### Scoring rules

**Age band.** `under40` = under 40, `40to59`, `60plus`. The SRT uses one table for everyone. Single-leg stance varies by age but not sex.

**Tier.** Each table lists four thresholds, in the order Elite, Strong, Good, Fair. Missing all four means At-Risk.
- Higher is better: take the first tier where result ≥ threshold. Skip any `null`.
- Lower is better (body fat, run and row times): take the first tier where result < threshold. The JSON already encodes the scorecard's ranges this way; for example, a 7:30 mile is Strong for men under 40 and 7:31 is Good.

**Points.** Elite 10, Strong 8, Good 6, Fair 4, At-Risk 2, not tested 0.

**Functional age.** This replaces the decade lookup.
1. Place the six decade medians at ages 25, 35, 45, 55, 65 and 75.
2. Pull-ups only: ignore medians of 0, since athletes with 0 reps are scored on the hang instead.
3. When neighboring medians are equal, merge them into one point at their average age. For example, men's deadlift is 1.75 at both 25 and 35, which becomes one point at 30.
4. If the result falls between two points, draw a straight line between them and read off the age.
5. If it's beyond either end, extend the nearest line.
6. Clamp the answer to 25–85. 25 is the youngest anchor (the 20–29 median), so no station claims a younger age than the data supports. (Was 20–85.)
7. Keep full precision in calculations and show whole years.

**Calculated values.**
- Estimated 1RM = weight × (1 + 0.0333 × reps). Divide by bodyweight and round to 3 decimals.
- Grip from a bathroom scale = (squeeze reading − empty reading) ÷ 2.2046 kg.
- Waist-to-height = waist ÷ height (same units).
- Run or row: take the tier from the time table. For functional age, estimate VO₂ with `cardio.timeToVo2` (straight-line between the listed pairs, extend at the ends, clamp to 10–80), then use the VO₂ medians. Don't use the Cureton formula; it contradicts the scorecard's own tiers.
- Rockport walk: VO₂ from `cardio.rockportFormula`, tier from `cardio.vo2maxTiers`.
- Known VO₂ max: tier from `cardio.vo2maxTiers`.

**Decision logic** (settings from Part 1)
- `pullUpPolicy: "best_of_both"`: score both results, keep the better tier and the younger age. With `"scorecard"`, use pull-ups if there's 1+ rep, otherwise the hang.
- `atHomeBodyComp`: tier from `PLACEHOLDER_waistToHeightTiers_lower_is_better`. If calf is under target (34 cm men, 33 cm women), cap at Fair. No functional age.
- `asmiCap: "fair"`: if ASMI is below 7.0 (men) or 5.4 (women), body composition can be no better than Fair.
- `hubspot.enabled: false`. When on, ask for last name and email before results, then POST to `https://api.hsforms.com/submissions/v3/integration/submit/46210884/85766b0c-d279-4c15-80ce-f14de59057e1` with `firstname`, `lastname`, `email`, `healthspan_age` and `healthspan_score`. Results must still show if the send fails.

**Totals.**
- Healthspan Score = sum of points (maximum 100).
- Band is looked up in `healthspanBands`.
- Healthspan Age = average of functional ages from tested stations.
- Difference = Healthspan Age − real age.

---

## Part 4: Test answers

The engine must match these to within ±0.1 year. They assume `pullUpPolicy: "scorecard"`. Add one extra test for `best_of_both`: a man, age 35, with 2 pull-ups and a 90-second hang should score Strong (from the hang) with age 25. Pull-ups alone would give At-Risk and age 60.0.

**Athlete A: male, 47, 185 lb**

| Station | Entered | Calculated | Tier | Pts | Age |
|---|---|---|---|---|---|
| Body comp | 19.0% | | Good | 6 | 38.3 |
| SRT | 8.5 | | Strong | 8 | 50.0 |
| Single-leg | 34 s | | Strong | 8 | 42.3 |
| Grip | 47.5 kg | | Strong | 8 | 40.0 |
| Deadlift | 295 × 3 | 1.754× | Strong | 8 | 29.8 |
| Strict press | 115 × 3 | 0.684× | Good | 6 | 34.8 |
| Push-ups | 24 | | Strong | 8 | 28.3 |
| Pull-ups | 5 | | Good | 6 | 40.0 |
| Mile | 8:30 | VO₂ 37.0 | Strong | 8 | 45.0 |
| Vertical | 17 in | | Strong | 8 | 41.7 |
| **Total** | | | **Strong** | **74** | **39.0** |

**Athlete B: female, 62, 150 lb**

| Station | Entered | Calculated | Tier | Pts | Age |
|---|---|---|---|---|---|
| Body comp | 31.0% | | Good | 6 | 60.0 |
| SRT | 6.0 | | Fair | 4 | 68.3 |
| Single-leg | 9 s | | Fair | 4 | 69.3 |
| Grip | 21.0 kg | | Good | 6 | 70.0 |
| Deadlift | 125 × 3 | 0.917× | Strong | 8 | 54.1 |
| Strict press | 35 × 3 | 0.257× | Good | 6 | 73.6 |
| Push-ups | 6 | | Good | 6 | 55.0 |
| Dead hang | 28 s (0 pull-ups) | | Good | 6 | 57.0 |
| Mile | 11:15 | VO₂ 27.5 | Strong | 8 | 51.2 |
| Vertical | 6.5 in | | Good | 6 | 62.5 |
| **Total** | | | **Good** | **60** | **62.1** |

**Edge cases**

| Case | Expected |
|---|---|
| Female grip 31 kg / 33 kg | Age 30.0 / 25 |
| Male deadlift 1.60× | Age 39.0 |
| SRT 10 / 3 | Age 25.0 / 85 |
| Male push-ups 0 | Age 85 |
| Female pull-ups 1 / 2 | Age 40.0 / 25.0 |
| Male pull-ups 1 | Age 65.0 |
| Male body fat 22% / 12% | Age 50.0 / 25 |
| Male 45, grip 44.5 kg | Good |
| Male 35, mile 7:30 / 7:31 | Strong / Good |
| Male 35, 2K row 7:45 | VO₂ 40.0, Good, age 35.0 |
| Female 44, 2K row 10:00 | VO₂ 25.0, Fair, age 57.5 |
| Male 52, mile 12:00 | VO₂ 22.7, At-Risk, age 75.7 |
| Female 58, 160 lb, Rockport 15:30, HR 130 | VO₂ 27.1, Good, age 52.2 |

---

## Not in version 1
Accounts, saved history, re-test comparisons, coach dashboards and multi-athlete event mode.
