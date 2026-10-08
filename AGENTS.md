# AGENTS.md

Guidance for coding agents working on Garanto, a 3D multiplayer card game (Three.js + WebRTC, with rooms and signaling on Cloudflare Workers / Durable Objects). User-facing text, the README and test names are in Brazilian Portuguese; code, identifiers and comments are in English.

## Setup and commands

- Node 22.12+ is installed on the machine and available through the system/user `PATH`. Use the installed `node` and `npm`; verify with `node --version` and `npm --version`. If an existing terminal has a stale `PATH`, reopen it or refresh its environment. In PowerShell, use `npm.cmd` when script execution policy blocks `npm.ps1`.
- `npm run check` — Prettier check, ESLint, `tsc` for every project, unit tests. **Must pass before you finish.**
- `npm run format` / `npm run lint:fix` — auto-fix formatting and fixable lint.
- `npm run build` — production bundle (Vite).
- `npm run dev:cloudflare` (Worker on :8787) + `npm run dev` (Vite on :5173, proxies `/api`).
- Integration tests need the Worker running:
  - `GARANTO_INTEGRATION_URL=http://localhost:8787 npm test` (API/WebSocket).
  - In the browser console on :5173: `await import('/tests/browser.integration.ts').then(module => module.run())` (real WebRTC, host migration, reconnection).

## Layout

| Path | Responsibility |
| --- | --- |
| `src/game/` | Pure rules. No DOM, network or `Date.now()` calls beyond defaults: time and randomness are injected (`Clock`, `RandomSource`). |
| `src/net/` | `Session` (host/guest logic, epochs, migration), signaling socket, `PeerLink` (WebRTC), peer message parsing, tab storage. |
| `src/scene/` | Three.js scene. `tableScene.ts` orchestrates; `cameraRig.ts`, `input.ts`, `tableCards.ts`, `hands.ts`, `robot.ts`, `room.ts` are self-contained. |
| `src/ui/` | `app.ts` controller with a `data-action` → handler map; views in `views/` return `SafeHtml`. |
| `src/shared/` | Types shared by browser and Worker (`protocol.ts`). |
| `worker/` | `Lobby` Durable Object (`lobby.ts`), HTTP helpers, rate limits (`rateLimit.ts`, `tokenBucket.ts`). |
| `tests/` | `node:test` via `tsx`. `*.test.ts` run in `npm test`; `helpers.ts` has seeded matches. |

## Code style (enforced by ESLint — do not disable rules to get green)

- TypeScript strict with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. No `any`, no non-null assertions; use `assert.fail(...)` / narrowing in tests.
- Readability limits: cognitive complexity ≤ 10, cyclomatic ≤ 12, ≤ 70 lines per function, ≤ 400 lines per file, ≤ 4 parameters (use an options object), max nesting 3. When over a limit, extract a well-named helper instead of compressing code.
- Descriptive names (min 2 chars; `x`, `y`, `z`, `i`, `j`, `_` allowed). Name constants instead of magic numbers when the meaning is not obvious.
- Comment the *why* in non-obvious places (protocol edge cases, animation math); don't narrate obvious code.
- Prettier formats everything, including `src/style.css`.

## Invariants — keep these when changing code

- **Rules are pure:** `applyAction(state, actorId, rawAction, clock?)` never mutates its input; it returns the same object when nothing changed, otherwise a clone with `version + 1`. Invalid moves throw `RuleError` (message shown to players).
- **Never trust peers:** states from other browsers go through `sanitizeState`, actions through `parseAction`, peer envelopes through `parseEnvelope`.
- **No raw HTML:** build markup with the `html` tagged template (escapes interpolations). `trustedHtml` is only for constants such as icons. Update the DOM with `morph`, never by assigning `innerHTML` on `#app`.
- **Host epochs:** every host change bumps `epoch`. A state from a newer epoch always replaces the local copy, even with a lower `version`.
- **Scene cards are keyed by card id**, so a card moves between table and pile instead of being recreated. Camera orientation is computed from target position/up and slerped; never lerp `camera.up`.
- **Worker limits:** per-socket token bucket (burst 300, 60/s) for signaling, per-IP limit on room creation, caps on open and stored rooms.

## Workflow tips

- When changing the development inspection scene or its controls, read `docs/sala-de-testes.md` for access, shared modules, movement limits and validation steps.
- Add or update a unit test in `tests/game.test.ts` for any rule change; use the `startedMatch` / `completeRound` / `seededRandom` helpers from `tests/helpers.ts`.
- Run `npm run check` after edits; run the integration tests when touching `src/net/` or `worker/`.
- Do not commit, deploy (`npm run deploy`) or touch Cloudflare secrets unless explicitly asked.
