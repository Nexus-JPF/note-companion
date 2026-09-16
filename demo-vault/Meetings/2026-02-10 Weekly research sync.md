---
type: meeting
date: 2026-02-10
attendees: [Priya, Sam, Jo]
---

# Weekly research sync — 10 Feb 2026

## Discussion

Walked through the two-segment split from [[Interview themes]]. Broad agreement
that the current onboarding is built for Marco and actively annoys Dana.

Sam pushed back on splitting the flow: two paths means two things to maintain
and neither gets attention. Counter-proposal was a single flow that asks one
question up front ("do you already have notes here?") and branches only on the
first screen.

Jo raised the instrumentation gap — we can't currently answer whether week-one
churn correlates with vault size, because vault size isn't reported at all.

Discussed whether to instrument it. Agreed it's a small change but it needs to
be opt-in and aggregate-only, given the audience.

## Decisions

- Single onboarding flow, branching on one question, not two separate flows
- Instrument vault size at first run, bucketed, opt-in
- Hold the checklist redesign until we have that number

## Action items

- [ ] Sam — spec the one-question branch, by Thu
- [ ] Jo — scope opt-in vault-size reporting
- [ ] Priya — third interview in the "protecting a system" segment, this week
- [ ] Follow up with Dana for a count of her untranscribed audio backlog

## Parking lot

- Should the empty-vault case offer sample content? Nobody liked it, nobody had
  a better idea.
