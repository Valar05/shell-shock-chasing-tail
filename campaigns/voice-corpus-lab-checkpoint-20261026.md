# Voice Corpus Lab checkpoint — 2026-10-26

## Intended user experience
Phone-browser page displays 16 prompts; user speaks each into the mic. Original microphone audio is captured by MediaRecorder and saved as Blob in IndexedDB. Android/browser recognizer partial and final transcripts and timestamps are stored independently of the intended and editable spoken text. "Copy text batch" copies JSON, never audio. No audio uploaded.

## Test gates
1. Vite build, game smoke and voice tests remain green.
2. Dedicated headless Chromium microphone integration test (`tests/corpus-browser-smoke.mjs`) uses Chromium's fake media device, records actual nonempty audio into IndexedDB, checks persistence across page reload and checks text JSON download.
3. Real Android microphone + browser native ASR simultaneous mic capture is a separate unverified gate. Chromium fake device success is not hardware proof.
4. IndexedDB is origin/browser-local and can be evicted. Saving a downloaded recording to Android Download directory is the durable-user-access path. A later Termux transport campaign may collect durable recordings without manual slicing or uploads.
5. No production claims until CI gate is complete and URL is actually published. Web Speech recognition is a platform service and cannot be assumed available offline.

## Risks and next iteration
* Multi-file audio download is clumsy and may require browser permission. Add an archive export or an Android/Termux durable storage adapter before large recordings.
* Device/browser may fail concurrent MediaRecorder and native Web Speech recognition. Preserve audio, log the recognition error, do not discard the sample.
* Prevent overwriting/editing raw recognizer hypotheses, and document captured text vs spoken-truth correction.
* Give local storage explicit quota/export checks and a one-session batch receipt.
