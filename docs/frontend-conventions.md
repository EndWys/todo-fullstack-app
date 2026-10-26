# Frontend conventions

Apply these rules to new frontend code and approved refactoring. Do not restructure existing features automatically. Tasks is a structural example, not a requirement to copy every file into every feature.

Explicit role suffixes and a separate `testing/` directory are project conventions, not universal Angular requirements. Changes to these conventions require approval.

## 1. Feature structure

- Group code by business feature, then by purpose: `task-list-page`, `task-list-item`.
- By default, allow at most one directory level inside a feature. Agree on deeper nesting before introducing it.
- Keep a component, its template, and closely related local logic together. Put models and constants shared by multiple parts of the feature at its root.
- Keep all feature tests and test helpers in `testing/`. Production code must not import this directory.
- Do not create empty directories or files for hypothetical future needs.

## 2. Naming

- Names must explain purpose in context. Descriptiveness matters more than word count.
- Use kebab-case filenames and explicit roles: `.component.ts`, `.service.ts`, `.models.ts`, `.parser.ts`, `.constants.ts`.
- Match the main export to its filename: `task-list-page.component.ts` contains `TaskListPageComponent`.
- Keep component templates in separate `.html` files with the same base name.
- Avoid vague names such as `data`, `item`, or `helper` when their meaning is unclear without extra context. Prefer names such as `taskSummary`, `taskListLoadState`, and `taskListDataService`.
- Method and function names describe actions: `reloadTaskList()`, `parseTaskListResponse()`.

## 3. Responsibility boundaries

- Pages coordinate presentation, user actions, navigation, and focus. Execute HTTP requests outside components.
- Presentational components receive data through inputs and report user actions through outputs; they do not load data themselves.
- Services own a specific operation or state. A small service may combine HTTP reads with their loading state.
- Parsers validate external data and map it into client models. They do not manage requests, application state, or the DOM.
- Define shared models and state types outside service implementation files.
- Do not introduce API + Store layers, interfaces, or shared utilities without a concrete need.

## 4. State and dependency injection

- Keep injected component dependencies `private`. Expose only the necessary `protected` fields, readonly signals, and UI action methods to templates.
- Do not copy service state into local signals just to expose it to a template. Reference the existing readonly signal instead.
- Match service lifetime to state lifetime: use component-scoped providers for page-local state and singletons for genuinely application-wide state.
- Receiving a service through DI does not imply that it should be a singleton.

## 5. Constants and reuse

- Give each rule or setting one source of truth. Consumers import it instead of defining their own copies.
- Keep shared feature constants in a purpose-specific file. Keep single-file implementation details local.
- Name values that express a rule, limit, or non-obvious meaning. Do not turn every literal into a constant.
- Equal numbers do not necessarily represent the same setting. Share values by meaning, not merely by equality.

## 6. Tests

- Name spec files after the object under test: `task-list-data.service.spec.ts`.
- Put constant, parser, service, and presentation checks in their respective spec files. Cross-object scenarios are valid when clearly identified as integration tests.
- Distinguish test HTTP responses from client models and name their helpers accordingly.
- Type test doubles against the contracts they use, without `any` or forced type assertions.
- Preserve independent expected values: a test of a setting must not obtain its expected result from the setting under test.
- Preserve behavior and assertions during structural refactoring. Use the checks listed in [frontend verification guidance](../frontend/AGENTS.md#verification).
