# Authentication: agreed behavior and HTTP contract

This is the first full-stack TodoApp feature. It describes observable behavior; implementation details can be decided when working on each part. Auth endpoints are separate `Endpoint` classes, consistent with the planned API structure.

## Implementation status

- Backend registration, EF Core SQL Server persistence, the `InitialUsers` migration, password hashing, and unit/integration test code are implemented.
- Angular has an English-language application shell and a lazy-loaded registration Signal Form at `/register`, with local email/password validation. The UI does not send HTTP requests or create accounts yet.
- Login, current-user lookup, logout, cookie sessions, CSRF protection, and the functional Angular authentication UI remain planned requirements below.
- Registration field errors use `ValidationProblem` with `errors.email` / `errors.password`; success returns only `id` and `email` and does not set an authentication cookie.
- Test code and migration files do not prove that tests passed or that a particular database has the migration applied. Verify those separately when working on the feature.

## User behavior

- A guest can register with an email address and password. Registration does not sign the user in; the UI offers a route to login.
- An email is required, trimmed for account lookup, and unique without regard to case. The database enforces uniqueness as well as application validation.
- A password is required, must contain at least 15 and at most 256 Unicode code points, and cannot consist only of whitespace. Spaces and other character types are allowed; no mandatory character-class rules. The password is not trimmed or returned in an API response. Only a password hash is stored.
- A registered user can sign in. An unknown email and an incorrect password produce the same public error.
- Signing in establishes a browser cookie session. The session survives page refresh, expires after eight hours, and can be ended through logout. Angular restores its user state by asking the API, not by trusting a locally stored flag.
- A guest cannot access protected API resources. Angular route guards improve navigation, while the server makes the access decision.
- Authentication cookies are not readable by JavaScript and are sent over HTTPS. Requests that change state use server-validated CSRF protection with Angular's client-side support.

## HTTP contract

| Request | Success | Expected errors |
| --- | --- | --- |
| `POST /api/auth/register` with `email`, `password` | `201 Created`; body contains `id`, `email` | `400` invalid fields; `409` email already registered |
| `POST /api/auth/login` with `email`, `password` | `200 OK`; body contains `id`, `email`; response sets authentication cookie | `400` missing/invalid request; `401` invalid credentials |
| `GET /api/auth/me` | `200 OK`; body contains current user's `id`, `email` | `401` no valid session |
| `POST /api/auth/logout` | `204 No Content`; ends the current browser session | No visible error when already signed out |

Validation errors use one consistent field-oriented response format so Angular can display them beside inputs. Passwords and password hashes never appear in responses or logs.

## Boundaries for this feature

- No email confirmation, password recovery, MFA, refresh tokens, or automatic login after registration.
- The eight-hour session duration and exact validation error schema can be refined before implementation, while preserving the user-facing scenarios and status-code intent.
- Details of persistence, hashing, cookie configuration, and Angular integration are addressed in their implementation subtasks.
