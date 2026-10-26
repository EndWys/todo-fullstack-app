# Auth frontend refactoring

## Stage 1.1: file names

Only filenames and their references change in this stage. The `register/` and `login/` directories, exported identifiers (`Register`, `Login`, `AuthApi`, `AuthSession`), selectors, DI scopes, validation, requests, and assertions remain unchanged. Updating exported identifiers belongs to stage 1.2; moving tests to `testing/` belongs to stage 2.

At stage 1.1, the two AuthApiService spec files remained separate. Stage 2.4 consolidates them and extracts XSRF integration checks as recorded below.

All paths below are relative to `frontend/src/app/features/auth/`.

| Previous filename | Current filename |
| --- | --- |
| `auth-api.ts` | `auth-api.service.ts` |
| `auth-api.spec.ts` | `auth-api.service.spec.ts` |
| `auth-login-api.spec.ts` | `auth-api.service.login-session.spec.ts` |
| `auth-session.ts` | `auth-session.service.ts` |
| `auth-session.spec.ts` | `auth-session.service.spec.ts` |
| `auth.model.ts` | `auth.models.ts` |
| `auth-user.ts` | `auth-user.parser.ts` |
| `auth-field-errors.ts` | `auth-field-errors.parser.ts` |
| `auth-guard.ts` | `auth.guard.ts` |
| `session-expiry-interceptor.ts` | `session-expiry.interceptor.ts` |
| `session-expiry-interceptor.spec.ts` | `session-expiry.interceptor.spec.ts` |
| `email-normalization.ts` | `email.normalizer.ts` |
| `email-normalization.spec.ts` | `email.normalizer.spec.ts` |
| `register/register.ts` | `register/registration-page.component.ts` |
| `register/register.html` | `register/registration-page.component.html` |
| `register/register.scss` | `register/registration-page.component.scss` |
| `register/register.spec.ts` | `register/registration-page.component.spec.ts` |
| `register/register-validation.ts` | `register/registration-password.validator.ts` |
| `register/register-validation.spec.ts` | `register/registration-password.validator.spec.ts` |
| `register/registration-error.ts` | `register/registration-error.parser.ts` |
| `register/registration-error.spec.ts` | `register/registration-error.parser.spec.ts` |
| `login/login.ts` | `login/login-page.component.ts` |
| `login/login.html` | `login/login-page.component.html` |
| `login/login.scss` | `login/login-page.component.scss` |
| `login/login.spec.ts` | `login/login-page.component.spec.ts` |
| `login/login-error.ts` | `login/login-error.parser.ts` |
| `login/login-error.spec.ts` | `login/login-error.parser.spec.ts` |

## References outside Auth

Stages 1.1 and 1.2 update file and exported-identifier references; stage 1.3 updates renamed Auth service members in the application shell, routes, and Tasks consumers. Unrelated Tasks fields and UI actions are not renamed. Route URLs (`/register`, `/login`, `/tasks`) do not change.

Existing feature documentation is updated to reference current filenames; historical CLI generation commands are retained.

## Remaining stages

- Stage 2.5 finishes test-helper organization after the scenario separation in 2.4. The known registration RouterLink import issue remains a separate behavioral fix, not part of these structural changes.

## Stage 2.5: test organization and shared helpers

- `testing/auth-form.test-helper.ts` owns `enterAuthFormFieldValue()`, used by both page specs. It sets an input value, dispatches the existing bubbling input event, waits for `ComponentFixture.whenStable()`, and returns the input element. The generic fixture parameter preserves typing without `any` or forced casts.
- `testing/auth-csrf.test-helper.ts` owns `flushAuthCsrfBootstrap()`, used by Login page and session-service scenarios for the identical successful bootstrap response. API tests keep their timeout assertion locally; error/header/cookie-specific scenarios retain explicit responses and expectations.
- All Auth specs/helpers remain directly under `testing/`, with no extra nesting. Helpers do not configure global state, hide retries, or import production timeout/password settings as expected values. Test-specific data and UI/request orchestration stay local rather than introducing a generic scenario framework.
- Production code, test cases, assertions, HTTP fixtures, and persistent tool settings are unchanged. This step completes helper organization, not additional authentication behavior or coverage expansion.
- Verification: all 235 frontend tests passed in 18 files; production build, full lint, test TypeScript checks, and affected-file formatting passed. The three affected specs match the helper-extraction plan after allowing formatting/trailing argument commas. Production Auth files have no testing/helper imports. The first test launch exited without diagnostics; a separate retry completed successfully. Initial bundle remains 529.64 kB with existing Sass/budget warnings. No browser/AXE/live API/SQL Server checks were run.

## Stage 2.4: test responsibility and integration boundaries

