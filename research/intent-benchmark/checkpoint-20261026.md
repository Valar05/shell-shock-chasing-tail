# Intent-recovery research checkpoint — 2026-10-26

Source and results: branch `campaign/android-progressive-intent-20261026`, test run [40314255699](https://github.com/Valar05/shell-shock-chasing-tail/actions/runs/40314255699) at commit `6e247b343ef4b35829c60029a91ed2496ca9d41d`.

## Evidence
- `npm test`, Vite build, headless-browser smoke test and existing real voice fixture browser test succeeded.
- On 16 fixed, varied transcript-corruption examples:
  - Current deterministic interpreter: **14/16** correct labels.
  - Tiny character-trigram nearest-prototype candidate: **8/16** correct labels.
  - Conservative hybrid allowing only narrowly screened HALT recovery: **15/16** correct labels.
  - Critical incorrect authorizations counted: **0**.
- The benchmark deliberately measures interpretation of text, **not ASR accuracy**, real Android latency, or voice echo.
- One extra recovery on a tiny designed corpus is not statistical proof of generalization. The prototype vocabulary and test cases were authored in the same campaign. Held-out independent phrases and a proper learned classifier are needed.

## Design decision
Do **not** adopt the general fuzzy nearest-prototype classifier as command authority. It underperforms the deterministic baseline here. Keep the no-model native-ASR + protected parser architecture. The narrow HALT correction can be explored, but continue to validate false activations.

## Next gate
Train a genuine compact intent/slot classifier on separate synthetic text training data, evaluate on independently composed corrupted and clean phrases including critical negation and numerals, then benchmark a browser/Android prototype for per-partial latency. Promote only with measurable improvement and zero new critical false-authorizations.
