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

## Browser debugging in T3 Code

1. Verify Node and npm before starting servers. If PowerShell cannot find them, refresh the current process environment and retry:

   ```powershell
   $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
   node --version
   npm.cmd --version
   ```

2. Start `npm.cmd run dev` if port 5173 is not already serving this project. The dev script uses Vite's runner config loader because the default esbuild config bundling can fail with parent-directory access denied in the Windows sandbox. Start the Worker too when testing rooms or multiplayer.
3. When T3 Code exposes `preview_*` tools, call `preview_status` first. If no automation-capable tab is attached, call `preview_open`; an unopened preview is not evidence that browser automation is unavailable.
4. Navigate with `preview_navigate` using `target: { kind: 'environment-port', port: 5173 }`. Inspect with `preview_snapshot`, use its locators for interactions, and use `preview_evaluate` for live page state. A successful setup loads Garanto and permits a snapshot and JavaScript evaluation.
5. If navigation fails, inspect the returned error, preview status, and server output; correct the cause and retry. Use another browser system only if these tools are absent, `preview_open` explicitly reports unsupported/unavailable, or the user requests it. Report breakpoint debugging separately: preview inspection does not imply that breakpoint/step-through debugger tools are available.

The browser tab, running servers, and refreshed `PATH` are session-local; repeat the relevant steps in each new session.

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
