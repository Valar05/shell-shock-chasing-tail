# Shell Shock Android-first recognition laboratory

Standalone Android app, intentionally **not Godot**. Android SDK/Gradle build produces debug APK. Core `RecognitionPort.kt` contains no Godot dependency, so a Godot Android plugin v2 can wrap its `start(preferOnDevice)`, `close()` and `RecognitionEvent` callbacks without changing ASR implementation. Windows/Steam are not in scope.

## Build

From `research/android-asr` using JDK 17 + Android SDK (platform 35), Gradle 8.10.2:
```sh
gradle :app:assembleDebug --no-daemon
```
Expected APK: `app/build/outputs/apk/debug/app-debug.apk`.

**Permission**: microphone; system engine may be remote/cloud based. The on-device button requires Android 12+ and a recognized on-device engine. Unsupported should produce `on_device_unavailable`, not silent fallback to cloud.

## Compare
- Native Android debug APK: buttons for 5 exact prompts; do 20 utterances each per mode, export JSON by Share.
- Mobile browser native Web Speech API: `public/voice-native-benchmark.html`, same command list, 20 utterances each, export JSON.
- Compare *physical* microphone tests on the same phone, voice, room and distance, alternating test order to reduce systematic bias. This is **not same captured waveform**; indicate this in the report.
- Later, desktop browser `SpeechRecognition.start(audioTrack)` may allow controlled same-WAV comparisons where supported. Android Chrome doesn't provide that parameter currently; label unsupported, not failed.
- Whisper comparison: existing `tests/voice-reliability.mjs` is synthetic WAV virtual track and is a different test modality; no direct rankings across unlike samples.

## Scoring
Pair trial `case` with its intended text. Report exact critical-slot recognition (direction, number, target, negation), *fully correct command*, error rate, timeout rate, median/p95 elapsed milliseconds, on-device support, and audio playback/echo false activations. Browser and native results have a common `schema=shellshock.asr.benchmark.v1`, with `rows[]`: `case, engine, transcript, elapsedMs, confidence, error, input` (other diagnostic fields optional). No hardcoded command transformation in recognizers.

**Important:** command parser must reject a numerical order when the quantity is dropped (e.g. "turn right forty degrees" -> "turn right for the debris"). The recognition sandbox never commands tank motion.

## Godot compatibility boundary

`RecognitionPort(context, callback)` and `RecognitionEvent` are pure Android Kotlin; a future Godot v2 Android plugin can call from a Godot UI thread/main looper and emit signals. Requires Godot v2 Android plugin wrapper and Gradle integration **later**. This is an API-design compatibility statement, **not a tested Godot export**.

### Acceptance stages
1. Android debug build green.
2. Physical Android microphone native-system and on-device tests.
3. Browser-native tests on same Android model.
4. Confirm stable confidence, rates, latency, audio overlap, and no unbounded actions.
5. Only then build the Godot adapter and integrate gameplay.
