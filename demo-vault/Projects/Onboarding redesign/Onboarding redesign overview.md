# Onboarding redesign

## Problem

Week-one retention is the weakest point in the funnel. The current first-run
experience assumes the user arrives with content to act on, and a meaningful
share of new installs do not.

## Hypothesis

Users who reach a visible result before any configuration step retain better
than users who complete configuration first. The current flow inverts this:
four setup screens before anything happens.

## Current state

1. Welcome screen
2. Connect account
3. Choose an inbox folder
4. Choose an output folder
5. Done → empty vault, nothing to act on

Steps 3 and 4 are the drop-off, and both are meaningless to a user with an
empty vault.

## Proposed

Ask one question first: *do you already have notes here?*

- **Yes** → point at an existing folder, show a real result on real content,
  configure afterwards
- **No** → offer a single paste box (a link, a recording, a photo), produce one
  structured note, configure afterwards

Either way the user sees output before step two.

## What would tell us we're wrong

If week-one churners turn out to have full vaults, the empty-vault framing is
wrong and this is a value-communication problem instead. We cannot currently
answer this — see [[2026-02-10 Weekly research sync]].

## Related

- [[Interview themes]]
- [[Open questions]]
