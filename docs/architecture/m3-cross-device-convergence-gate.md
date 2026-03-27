# M3-06 Cross-Device Convergence Gate

## Goal

Validate minute-level eventual convergence for same-day data across desktop/mobile sync flows.

## Repeatable Validation Scenarios

Executable suite: `packages/sync-r2/test/sync-bundle.test.ts`

### Scenario A: Cross-device eventual convergence

Steps:

1. Desktop and mobile start with overlapping same-day base data and device-specific deltas.
2. Run sync rounds in fixed sequence: desktop -> mobile -> desktop -> mobile.
3. Compare final merged snapshots on both devices.

Expected:

- event set converges exactly
- annotation conflicts resolve by shared LWW rule
- report artifact conflicts resolve by shared LWW rule
- repeated scenario run yields identical final snapshot

### Scenario B: Minute-level residual variance before final pull

Steps:

1. Desktop has base same-day event.
2. Mobile has an additional short same-day delta event (45s).
3. Run partial rounds: desktop -> mobile.
4. Measure pre-convergence summary gap, then run final rounds to full convergence.

Expected:

- pre-final-pull gap is non-zero but <= 60,000ms
- after final pull rounds, summary gap is exactly 0

## Agreed Window and Variance

- Convergence window target: <= 60,000ms (minute-level)
- Acceptable residual variance (transitional, before final pull): <= 60,000ms
- Final-state variance after full convergence rounds: 0ms

## Known Limits

- Transitional variance can exist while one device has not yet executed the next pull tick.
- Convergence guarantee assumes:
  - sync settings valid
  - both devices complete at least one additional sync round after latest write
  - no permanent transport failure

## Reproducible Gate Commands

1. `pnpm --filter @timetracker/sync-r2 typecheck`
2. `pnpm --filter @timetracker/sync-r2 test`
3. `pnpm typecheck`
4. `pnpm lint`
5. `pnpm test`
