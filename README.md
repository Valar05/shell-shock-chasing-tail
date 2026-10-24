# Shell Shock: Chasing Tail

First playable experiment: a commander-led armored encounter in Normandy bocage. Alpha designates threats, Beta aims, Gamma loads, Delta drives, and Silver reports. The player does not directly aim the gun.

## Run locally

```bash
npm install
npm run dev
```

Open the localhost URL printed by Vite. `npm run build` checks the production bundle and `npm test` runs deterministic combat-model checks.

## Controls: voice-first

On Android, open the GitHub Pages build in Chrome, tap **Microphone ON**, and speak commands naturally. Listening is a toggle, not a press-and-hold. A final speech-recognition result submits immediately; a partial result uses a three-second silence window. Text input remains an equal supported alternative through the keyboard panel.

Voice and typed commands use the **same deterministic compiler**. Examples include:

- `Driver, advance and turn twenty degrees left` (simultaneous driver movement and finite turn)
- `Driver, turn to bearing 270` (absolute compass heading)
- `Gunner traverse left fifteen degrees` (gun moves independently of hull)
- `Loader armor-piercing, then gunner fire` (ordered dependency)
- `Driver halt when gunner reports locked` (real-time conditional)
- `Silver, enemy at three o'clock` (hull-relative contact check)

Commands are parsed into atomic intent frames before any game-state mutation. Unrecognized or conflicting instructions reject the entire utterance with an explicit diagnostic. Autonomous routes to named landmarks are not yet implemented; the parser reports `ROUTE_UNAVAILABLE` rather than interpreting them as indefinite driving.

Pointer drag controls the independent first-person periscope. Left/right vehicle rotation has a dedicated browser projection test because mathematical heading assertions alone previously missed a mirrored first-person view. Three.js is retained; external objects are temporary flat sprites.

See [parser architecture and source provenance](campaign/command-compiler-port.md) for the original compiler references, supported grammar, current limits, and verification gates.

Canonical concept: https://docs.google.com/document/d/1LtIISOElui7o2JLqtFDG6F3w2Ivduinih-crLTIjJvw/edit
Campaign rules: https://docs.google.com/document/d/1wntegQjw7238dmGqbvs9TQmlsp4uXdXw7_wPciNx6sI/edit

## Evidence status

Code authored to GitHub does not establish a tested browser build or a device-accepted game. See `campaign/contract.json` and `AGENTS.md` before modifying or deploying.