- `testing/auth-api.service.spec.ts` now contains both existing API groups: registration HTTP integration and login/session HTTP integration. The redundant `auth-api.service.login-session.spec.ts` is removed after moving its suite, including its setup, helper, scenarios, and assertions.
- `testing/auth-xsrf.integration.spec.ts` receives the two existing cookie/header scenarios: reading the fresh cookie after bootstrap and withholding the token from another origin. Their XSRF configuration, cookie spy cleanup, simulated responses, and assertions are preserved. These checks exercise Angular's configured interceptor pipeline, not just the API service.
- Page, session-service, and session-expiry-interceptor suite names explicitly identify their HTTP/session/routing integration scope. Their implementations and scenarios stay intact; real cooperating Angular objects are not replaced by mocks merely to call these unit tests. Parser, normalizer, and password-validator tests remain focused on their existing objects.
- All specs remain directly under `testing/`. There is no new test infrastructure, dependency, runtime change, or production-code edit. HttpTestingController simulates the HTTP boundary: these are frontend integration tests, not real backend/browser-cookie/SQL Server end-to-end tests.
- Verification: all 235 frontend tests passed in 18 files. Production build, full lint, test TypeScript check, and affected-file formatting passed. Comparison with the pre-stage test contents and the move plan confirmed preserved test bodies/assertions/setup, allowing only suite labels, removed unused imports, and formatting. Initial bundle remains 529.64 kB with existing Sass/budget warnings. No browser/AXE/live API/SQL Server checks were run.

## Stage 2.3: shared models

- `auth.models.ts` owns `AuthSessionState` and `AuthFieldError` alongside existing request/response/user models. The session service and shared field-error parser import these types rather than declaring them in implementation files.
- `login-page/login.models.ts` owns `LoginFailure`; `registration-page/registration.models.ts` owns `RegistrationFailure` and the existing `RegistrationFieldError` alias. Pages and parsers import their model directly, without compatibility re-exports from implementation files.
- Model-only imports in new files and changed page/parser imports use `import type`; these dependencies are erased during TypeScript compilation. The model files do not import services, parsers, Angular, or testing code.
- Type shapes, names, optionality, readonly modifiers, runtime branches, messages, and HTTP contracts are unchanged. The password validator's locally used result type remains beside its implementation; no hypothetical model files were added for single-file details.
- Verification: all 235 frontend tests passed in 18 files; production build, full lint, affected-file formatting, and test TypeScript checks passed. The first type-check process exited natively without diagnostics; a separate retry passed. Initial bundle remains 529.64 kB with existing Sass/budget warnings. Tests and configuration were not modified; browser/AXE/live API/SQL Server checks were not run.

## Stage 2.2: page/template responsibility boundaries

- Login keeps its injected `AuthSessionService` private. The template reads `sessionState`, `authenticatedUser`, and `isAuthOperationInProgress` through references to the existing readonly service signals, not copied state or additional computed wrappers. User actions still call page methods.
- Registration owns a private writable `registeredEmailSignal` and exposes `registeredEmail` as readonly. The template invokes `clearRegistrationSuccess()` on input instead of mutating a signal itself. Successful registration still updates the same underlying signal, and submission resets the success message through the same page action.
- HTTP/CSRF work stays in `AuthApiService`; session coordination stays in the singleton `AuthSessionService`. Forms, field-error mapping, focus, and page lifecycle remain page responsibilities. No facade, additional service, DI scope, rule, or request ownership change was introduced.
- The verified empty legacy `login/` and `register/` directories were removed without recursive deletion or file removal.
- The test TypeScript check passed through Windows PowerShell after initial native process failures without diagnostics. No persistent tooling settings were changed.
- All 235 frontend tests passed in 18 files; production build, full lint, and formatting passed. Existing Sass and initial-bundle warnings remain (529.64 kB). No browser/AXE/live API/SQL Server checks were run. Shared-model extraction and mixed-test regrouping remain separate steps; the known registration RouterLink issue is unchanged.

## Stage 2.1: feature directories

The stage 1 tables record paths at that time. The current layout is:

```text
auth/
  registration-page/  # registration component, HTML/SCSS, parser, password validator/settings
  login-page/         # login component, HTML/SCSS, error parser
  testing/            # all ten Auth spec files; no nested directories
  ...                 # shared API/session services, models, parsers, HTTP settings, guard/interceptor
```

- `register/` becomes `registration-page/`; `login/` becomes `login-page/`. All Auth specs move directly to `testing/`, preserving their filenames and scenarios.
- Twenty files move. Relative TypeScript imports, application route imports, and lazy component imports follow the new locations. Component-relative template/style paths stay valid because the component and its assets move together.
- The shared Auth files stay at the feature root. There is no additional nesting, new provider, dependency, runtime rule, or public contract change. Route URLs, selectors, DI lifetimes, CSRF/cookie behavior, and assertions remain unchanged.
- Responsibility/model extraction and regrouping mixed test scenarios are separate steps. The known registration RouterLink issue remains outside this relocation.

