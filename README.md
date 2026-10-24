# Shell Shock: Chasing Tail

First playable experiment: a commander-led armored encounter in Normandy bocage. Alpha designates threats, Beta aims, Gamma loads, Delta drives, and Silver reports. The player does not directly aim the gun.

## Run locally

```bash
npm install
npm run dev
```

Open the localhost URL printed by Vite. `npm run build` checks the production bundle and `npm test` runs deterministic combat-model checks.

## Controls

Mouse/touch drag: turn periscope independently of hull and gun. Use the command text field or crew-order buttons to issue orders. Example: `delta advance`, `delta halt`, `beta acquire`, `gamma load ap`, `beta fire`, `delta reverse`. The crew execute orders instead of the user steering or pointing the gun.

Prototype visuals are replaceable geometry and simple sprites, not final artwork. No interior or romance assets in this first combat experiment.

Canonical concept: https://docs.google.com/document/d/1LtIISOElui7o2JLqtFDG6F3w2Ivduinih-crLTIjJvw/edit
Campaign rules: https://docs.google.com/document/d/1wntegQjw7238dmGqbvs9TQmlsp4uXdXw7_wPciNx6sI/edit

## Evidence status

Code authored to GitHub does not establish a tested browser build or a device-accepted game. See `campaign/contract.json` and `AGENTS.md` before modifying or deploying.
