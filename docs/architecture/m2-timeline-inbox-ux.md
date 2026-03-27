# M2-05 Timeline + Inbox UX

## Goal

Speed up classification and reclassification workflows while preserving existing annotation and rule-application semantics.

## UX Improvements

### Event Timeline Row

- Added one-click category chips (`工作 / 学习 / 娱乐 / 杂务`).
- Added quick tag chips (`coding / meeting / review / docs / research`).
- Kept manual inputs for category and tags.
- Save action now supports direct submit from the form.

### Pending Inbox Row

- Added suggested one-click action based on resource signal inference.
- Added quick category chips for batch apply.
- Kept manual category/tags edit path and submit button.
- Updated helper copy to clarify 1-step and 2-3 step paths.

## Step Count Target

- Fast path: 1 step (click suggested category apply).
- Guided path: 2 steps (click preset, optional confirm).
- Manual path: 3 steps (set category, set tags, apply).

## Compatibility

- Existing `annotateEvent` and `applyInboxRule` contracts are unchanged.
- Existing data model and summary pipeline are unchanged.
- Non-classification features are unaffected.
