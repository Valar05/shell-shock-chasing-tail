# Shell Shock: human-recorded speech benchmarks

Four user-recorded utterances, converted losslessly from the decoded M4A audio into **16 kHz mono PCM WAV** for a common ASR input. WAV conversion retains the original encoded recording's audible content; it does not claim to restore lossy compression quality.

The actual first phrase says **30 degrees right**, despite the original uploaded filename containing `40`. The manifest uses the spoken words, not the filename.

This set is intentionally **private**, contains voice biometric material, and is not committed to a public GitHub repository. Please do not publish/share the recordings without the speaker's permission. The script and manifest are included so a private runner can execute the benchmark.

Commands are driving right 30° + tree, driver halt, left 40°, and Beta do not fire. `benchmark.py` supports the tested Sherpa streaming Zipformer 20M and SenseVoice INT8 engines. Install `numpy`, `sherpa-onnx`; download the proper model via official Sherpa-ONNX sources; then run:

```
python benchmark.py --engine zipformer --model-dir /path/to/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17 --output zipformer.json
python benchmark.py --engine sensevoice --model-dir /path/to/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17 --output sensevoice.json
python score.py zipformer.json sensevoice.json
```

These scripts measure **offline decode time on the execution machine**, not live microphone latency. A meaningful comparison with Whisper needs a matching 16 kHz PCM path, identical recordings, and hardware. Command safety requires separate parser validation: missing degrees or missing `not` must fail closed.

The four recordings form a **small smoke-test corpus**, not statistical proof of recognition accuracy across human voices. Add speakers, phrases, distances, crew dialogue and noise only after these baseline failures are identified.
