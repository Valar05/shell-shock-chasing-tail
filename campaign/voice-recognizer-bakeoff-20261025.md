# Voice recognizer bakeoff: 2026-10-25
Status: research only; NOT a new game release, deployment, or acoustic success claim.
Baseline main at branch creation: a791646e90691487c64948054d614659f192b772.
Primary owner fixture (actual synthesized audio, not just a text callback): "rotate 30 degrees and run over that tree." Reported dramatic transcription/listener failure. Do not replace this with the easy one-word "stop" sample.

## Confirmed source facts
- src/moonshine-speech-recognizer.js uses ModelArch.SmallStreaming, updateInterval .45, and low-level external audio path from createFilteredSpeechInput. Final line callbacks drive issue(text).
- src/filtered-speech-input.js requests browser AEC/NS/AGC and then 110 Hz HPF and compression. Neither filter distinguishes game speaker playback from commander voice.
- src/command-parser.js classifies `rotate 30 degrees` as TURN but requires left/right; the text-only version should produce MISSING_DIRECTION. `run over that tree` is separately recognized as CRUSH_TREE. Check runtime behavior with a deterministic test before any parser repair. Do NOT infer left/right.
- src/main.js can issue each Moonshine final separately. Keep verbatim partial/final transcript, line ID, timestamps, parse frames/errors, and dispatched actions distinct. Do not mistake semantic rejection for WER.
- Current existing real-audio smoke only verifies human-recorded STOP; it does not test the commissioned compound phrase.

## Competing recognizers (no winner declared)
1. Transformers.js Whisper Base.en (or suitable quantized smaller variant): plausible accuracy challenger on whole voice-activity segmented utterances; check actual mobile latency, memory and WebGPU availability.
2. Moonshine MediumStreaming: cheap controlled upgrade; compare exact same audio bytes, segmentation, and decoding with Small before considering continued use.
3. sherpa-onnx English Zipformer WASM: independent streaming architecture; quantify model download/memory and phrase accuracy.
4. Native browser Web Speech: quality reference when microphone available; pre-recorded processed-track injection is not universally supported, especially Android/iOS. Label comparisons non-equivalent when appropriate.
5. Whisper Tiny.en: smaller fallback benchmark only, not assume higher accuracy.

References:
- https://moonshine-voice.readthedocs.io/en/stable/models/accuracy/
- https://huggingface.co/docs/transformers.js/main/guides/webgpu
- https://k2-fsa.github.io/sherpa/onnx/wasm/hf-spaces.html
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally

## Bounded experiment contract
1. Preserve exact owner-generated reference WAV bytes if recoverable. Capture SHA-256, sample rate, channel count, duration, amplitude, and reference transcript. If unavailable, regenerate a *clearly different* synthetic fixture with exact voice/config provenance; do not claim it is the historical failing clip.
2. Run parser-only tests: exact phrase, `turn right 30 degrees and run over that tree`, `turn left thirty degrees and run over that tree`, `heading 30 degrees then run over that tree`. Record raw parse frames/errors, explicitly distinguish ambiguity.
3. Feed identical WAV PCM (not mock transcript) independently to all feasible recognizers. Record raw partial/final transcript, segment boundaries, duplicates, WER, intent coverage, missing/changed negations and numerals, load/peak memory and latency. Avoid a phrase-restricted ASR lattice.
4. AEC/crew echo is a separate physical-acoustic gate: replay crew-only, music-only, silence, and overlapping commander+crew through real devices; measure false orders and first-word survival. Direct WAV injection BYPASSES physical speaker-to-mic echo, so cannot prove AEC.
5. Adopt an engine only if its *measured* complex-order intent success and mobile feasibility improve the baseline and it does not regress barge-in/crew-only safety. Small synthetic fixture pass is necessary but not sufficient.
6. No intermediate player build or Pages deploy. Work only in this branch until production checks justify a single candidate. No assumption that CI success demonstrates natural speech or mobile playback.

## Stopping rules
At most two identical failures per hypothesis before inspecting traces and changing method. If Moonshine Medium still fails the phrase with identical PCM, stop Moonshine tuning and prioritize Whisper and sherpa. Preserve objective results even if every candidate fails.