### Stage 2.1 verification

- All 235 frontend tests passed in 18 files. Production build, full lint, and the test TypeScript check passed. Initial native failures of the first type-check/lint attempts were followed by successful retries.
- All 51 files under `src/app` were compared with the pre-stage snapshot and the relocation/import mapping: only the twenty moves and expected relative import changes differ. HTML, SCSS, business logic, and assertions are preserved.
- Initial bundle remains 529.64 kB with existing Sass and 500 kB budget warnings. Dependencies, configuration, and persistent test settings are unchanged. Browser/AXE/live API/SQL Server checks were not run.

## Stage 1.4: constants and shared settings

- `auth-http.constants.ts` owns `AUTH_REQUEST_TIMEOUT_MS` (15,000 ms per HTTP request, not per complete CSRF + mutation operation) and the transport-failure sentinel `AUTH_TRANSPORT_ERROR_STATUS` (0).
- Standard HTTP response statuses use Angular's `HttpStatusCode` enum in the API service, session service, error parsers, and session-expiry interceptor.
- `register/registration-password.constants.ts` owns the registration minimum/maximum of 15/256 Unicode code points. The validator, its messages, and the template hint consume these values. Template-facing readonly fields expose static settings without introducing signals.
- Login does not import the registration policy. Tasks retains its own semantically independent timeout setting. URLs, CSRF sequencing, messages, request behavior, and validation rules are unchanged.
- Tests retain independent literal expectations. HTTP tests check the 15-second timeout for CSRF bootstrap, login, session restoration, and logout in addition to the existing registration assertion. The registration page checks the rendered policy hint; existing password boundary tests remain unchanged.

### Stage 1.4 verification

- All 235 frontend tests passed in 18 files with a process-local single worker. Test TypeScript checks, full lint, formatting, and production build passed.
- Preliminary build and test launches encountered native process failures; a separate full test retry and MCP build completed successfully. A stalled local build attempt was identified before being stopped.
- Initial bundle is 529.64 kB against the unchanged 500 kB warning budget. Existing Sass deprecation warnings remain. Dependencies, build budgets, and persistent test settings are unchanged.
- No browser, AXE, or live API/SQL Server checks were run.

These stages are not implemented by the file-renaming step. Runtime validation changes, the previously noted registration RouterLink import issue, and any other behavioral fixes must be handled separately rather than hidden in renames.

## Stage 1.1 verification

- All 235 frontend tests passed in 18 files using a process-local `VITEST_MAX_WORKERS=1`; persistent test settings did not change.
- Production build, full ESLint, and the test TypeScript check passed.
- All 49 frontend source files were compared with a pre-change snapshot, normalizing line endings. Only the mapped file references changed; the 27 renamed files and 8 import-only consumers preserve logic, exported identifiers, templates, styles, and assertions.
- The initial default-worker run failed before renaming because workers exited during startup. A later stalled single-worker attempt was stopped after its process identity was checked; the successful run above is a separate completed retry.
- Initial bundle remains 528.48 kB, with the existing 500 kB warning budget and Sass deprecation warnings. Dependencies, compiler options, and build budgets did not change.
- No browser/AXE/live API/SQL Server checks were run in this stage.

## Stage 1.2: class, type, and function names

The following identifiers are renamed without changing their behavior or type shapes:

| Previous identifier | Current identifier |
| --- | --- |
| `Register` | `RegistrationPageComponent` |
| `Login` | `LoginPageComponent` |
| `AuthApi` | `AuthApiService` |
| `AuthSession` | `AuthSessionService` |
| `SessionState` | `AuthSessionState` |
| `PasswordPolicyError` | `RegistrationPasswordValidationError` |
| `validatePassword` | `validateRegistrationPassword` |
| `readAuthUser` | `parseAuthUserResponse` |
| `readAuthFieldErrors` | `parseAuthFieldErrors` |
| `loginFailureMessage` | `getLoginFailureMessage` |

Imports, DI tokens, type annotations, lazy-route export references, call sites, and matching test-suite labels use the new names. Already descriptive names such as `AuthUser`, `LoginRequest`, `RegisterRequest`, `parseLoginError()`, and `normalizeEmail()` remain unchanged.

The `AuthSessionState` type remains local to its service until the responsibility/model stage. Fields, class methods, selectors, route URLs, HTTP payloads/statuses, validation rules, lifecycle behavior, templates, styles, filenames, and directory locations do not change in stage 1.2. The registration RouterLink issue is not fixed in this step.

## Stage 1.2 verification

