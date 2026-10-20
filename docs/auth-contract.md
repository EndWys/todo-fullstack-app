# Authentication: agreed behavior and HTTP contract

This is the first full-stack TodoApp feature. It describes observable behavior; implementation details can be decided when working on each part. Auth endpoints are separate `Endpoint` classes, consistent with the planned API structure.

## Implementation status

- Backend registration, EF Core SQL Server persistence, the `InitialUsers` migration, password hashing, and unit/integration test code are implemented.
- Angular has an English-language application shell and a lazy-loaded registration Signal Form at `/register`, with local validation and HTTP registration through `AuthApi`. It displays field errors for `400`/`409`, general request errors, and success after `201`; it clears the password and does not sign in.
- Angular HTTP behavior is covered with a simulated HTTP backend. This does not prove a successful registration through a running frontend/API/SQL Server environment; verify that separately using [registration-local-setup.md](registration-local-setup.md).
- Application login credential verification is implemented through `LoginHandler`, including shared input validation and dummy-hash verification for missing users. It returns identity data only and does not create a session.
- `POST /api/auth/login` and cookie authentication are implemented. Login returns only `id`/`email`; invalid fields return `400 ValidationProblem`, invalid credentials return one generic `401 ProblemDetails`. Unexpected failures remain `500`.
- The cookie is host-only `__Host-TodoApp.Auth`, `HttpOnly`, `Secure`, `SameSite=Lax`, path `/`. Its protected authentication ticket expires eight hours after login with no sliding renewal. It is a browser-session cookie (no persistent browser expiry); closing the browser may end the session earlier. Authentication challenges/forbids return `401`/`403`, not redirects.
- `GET /api/auth/me` requires authentication and returns only `id`/`email` from the validated ticket, with `Cache-Control: no-store`. It returns `401` for missing, expired, damaged, or incomplete identity tickets. It does not query the database: identity is a login-time snapshot, not a live account-status check.
- `POST /api/auth/logout` deletes the authentication cookie and returns an empty `204`, including when already signed out or given an invalid/expired cookie. Logout does not revoke independently saved copies of a valid ticket. `GET /api/auth/logout` is not supported.
- CSRF protection is implemented for unsafe HTTP methods under `/api` (everything except GET/HEAD/OPTIONS/TRACE), including anonymous register/login/logout. The middleware requires `X-XSRF-TOKEN` and validates it with ASP.NET Core `IAntiforgery` before endpoint execution, after authentication/authorization.
- `GET /api/auth/csrf` is anonymous and returns `204`, `Cache-Control: no-store`, the framework's HttpOnly `__Host-TodoApp.Antiforgery` cookie when needed, and a JavaScript-readable `__Host-TodoApp.Xsrf` request-token cookie. Both are Secure, SameSite=Strict, path `/`, no Domain. Request token and internal cookie are cryptographically related, not compared as equal strings. No authentication cookie is issued by bootstrap.
- Angular registration performs token bootstrap before POST; its built-in XSRF interceptor copies the request-token cookie to the header. Development Swagger also bootstraps before mutations without bypassing validation. The Angular dev server now uses HTTPS. Angular login/session UI remains planned. See [csrf-protection.md](csrf-protection.md) and [login-local-setup.md](login-local-setup.md).
- Registration field errors use `ValidationProblem` with `errors.email` / `errors.password`; success returns only `id` and `email` and does not set an authentication cookie.
- Test code and migration files do not prove that tests passed or that a particular database has the migration applied. Verify those separately when working on the feature.

## User behavior

- A guest can register with an email address and password. Registration does not sign the user in; the UI offers a route to login.
- An email is required, trimmed for account lookup, and unique without regard to case. The database enforces uniqueness as well as application validation.
- A password is required, must contain at least 15 and at most 256 Unicode code points, and cannot consist only of whitespace. Spaces and other character types are allowed; no mandatory character-class rules. The password is not trimmed or returned in an API response. Only a password hash is stored.
- A registered user can sign in. An unknown email and an incorrect password produce the same public error.
- Registration explicitly selects password-policy V1 (15–256 Unicode code points, not whitespace-only). Login input rules are derived from all supported creation revisions: lowest minimum, highest maximum, and whitespace-only rejection only if every supported revision rejects it. With V1 alone both scenarios currently use identical checks. Invalid input remains distinct from invalid credentials. See [password-policy-revisions.md](password-policy-revisions.md).
- Signing in establishes a browser cookie session. The session survives page refresh, expires after eight hours, and can be ended through logout. Angular restores its user state by asking the API, not by trusting a locally stored flag.
- A guest cannot access protected API resources. Angular route guards improve navigation, while the server makes the access decision.
- Authentication cookies are not readable by JavaScript and are sent over HTTPS. Requests that change state use server-validated CSRF protection with Angular's client-side support.

## HTTP contract

| Request | Success | Expected errors |
| --- | --- | --- |
| `GET /api/auth/csrf` | `204 No Content`; issues CSRF cookies for the current identity | No authentication required |
| `POST /api/auth/register` with `email`, `password` | `201 Created`; body contains `id`, `email` | `400` invalid fields; `409` email already registered |
| `POST /api/auth/login` with `email`, `password` | `200 OK`; body contains `id`, `email`; response sets authentication cookie | `400` missing/invalid request; `401` invalid credentials |
| `GET /api/auth/me` | `200 OK`; body contains current user's `id`, `email` | `401` no valid session |
| `POST /api/auth/logout` | `204 No Content`; deletes the current browser's cookie | `400` invalid/missing CSRF; no already-signed-out error with valid CSRF |

All mutating requests above require a valid antiforgery-cookie / `X-XSRF-TOKEN` pair, including logout when already signed out. CSRF failure returns `400 ProblemDetails` with `title: "CSRF validation failed."` and `code: "csrf_validation_failed"`, without field errors. No business operation runs on that failure. Refresh the token before a mutation after login/logout; tokens are identity-bound. A valid-CSRF logout remains idempotent.

Validation errors use one consistent field-oriented response format so Angular can display them beside inputs. Passwords and password hashes never appear in responses or logs.

## Boundaries for this feature

- No email confirmation, password recovery, MFA, refresh tokens, or automatic login after registration.
- The eight-hour session duration and exact validation error schema can be refined before implementation, while preserving the user-facing scenarios and status-code intent.
- Details of persistence, hashing, cookie configuration, and Angular integration are addressed in their implementation subtasks.
