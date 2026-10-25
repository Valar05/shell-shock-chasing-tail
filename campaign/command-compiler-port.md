# Shell Shock command compiler campaign

## Authoritative sources reviewed
- [Shell Shock GDD](https://docs.google.com/document/d/1LtIISOElui7o2JLqtFDG6F3w2Ivduinih-crLTIjJvw/edit): voice-first crew command, independent roles, bounded deterministic compiler, example conditional driver halt.
- [Tanks for the Memories command compiler](https://github.com/Valar05/tanks-for-the-memories/blob/master/src/command-compiler.ts): strict recipient/route registry, rejects malformed transmissions and **all** compound joins. Preserve fail-closed doctrine but don't copy the one-action constraint into this game.
- [Truth First RPG v6.3 parser](https://github.com/Valar05/truth-first-rpg/blob/main/artifacts/truth-first-command-part1-v6.3-standalone.html): normalize, split into explicit clauses and intent frames, maintain actor discourse, distinguish WHILE from AFTER dependencies, compile before execution, late-bind physical predicates.
- [Truth First parser stress suite](https://github.com/Valar05/truth-first-rpg/blob/main/tests/parser_stress.mjs): table-driven positives/negatives, error codes, repeated deterministic compilation. The new stress corpus follows this method.

## Implemented in Shell Shock

`src/command-parser.js` is pure and deterministic. `parseTransmission(text, priorDiscourse)` returns a normalized utterance, actor-linked frames, typed parameters, declared relations/dependencies, updated actor context, and specific errors. An error rejects the *entire* transmission. No recognized first clause may silently execute while later words are discarded.

`src/model.js` owns simulation execution. Commands compile into an order packet; FIRST/CONCURRENT orders start together, THEN orders depend on completion, WHEN/ONCE predicates defer an order, UNTIL predicates terminate active orders, IF predicates gate orders. The next physical state is checked at simulation time rather than being guessed at parse time.

Crew routing is strict: Delta drives/turns, Beta traverses/acquires/fires, Gamma loads, Silver reports, commander/Beta/Silver may designate bearings. Voice recognition and keyboard input use exactly the same interpreter.

### Examples
- “Driver advance and turn twenty degrees left” executes moving plus a 20-degree bounded left turn.
- “Driver turn to bearing 270” is an absolute heading, distinct from “turn left 20 degrees”.
- “Gunner traverse left 15 degrees” turns the gun independently of the hull.
- “Loader armor-piercing then Gunner fire” waits for loading before issuing fire.
- “Driver halt when gunner reports locked” queues a conditional stop until the gunner's real laid state.
- “Driver advance until contact confirmed” drives until an actual confirmed contact.
- “Silver, enemy at 3 o'clock”, “Beta bearing 090”, and “Alpha, enemy on our right” designate from clock/compass/relative reference only if line of sight confirms contact.

### Safety/coverage boundaries
- The grammar is bounded rather than an open-domain language model. Incomprehensible, contradictory, incorrectly routed, or unsupported conditions reject the entire packet without movement.
- Named-waypoint autonomous navigation (“drive to the orchard”) is recognized as a requested route but explicitly rejected as ROUTE_UNAVAILABLE. The compiler must not silently convert it into indefinite forward motion.
- A non-terminating order cannot be followed by THEN without an explicit completion condition or distance.
- This initial domain adapter does **not** reproduce every infantry scenario action from Truth First. Terrain reports, formation-level actions, and conversation/romance dialogue are separate future capabilities.
- Browser synthetic microphone input and first-person visual direction are CI gates. Speech recognition behavior on the user's physical Android browser still requires human acceptance.

## Validation gates
- `npm test`: original deterministic tests plus large compound command and mutation/negative corpus.
- `npm run build`: production bundle.
- `node tests/browser-smoke.mjs`: actual Chromium, landscape bounds, WebGL, visual projection shift on driver-left, and synthetic toggle-microphone compound speech execution.
- `pages.yml`: deploy only if prior tests pass.

Do not declare the physical phone experience accepted solely from green CI. Keep scene, first-person camera and Three.js intact; 2D sprites remain the art medium.

## October 24 speech hardening campaign

The v6.3 parser's `splitActorSubjects` routine has been adapted directly to Shell Shock's crew roster, including an additional guard against splitting subordinate clauses such as “when gunner reports locked”. Other v6.3 concepts (intent frames, discourse state, relation/dependency graph, late-bound predicates) are domain adaptations. The entire infantry-specific v6.3 grammar is **not** claimed as a drop-in port.

Speech recognition now feeds `src/speech-packetizer.js`, not individual instant command calls. Continuous Web Speech API transcripts can contain multiple final result slots plus changing interim slots. The packetizer merges these into an atomic utterance, waits approximately 420 ms after a complete final to gather adjacent final fragments, and retains a three-second thinking window for interim or incomplete speech. Switching the microphone off flushes its pending packet once. Fuzz and packetizer tests are deterministic and run in GitHub Actions; only actual Android microphone performance remains outside the automated acceptance evidence.

`tests/speech-mutation-corpus.test.mjs`, `tests/parser-property-fuzz.test.mjs`, and `tests/speech-packetizer.test.mjs` add broad ASR typo mutations, multi-recipient packets, malformed multi-command atomic rejection, repeated parse determinism, delayed/segmented finals, and no duplicate submission. Unrecognized vocabulary is rejected rather than freely “interpreted” as action.