- All 235 frontend tests passed in 18 files; one worker was selected only for the verification process.
- Production build, full ESLint, and the test TypeScript check passed. A failed MCP build was followed by a successful local CLI build. Preliminary test attempts encountered native process failures, a stalled launch, or esbuild EPIPE; the stalled test process was identified before being stopped, and a separate full retry passed.
- All 49 files under `frontend/src/app` were compared with the pre-stage snapshot, normalizing line endings. Changes are limited to 95 identifier occurrences in 26 TypeScript files and six matching test-suite labels. Assertions, other string literals, comments, HTML, SCSS, filenames, and directory locations are unchanged.
- Initial bundle is 528.51 kB versus the existing 500 kB warning budget. The existing Sass deprecation warning remains; dependencies, configuration, and budgets did not change.
- No browser, AXE, or live API/SQL Server checks were run.

## Stage 1.3: fields, methods, and template identifiers

This stage changes names and formatting, not authentication behavior. TypeScript Language Service rename locations are used for declarations and references; Angular HTML bindings, view-query reference strings, test-double keys, and the string-based restoration spy are updated explicitly.

| Scope | Previous names | Current names |
| --- | --- | --- |
| Registration page | `model`, `passwordLength`, `onSubmit` | `registrationFormModel`, `passwordCodePointCount`, `submitRegistration` |
| Login page | `model`, `session`, `onSubmit` | `loginFormModel`, `authSessionService`, `submitLogin` |
| Form feedback | `showEmailError`, `showPasswordError` | `shouldShowEmailErrors`, `shouldShowPasswordErrors` |
| Form normalization | `normalizeEmail` page method | `normalizeRegistrationEmail` / `normalizeLoginEmail`; shared `normalizeEmail()` function is unchanged |
| Login actions | `logout`, `checkSession`, `focusAfterRender` | `signOut`, `checkCurrentSession`, `focusLoginResultAfterRender` |
| Login view queries | `heading`, `emailInput`, `passwordInput` | `pageHeadingElement`, `emailInputElement`, `passwordInputElement` |
| Auth API methods | `register`, `login`, `me`, `logout`, `prepareCsrf` | `registerUser`, `loginUser`, `getCurrentUser`, `logoutUser`, `prepareCsrfToken` |
| Session readonly signals | `state`, `busy`, `user` | `sessionState`, `isAuthOperationInProgress`, `authenticatedUser` |
| Session actions | `restore`, `login`, `logout`, `expireIfCurrent` | `restoreSession`, `loginUser`, `logoutUser`, `expireSessionIfCurrent` |
| Session revision | `revision`, `revisionValue` | `sessionRevision`, `sessionRevisionValue` |

Local variables identify their purpose: examples include `registrationResponseBody`, `previousSessionState`, `requestSessionRevision`, `emailFieldState`, `passwordFieldState`, and `focusTargetElement`. Test locals distinguish `componentFixture`, `hostElement`, `httpTestingController`, `httpRequest`, and request/operation promises.

Template aliases and error loops use `authenticatedUser`, `emailValidationError`, `passwordValidationError`, `registrationRequestError`, and `loginRequestError`. DOM ids, labels, visible messages, input attributes, route URLs, and element structure are retained.

Shorthand properties are expanded when necessary to retain the existing data shape: for example, `{ user }` becomes `{ user: authenticatedUser }`, not a different response/state property. Likewise, Signal Forms' `value` context property remains `value` when locally aliased to `passwordValue`.

The session state type stays local to its service, and Login still exposes its injected session service to the template. Changing those responsibility boundaries belongs to stage 2. Constants and validation rules remain unchanged; the registration RouterLink issue is not addressed here.

## Stage 1.3 verification

- All 235 frontend tests passed in 18 files with one worker selected only for the verification process.
- Production build, full ESLint, test TypeScript checks, and formatting of the affected TS/HTML files passed. The initial type check identified the old `restore` string in a route-test spy; it was updated to `restoreSession`, and the subsequent check passed.
- All 49 files under `frontend/src/app` were compared with the pre-stage snapshot and the planned semantic rename edits, normalizing formatting for affected files. Only planned renames, explicit shorthand aliases, template bindings/references, and formatting differ in 28 files.
- An additional syntax-tree literal comparison confirmed preserved numeric limits, status values, URLs, and messages, allowing only the three renamed view-query references and the session-member strings used by Pick/spyOn. Visible HTML text and static ids/labels/router links/autocomplete attributes were also checked against the snapshot.
- Initial bundle is 529.22 kB against the unchanged 500 kB warning budget. The existing Sass deprecation warning remains. Dependencies, compiler settings, test configuration, and budgets did not change.
- Some preliminary local tool processes exited natively before successful retries; the successful checks above completed separately. No browser, AXE, or live API/SQL Server checks were run.
