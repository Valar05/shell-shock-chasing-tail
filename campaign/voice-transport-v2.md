# Shell Shock voice transport v2: local, duplex, noise-aware

## Decision
Replace browser Web Speech Recognition as the primary input, while retaining Three.js and existing deterministic command/order-graph compiler. The browser's SpeechRecognition API accepts neither an application-supplied processed audio stream nor a reliable playback-reference signal. Filtering transcripts alone cannot guarantee that crew speech or music won't be interpreted as commander orders.

Keep the game on GitHub Pages for rendering, with an optional LOCAL streaming ASR service reached by the phone through a secure Tailscale route. Do not route continuous PCM or transcripts through Home Center/cloud token services. No LLM inference or GPU-intensive local model should be required just to command the crew.

## Intended signal architecture
1. Phone browser obtains a mono microphone MediaStream through getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}}); inspect the actual MediaStreamTrack.getSettings() to see whether constraints took effect.
2. AudioWorklet converts frames to mono 16 kHz PCM with timestamps and sequence numbers. Worklet only handles capture/resampling, not parsing or game decisions.
3. A local streaming ASR service (candidate: sherpa-onnx online streaming server, chosen after CPU/latency validation; compare lightweight Vosk and whisper.cpp server variants) receives framed PCM via wss:// over Tailnet. No repeated HTTP requests, scraping, or accumulating the entire recording in a browser page.
4. Run VAD and speech segmentation server-side. Keep per-utterance partial revisions and ONE final transcript with utterance ID, timestamp, sequence, confidence or alternative hypotheses when the model exposes them.
5. Local transcript collector merges revisions by utterance ID, never by concatenating hypotheses from consecutive callbacks. It can wait for a natural 250-500 ms trailing grace to combine compound commands, with up to ~3 sec for an unfinished thought. Deduplicate on utterance ID.
6. The existing parser compiles full packets and validates actor, intent, arguments, inter-command dependencies and execution safety. ASR confidence is not permission to execute an unsupported action.
7. Browser crew speech and later Pocket TTS playback are fed through a single audio coordinator. For reliable echo cancellation, support a *real playback reference* in a configurable DSP backend, or hardware/browser AEC when validated on Android. Text-matching crew echo is a secondary failsafe, not acoustic suppression.
8. Commander speech has priority: detect speech onset (VAD), interrupt crew playback, continue ASR on the commander speech, then recompute relevant reports against game state. Do not mute the mic while speaking.
9. Keep the current browser-SpeechRecognition mode temporarily as explicitly labeled fallback, not as the silently chosen production transport.

## Reality checks
- Browser AEC, NS and AGC constraints are requests, not guarantees. Even if getSettings() reports them, test output over phone speaker while music plays and crew is speaking.
- Web Speech and native SpeechSynthesis do not guarantee application-controlled audio streams. Recorded Pocket TTS playback (Web Audio) later makes an explicit playback reference more practical.
- Client-side denoising alone does not solve two simultaneous human/speaker voices; do not claim perfect full-duplex sound without testing.
- Static GitHub Pages cannot host the local ASR backend. Provide clear server offline/reconnect status, avoid infinite reconnect loops, and do not bill a cloud streaming service.
- Keep the existing deterministic game simulation; the recognizer supplies text, not world knowledge. "Run over that tree" is a navigation-intent task and requires target binding/pathfinding, independent from speech capture.

## Required end-to-end acceptance gates
- Real Android landscape speaker playback + simultaneous commander barge-in: speech heard, crew interrupted, order executed once, crew response freshly resolved.
- Distinct background music and actual human voice: music does not produce orders or suppress the commander; report false positives and misses.
- Multiple compound spoken orders, including pauses, filled hesitations, multiple recipients, "driver" repeated from ASR partials: one stable compiled graph.
- Microphone remains on and recovers after phone screen rotation, temporary service interruption and TTS completion.
- Measure end-of-speech to acknowledged action latency (p50, p95), command error rate, false barge-ins, and streaming CPU and network throughput on phone and server.
- Simulate out-of-order/drop/reconnect WebSocket frames and VAD transitions; reject stale/duplicated commands.

## Deliverables before shipping as default
- Versioned WebSocket transcript protocol and reference stream captures.
- AudioWorklet capture/resampler with getSettings() diagnostics.
- CPU-tested local streaming ASR service with explicit model checksum, memory limits and Tailscale authentication.
- Replayable speech corpus and automated tests for segmentation, reconnect and echo/music contamination.
- Phone field validation. Green unit tests alone are not final acceptance.
