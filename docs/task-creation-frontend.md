# Tasks: create from the Angular UI

## Implemented scope

The authenticated `/tasks` page embeds a creation form with title, optional description, and priority. It creates through the existing POST contract, then refreshes the first server page. Pagination controls, editing, completion, deletion, and categories are separate work.

No backend endpoint, database schema, migration, dependency, or public HTTP contract changes are required. Successful creation means a validated `201` response, not a local optimistic insertion. Refresh failure does not undo or relabel a confirmed creation.

## Responsibilities and files

Full entry-point paths below are relative to `frontend/src/app/`. Bare creation filenames sit beside `task-create-form.component.ts` in the same `task-create-form/` directory.

- `features/tasks/task-create-form/task-create-form.component.ts` / `.html`: Signal Form, field feedback, submitting guard, clear action, focus after errors, and success/unconfirmed feedback. The component emits `taskCreated` only after confirmed success and `taskListRefreshRequested` for explicit recovery. It owns a component-scoped `TaskCreationService`; injected dependencies stay private.
- `task-creation.constants.ts`: one source for title/description limits, priority options, and the default priority.
- `task-creation.models.ts`: form/request/response/error models; UI text uses strings, while the HTTP request maps blank optional description to null.
- `task-text.normalizer.ts`: .NET-compatible whitespace trimming, not JavaScript `trim()`.
- `task-creation.validator.ts`: Unicode scalar-count limits (200/2000), required normalized title, well-formed UTF-16, single-line title, and control-character rules matching Domain. Description permits tab, CR, and LF. Client checks assist UX; the server remains authoritative.
- `task-creation.service.ts`: copies only the agreed request fields, runs CSRF bootstrap before POST, applies the request timeout, requires `201`, and validates the response. It checks the observed session revision before POST and before publishing success.
- `task-creation-error.parser.ts`: accepts only known, well-formed field errors; distinguishes CSRF/session failures from an unconfirmed outcome. Raw technical details are not displayed.
- `task-creation-response.parser.ts`: validates the saved task including nullable description and active initial state. It uses shared `features/tasks/task-summary.parser.ts`, also consumed by the list parser, without changing existing list-response acceptance rules.
- `core/security/csrf-token.service.ts`: shared, stateless token bootstrap for Auth and Tasks. It requires `204`, disables caching, and bounds each bootstrap request. Existing Auth operations now delegate here; they preserve their HTTP/error/lifecycle behavior.
- `features/tasks/task-list-page/task-list-data.service.ts`: a new request reference explicitly invalidates pre-mutation reads, including an outstanding GET, and starts a fresh first-page read. No unsupported revision query parameter is sent. Ordinary refresh still suppresses duplicate clicks while loading.
- `features/tasks/task-list-page/task-list-page.component.ts` / `.html`: embeds the form, handles outputs, requests list refresh, and returns focus to the page heading. The card remains display-only.

## Call flow

The 2026-10-27 readability refactor keeps the same behavior while giving each step a name. The creation service separates session capture/guards, DTO mapping, POST, and response parsing; `defer` still captures identity only on subscription. The form separates submission, error mapping, success completion, and post-render focus selection. Parsers use sequential guards and field readers instead of compound rejection conditions. Unicode validation and priority selection use named functions. Module-level pure helpers are used for dependency-free checks; no extra facade or service layer was introduced.

Nested ternaries were removed from focus selection, failure messages, and template bindings. ARIA description ids come from a small page helper; their values and messages are unchanged. See [readable control-flow conventions](frontend-conventions.md#readable-control-flow).

Readability verification on 2026-10-27: all 314 frontend tests passed in 25 files; test type checks, full lint, affected-file formatting, and production build passed. An additional temporary differential check compared 133,861 old/new validator and parser outcomes (BMP characters, selected supplementary characters, length boundaries, error payloads, and task responses) with zero differences, including error messages. This is supplementary evidence, not proof for every possible input. The temporary script was removed; existing spec bodies and assertions were not changed. The developer-confirmed `aspage` typo was restored to `page` before checks. Initial bundle is 530.96 kB with existing Sass/budget warnings. Preliminary native tool failures and verified stalled build/test attempts were followed by completed successful checks. No browser/AXE/live API/SQL Server checks were run.

```text
submitTaskCreation
  -> Signal Form validation/submitting
  -> TaskCreationService.createTask
  -> CsrfTokenService.prepareCsrfToken: GET /api/auth/csrf
  -> Angular XSRF interceptor reads fresh cookie
  -> POST /api/tasks: title, description, priority
  -> existing endpoint -> handler -> repository -> SQL Server
  -> 201 + validated saved state
  -> clear form + taskCreated
  -> page -> refreshAfterTaskCreation
  -> cancel obsolete GET if necessary -> GET first page -> render cards
```

The browser sends the existing session cookie with relative same-origin requests. JavaScript does not read the HttpOnly authentication cookie or add a JWT, owner id, or manually copied CSRF header. Bootstrap refreshes the readable request-token cookie; the configured Angular interceptor adds `X-XSRF-TOKEN`.

## Failure and lifecycle behavior

- Field `400` errors stay beside the corresponding field and preserve entered values. CSRF `400` gets a separate message; neither is automatically replayed.
- A Tasks `401` continues through the existing session-expiry interceptor. Loss of confirmed identity removes both the form and list.
- A network/timeout/server error, malformed success response, or observed session change is unconfirmed. The draft stays available and the UI recommends refreshing before retrying. There is no automatic POST retry and no idempotency/exactly-once guarantee.
- Destroying the form cancels its HTTP subscription. Cancellation does not prove database rollback; returning to the list performs a fresh read.
- Session revision checks are local to the Angular instance, not server authorization or cross-tab synchronization. Concurrent cookie changes in other tabs remain an existing limitation.
- A failed GET after a confirmed POST shows a list error while retaining the creation success message. Retrying that GET must not repeat POST.

## Verification and manual acceptance

New specs live directly under `features/tasks/testing/`: validator, normalizer, error parser, response parser, creation service, form, and creation/list integration. They cover Unicode boundaries, normalization, HTTP DTO/header order, malformed responses, field errors, duplicate submits, explicit recovery, session changes, cancellation, and POST-to-GET refresh (including a pending old GET).

Verification on 2026-10-26: all 314 frontend tests passed in 25 files, with one worker selected only for the verification process. Test TypeScript checks, full lint, affected-file formatting, and production build passed. Initial bundle is 530.90 kB against the unchanged 500 kB warning budget; existing Sass deprecation warnings remain. One new test initially asserted pending DOM state before rendering; it was corrected to wait for that state. The validator's control-character check was expressed using Unicode categories to satisfy the lint rule. Some tool launches exited natively or with EPERM; one verified stalled test process was stopped before a separate complete retry succeeded. No dependencies, budgets, persistent test settings, backend code, or database state were changed.

Automated HTTP responses are simulated; they do not verify a running API, browser Set-Cookie handling, SQL Server, or the development certificate/proxy.

Manual acceptance with frontend/backend running:

1. Sign in and open `/tasks`.
2. Submit an empty title: see local feedback with no mutation request.
3. Create with optional description/priority: observe CSRF GET, one POST, and fresh list GET. The new task appears; the form clears.
4. Reload the browser page and confirm persistence. A second account must not see the task.
5. Simulate a failed list GET after POST: retain creation success and retry only the read.
6. Check keyboard labels/focus, Unicode limits, pending controls, and small-screen layout. Browser/AXE/live API acceptance is not claimed by unit/integration results.
