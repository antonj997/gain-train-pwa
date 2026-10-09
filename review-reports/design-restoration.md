# Gain Train design restoration

9 October 2026. The owner requested the original design with the quality-of-life improvements and bug fixes retained.

## Reference and changes

GitHub Pages was inspected directly, and origin/main was fetched with Windows certificate verification enabled. The reference is commit `3d2514862f7babecb964eb01b09230d804b86e77` in [gain-train-pwa](https://github.com/antonj997/gain-train-pwa), matching the [live design](https://antonj997.github.io/gain-train-pwa/).

- The original `src/index.css` and six app-icon files in `public/` were restored byte-for-byte from this reference.
- Restored blue accents, navy/light-grey themes, rounded cards and inputs, selected navigation backgrounds, original theme-switch colors, full Gain Train header, and the original Home heading/date treatment.
- Restored browser/PWA colors and product title/description. The removed unrelated social-image metadata remains removed; bundle splitting remains enabled.
- New controls use `src/styles/usability.css`, loaded after the original stylesheet. It supplies responsive load/measure fields, routine planning, inline validation, completed-value readability, a subtle next-set cue, rest controls, saved status, mobile touch targets, and safe-area spacing in the existing visual language.
- All functional code and fixes documented in the earlier implementation report remain. No migration, record rollback, dependency change, push, or deployment was performed. Existing package-lock changes remain preserved.

## Verification

- Typecheck passed. Tests: 61 total, 60 passed, one live-cloud integration test skipped, zero failures.
- Lint: zero errors; three existing React Fast Refresh export warnings.
- Final production build passed, including PWA precache generation and restored icon/manifest assets. Git whitespace check passed.
- Byte comparison confirmed the original stylesheet and all six icons exactly match origin/main.
- Browser checks covered 320px and 390px phone layouts and a 1280px desktop viewport, both themes, Home, workout editing, planned routines, picker, progress/session links, history details and settings. Set type selects show one custom arrow and suppress the native arrow.
- A disposable local workout verified immediate set deletion, confirmation for an exercise with entered values, immediate deletion after clearing all values, and abandonment before finishing. The resulting toast appeared at the top with mobile side margins. No live-account workout was changed.
- The 320px workout rows fit without horizontal overflow. Load selects wrap when necessary rather than clipping text. Routine headings wrap between words; the dialog fits at 296px wide. Desktop app width was confirmed at 800px.
- Independent review found two invalid full-page capture artifacts and a settings alignment gap. The artifacts were replaced with native viewport captures checked against DOM dimensions; settings alignment was corrected and checked. The reviewer returned **Ship**, with all listed findings resolved.

## Limits and current preview

Live cloud/authentication and physical-phone checks were not repeated for this visual restoration. The local preview remains available at http://127.0.0.1:8082/. GitHub Pages still runs the published version.

Final screenshot evidence is in `C:/Users/anton/.codex/visualizations/2026/10/08/01a11c59-797a-7410-99ef-59d2aadc1707/`: `restored-home-desktop-light.jpg`, `restored-routine-320.jpg`, `restored-home-mobile-dark.jpg`, and `restored-workout-mobile-dark.jpg`.
