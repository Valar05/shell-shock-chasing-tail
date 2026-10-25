# Shell Shock browser voice: release gate (research, NOT a player build)

Status: RESEARCH ONLY. Branch is intentionally separate from main and GitHub Pages. No field-test request until a genuine candidate clears these gates.

## Nonnegotiable product boundary
One HTML/JS game on static web hosting and on Steam via a local web server; no Android/native-specific game code, mandatory Home Center, Tailscale, cloud recognizer, or developer machine. A web-browser WASM model may download/cache assets. Player can address crew explicitly or issue natural actor-free orders. Existing deterministic command compiler remains the authority.

## Findings, October 24, 2026
1. getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true}}) is capture processing. Confirm settings with MediaStreamTrack.getSettings(). It is NOT an ASR feature. Do not confuse high-pass/compression with music/source separation or claim these cancel TTS echo.
2. Browser-native SpeechRecognition.start(audioTrack) is supported on desktop Chrome/Edge 135+, but not Chrome Android, Samsung Internet, or iOS Safari according to current caniuse. Therefore the excellent recognizer cannot universally accept our processed track.
3. Moonshine Voice @moonshine-ai/moonshine-wasm is the most promising browser-side streaming candidate: current package, ModelArch.MediumStreaming and partial/completed utterance callbacks. Old moonshine-js is deprecated/archived. Investigate LOW-LEVEL Transcriber/Stream API to prove it accepts externally conditioned samples; MicTranscriber.start() alone is not enough evidence.
4. sherpa-onnx WASM supports streaming recognition; viable comparative engine, but one documented bilingual WASM package has ~199MB data and ~10MB binary, so must choose model carefully for phones.
5. Transformers.js Whisper uses WebGPU acceleration where available; potential accuracy challenger but memory/latency/startup and unsupported WebGPU devices make it an unproven universal real-time primary.
6. Chromium issue 555796823 reports severe near-end human-speech suppression when echoCancellation:'all' and playback begins. Do not blindly enable aggressive settings; compare boolean true versus 'all' using double talk.
7. Our current Vosk was explicitly reported atrocious and apparently self-hearing; removing hardcoded grammar has not demonstrated useful accuracy. Do not present as ready.

## Comparative experiment, BEFORE game integration
Capture a consented repeatable set of short spoken orders (clean, music behind, active synthetic crew playback, double-talk commander interrupt, and silence) in browser MediaRecorder/WAV, from the *same conditioned microphone stream*. Save audio and expected transcript locally. The test harness must be outside the playable game and must not publish a Pages player build.

Run these same recordings through (A) existing browser Web Speech as a quality reference where it accepts prerecorded tracks, (B) Moonshine current WASM external sample input, (C) sherpa-onnx WASM streaming, (D) Transformers.js Whisper if performance allows. If the browser-native recognizer cannot accept the recordings on a browser, separately label its live-mic comparison non-equivalent. Measure WER, intent success, word latency p50/p95, cold model load, RAM, CPU, battery and audio dropout. Measure false order activations in 5+ minutes of music and spoken crew-only playback. No manufactured win from synthetic recognizer callbacks.

## Duplex acoustic tests
- Log real capture settings and browser/engine version.
- Compare capture AEC/NS combinations, including true vs 'all' where supported. Avoid claiming suppression when settings are ignored.
- Crew-only audio must never generate orders; commander simultaneous speech must still be heard. Text echo match is defense in depth, NOT substitute for acoustics.
- Retain full-duplex input; do not silently mute the mic during crew speech.
- Freeze utterance IDs and do not concatenate partial revisions into duplicated commands.
- Existing command compiler should choose roles for unaddressed orders; never use ASR phrase grammar to hallucinate a command.

## Hard gates to become release candidate
1. Real-browser audio streams are routed through our *conditioned* source to the selected recognizer, including main mobile Chrome and iOS Safari. Build an automated integration test that confirms actual PCM data flow rather than an injected text transcript.
2. The chosen solution is materially better than user-rejected Vosk in recognized words, AND produces zero executable false orders in the fixed crew-only/no-command corpus.
3. Commander speaks while crew talks, first words survive, crew interrupts naturally and reconvenes from current game state. No speaker self-interruption loop.
4. Complete command phrases are executed once, not multiple times, with no addressee required when action maps uniquely to crew.
5. No mandatory server beyond static files / Steam local web server; assets pinned with license, checksums and caching. Startup and offline behavior measured.
6. CI, browser integration, and at least one real mobile acoustic trial. Do not mark verified from text-injection mocks alone.

## References
https://caniuse.com/mdn-api_speechrecognition_start_audiotrack
https://github.com/moonshine-ai/moonshine
https://moonshine-voice.readthedocs.io/en/latest/quickstart/
https://github.com/moonshine-ai/moonshine-js (deprecated)
https://github.com/k2-fsa/sherpa-onnx
https://github.com/huggingface/transformers.js
https://issuetracker.google.com/issues/555796823
