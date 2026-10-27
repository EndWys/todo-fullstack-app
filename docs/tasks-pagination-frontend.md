# Tasks: URL-driven server pagination

## Scope and URL rules

The existing `GET /api/tasks` contract is unchanged. The Angular page requests only the selected server page; it does not load all tasks or slice them locally.

- `/tasks` defaults to page 1 and size 20 using the existing feature constants.
- `/tasks?page=2&pageSize=10` restores the selected view on direct navigation, refresh, and Back/Forward.
- UI query values are unsigned decimal digit strings within Int32. Leading zeros are accepted numerically. Missing parameters use defaults; empty, duplicate, unsupported, fractional, signed, exponent-form, or overflowing values are invalid. Unknown query names are invalid while filters remain unimplemented.
- Invalid URL parameters show safe local feedback and a Reset pagination action without a Tasks GET. Reset replaces the invalid history entry with page 1 / size 20. This does not change API-side validation rules.
- User page/size changes create history entries. Size changes reset the page to 1. The URL is authoritative: controls navigate, and route changes configure the read service.

## Responsibilities

Paths below are relative to `frontend/src/app/features/tasks/`.

- `task-list.models.ts`: readonly pagination models, parse state, and supported page-size type derived from the existing constants tuple.
- `task-list-pagination.constants.ts`: default/first-page values, supported sizes, and the server Int32 limit shared by URL and response readers.
- `task-list-page/task-list-pagination.parser.ts`: pure conversion of untrusted `ParamMap` values into valid pagination or a safe error. It neither navigates nor sends requests.
- `task-list-page/task-list-page.component.ts` / `.html`: subscribes to route query changes with automatic destruction cleanup, supplies the service, handles navigation/reset/focus, and displays parameter/navigation errors. No HTTP request is sent by the page.
- `task-list-page/task-list-data.service.ts`: page-scoped request state and `httpResource`; structurally parses unknown JSON and exposes ready data only when status and page metadata match the requested selection. Equal selections do not refetch. Parameter changes cancel older reads, and loss of confirmed identity immediately hides old results.
- `task-list-pagination/task-list-pagination.component.ts` / `.html`: presentational inputs and outputs, labelled size select, First/Previous/Next/Last buttons, and derived page count. No Router, Auth, HTTP, global store, or separate writable page selection.
- `testing/`: parser, presentation, service, and Router/HTTP integration checks remain separate.

```text
pagination action -> page -> Router URL change
  -> queryParamMap -> pure parser -> setPagination
  -> httpResource GET -> response parser/status/metadata checks
  -> ready state -> task cards and pagination controls
```

The synchronous route subscription applies initial query parameters before the resource dispatches its first request. The service's request signal is a projection of URL parameters, not a second independently editable UI selection. Manual refresh changes no URL parameters; it reissues only GET.

The installed Angular resource implementation returns from its loader when parameters become undefined without aborting the previous pending load. `setPagination(undefined)` therefore explicitly calls the public `resource.set(undefined)` API to clear/abort that read. Tests cover cancellation and recovery; keep those checks when upgrading Angular rather than relying on idle-transition assumptions.

## Empty results, writes, and failures

- Zero results on page 1 display the normal empty state, with no "Page 1 of 0" label. Size selection remains available.
- Empty items on another page display "No tasks on this page" and recovery controls, not a claim that the account has no tasks. The backend's requested page is not silently clamped. Previous returns to the nearest available earlier page when the requested page is beyond the count; First/Last also allow recovery.
- Count and items are not promised to be a transactional snapshot. No automatic redirect/retry loop is based on count alone.
- Confirmed creation on page 1 invalidates even a pending read. From another page it navigates to page 1, retains the selected size, and lets that route change trigger one fresh GET. The form instance survives query-only navigation.
- Read-only recovery after unconfirmed creation refreshes the current page and preserves the URL/draft. It never resends POST or claims rollback.
- Ordinary Refresh/Try again stays on the current page and suppresses duplicate refresh while loading. Loading hides old cards. Query changes still cancel pending reads.
- Existing relative-API cookie, CSRF bootstrap for POST, and session-expiry interceptor behavior are unchanged. GET pagination does not bootstrap CSRF or send owner selection.
- Router failure displays a safe navigation error without pretending that the requested page loaded.

## Verification (2026-10-27)

All 382 frontend tests passed in 28 files, including 68 added pagination cases. Production build, full lint, test TypeScript checks, and affected-file formatting passed. The initial bundle is 532.07 kB; existing Sass and 500 kB budget warnings remain. No dependencies, budgets, backend code, or database state changed. Preliminary native crashes, esbuild failures, and a worker-start failure required retries; a verified stalled test attempt was stopped. The final full suite ran with one worker only for that process, without persistent configuration changes.

The new tests initially exposed incorrect native select initialization and a non-aborted idle transition; both were fixed in production code. Router integration uses actual app routes/guard and `RouterTestingHarness`; Back/Forward tests enable the router's initial location listener explicitly because the harness does not bootstrap the application. Existing first-page-only UI expectations were updated for the approved feature; validation/security assertions were not weakened.

## Manual acceptance

Automated HTTP tests use Angular's simulated backend and router history. They do not establish browser cookie behavior or live SQL connectivity.

1. Sign in with an account containing more than 20 tasks. Open `/tasks`, navigate forward/back, then First/Last; verify URL and visible tasks.
2. Choose sizes 10, 20, and 50; each change opens page 1. Reload a non-default URL and use browser Back/Forward.
3. Open an invalid URL such as `/tasks?page=-1`; verify feedback, no Tasks read, and explicit reset.
4. Open a valid page beyond the results; verify the distinct message and recovery controls, including when the account has zero tasks.
5. Enter a creation draft, change page, and confirm the draft remains. Create on another page: one POST followed by one page-1 GET with the retained size.
6. Simulate an ambiguous POST outcome; refresh from the recovery action and confirm no POST retry or pagination reset.
7. Check keyboard use, heading focus after navigation, loading/errors, and a second account's isolation. Live browser/API/SQL Server and AXE checks must be reported separately.
