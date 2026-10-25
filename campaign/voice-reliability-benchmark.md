# Voice reliability benchmark (October 25, 2026)

Research only. Baseline 8bc23c1342705c851a7d3d19f1d58963aa9f2a06. Do NOT merge or deploy based on one successful synthetic command.

## Questions
1. Does the same audio yield stable word/intent recognition across repeat passes? Measure numerals, left/right, targets, verbs individually, plus full game intent and timeout.
2. Is loss introduced at mic capture/VAD or is it a model language-decoding error? Keep original PCM, beginning/end padding, split intervals, and raw transcripts; compare direct PCM -> Whisper with full virtual-microphone -> conditioner -> VAD -> Whisper.
3. Is native SpeechRecognition superior on equivalent PCM? Chrome/Edge desktop version 135+ may support start(audioTrack); mobile Chrome and iOS Safari do not. A native mic-only run on mobile is NOT a fair identical-PCM A/B comparison. Never inject fake result events.
4. How do crew playback, music, and double talk affect false positive commands? These require physical speaker-to-mic acoustic capture, not virtual input.

## Initial reproducible execution
Install dependencies with `npm install --no-audit --no-fund`, `npx playwright install chromium`, `espeak-ng`; run `VOICE_TRIALS=5 node tests/voice-reliability.mjs`. It synthesizes actual WAV files and injects the audio *through a MediaStreamTrack*, with the game and recognizer otherwise real. Each trial logs transcript, slot pass, complete-game intent pass, time, errors. Synthesizer data is NOT original owner's voice or physical mic echo. Store full logs and summary.

## First bounded improvement experiments (only after baseline)
A. Pre-roll: ring-buffer at least 350 ms of PCM prior to threshold crossing.
B. End detection: 700-1000 ms trailing audio, preserving the last word; compare threshold .013 to context-adaptive noise floor.
C. Decode: utterances once only, keep full raw transcript and parser result; no accidental duplicate command from callbacks.
D. Engine: compare Whisper Base.en to native SpeechRecognition on identical PCM on supporting desktop browsers. If the native audioTrack parameter is unsupported, label unsupported, do not replace with a fabricated injection.
E. Real device: 20 utterances each quiet, game music, crew-speaking, commander+crew simultaneous; record model/device/browser, exact text, intent pass, false command count, p50/p95 latency, startup and offline behavior.

## Acceptance gates
- Target at least 95% exact intent execution on representative *distinct* human voice phrases, with numerals and negations exact. Synthetic repetitions expose instability but do not alone establish real-world accuracy.
- 0 executable false commands during 5+ minutes of crew-only audio and silence.
- 0 incorrect directional/numeric safety-relevant orders; if transcribed uncertain, fail closed.
- Barge-in while crew speaks, preserve first words, no lost final words, mobile performance acceptable.
- Publish to existing Pages only after reliable hosted actual-PCM tests and physical microphone validation; preserve main until evidence supports it.

## Known prior receipts
- GitHub hosted run 40210435382: actual Moonshine human STOP through game passed, first hosted Whisper run blocked by missing eSpeak test tool.
- CI 40210621559: Whisper direct PCM test passed but integrated utterance produced "30 degrees to the left and run over at 3" and correctly rejected invalid tree target. This demonstrates error, not field acceptance.
- Prior CI 40204706216: integrated command had correctly executed both actions once.
