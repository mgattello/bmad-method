# Accessibility report

Target: WCAG 2.1 AA with zero critical violations (NFR4).

## Tool

`@axe-core/playwright` 4.14.0 inside the E2E suite (`e2e/accessibility.spec.ts`), so the audit
runs in `npm run test:e2e` against the built images. Tags: `wcag2a`, `wcag2aa`, `wcag21a`,
`wcag21aa`. The spec fails the run on any **critical or serious** violation and prints moderate and
minor ones.

Negative control: the same audit run against a deliberately bad page (an unnamed button and an
image without alt text) reports `critical button-name`, `critical image-alt`, `serious
document-title` and `moderate page-has-heading-one`, so a real violation does fail the suite.

## States audited

Each state at 360 px and 1280 px (8 audits): Empty State, populated list with an open and a
Completed Todo, validation error (empty submit), and load error with Retry.

## Result

Zero critical, zero serious, zero moderate, zero minor violations in every audited state.

## Findings from the keyboard journey

`e2e/keyboard.spec.ts` drives create, tick, untick and delete with the keyboard only. It found one
defect that axe does not report: a Todo's checkbox is disabled while its write is pending, and a
disabled control drops focus, so after pressing Space the next Space went nowhere and the user had
to Tab from the top. Fixed in `TodoItem`: the control the user used is refocused when the pending
write ends (checkbox after a toggle, Delete after a failed delete). Component tests cover both
cases and the E2E spec now passes.

## Other checks in the suite

- One `role="status"` live region carries load, create, toggle and delete messages
  (`App.test.tsx`, `e2e/error-handling.spec.ts`).
- Every Todo is a list item with a labelled checkbox and a `Delete <description>` button.
- Completed state uses strike-through and a checked control, not colour alone.
- 44 px touch targets for the input, Add, row label and Delete at 360 px
  (`e2e/mobile.spec.ts`).

## Not done: manual checks

These need a person and are not claimed here:

- Screen-reader pass (VoiceOver or NVDA) confirming announcements.
- Manual smoke on current Firefox and Safari (NFR11). The automated suite runs Chromium only.

Both are recorded as open items until someone performs them and adds the date and result here.
