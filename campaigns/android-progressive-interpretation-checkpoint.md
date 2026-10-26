# Progressive interpretation checkpoint, 2026-10-26

## Goal and scope
Android-first, independent of Godot. Keep native Android ASR as candidate and retain the existing browser game unchanged until a physical audio/latency trial. An optional small ONNX intent classifier may follow **only if** a held-out test corpus demonstrates value over this safe deterministic baseline.

## Completed
- Google Drive campaign decisions: https://docs.google.com/document/d/1smdV8MQnz1ptJH0ZsxpnVpI9EkNVN4QJfroO0RjISQY/edit
- `src/progressive-interpreter.js`: partial-hypothesis gate with two matching partial observations before early turn commitment, in-memory per-utterance action IDs, final transcript deduplication, missing-angle clarification, conflicting direction rejection, and provisional-fire blocking.
- `tests/progressive-interpreter.test.mjs`: early suborder before trailing clause, numeric omission, malformed angles, fire negation, unstable revised hypothesis, and duplicate prevention.
- PR #15 remains a **research draft**; main/gameplay untouched.

## Known limitations and important safety boundary
Two repeated partial hypotheses are **not** a guarantee of stable ASR: a consistent wrong number can still execute early. This baseline deliberately requires complete bounded direction/angle, but it does not prove safety on noisy input. Real Android service may emit no partials or may revise them. Fire authorization is intentionally not implemented; hold-fire is applied only to final transcripts. Cross-clause resegmentation can move clause indices; this prototype does not yet guarantee semantic command identity across boundary edits. Emergency commands still need a separately validated low-latency gate. Do not promote this module to physical tank commands without extended adversarial tests and actual Android microphone verification.

## Logical next checkpoint
1. Compare this baseline against a trained small intent/slot model on held-out, varied corrupted speech (not training examples).
2. Measure p50/p95 per-hypothesis interpretation latency and first committed turn relative to final ASR.
3. Build native Android partial transcript adapter, log interim/final timing and echo/crew-talk behavior, without Godot integration.
4. Reject the learned model unless it measurably improves semantic recovery with zero critical authorization regressions.

## Acceptance
The campaign is at **prototype test-green / integration-not-approved** once Actions tests and Vite build pass for the exact SHA. No Android or live game result is implied.
