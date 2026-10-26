# Frontend guidance

Angular 22, TypeScript 6, npm, SCSS, Bootstrap, and Vitest. Check `package.json`/the lockfile for exact versions. Use feature documents and actual code for implementation status rather than treating this guidance as a progress report.

## Entry points and conventions

- Before adding or restructuring frontend feature code, read and follow [frontend conventions](../docs/frontend-conventions.md). That document owns feature structure, naming, responsibility boundaries, DI lifetime, constants, and test organization; the framework guidance below complements it.
- `src/app/app.ts` is the root component; `app.config.ts` configures providers and `app.routes.ts` defines routes.
- Prefer strict typing, inference where obvious, and `unknown` over `any`. This is a coding convention, not a claim that strict compiler options are currently enabled.
- Use standalone components and focused imports. Angular 22 defaults to standalone and OnPush; omit redundant decorator settings.
- Use signals (`set`/`update`) for local state and `computed` for derived state. Use `linkedSignal` when derived writable state must stay synchronized; use the async pipe for template observables.
- Use `input()`/`output()`, and `model()` for two-way component bindings. Use `inject()` for DI and the Angular 22 `@Service` decorator for new root singleton services. Put host bindings/listeners in decorator `host` metadata.
- Prefer Signal Forms for new Angular 22 forms; preserve an existing form's approach unless migration is requested. Use Reactive Forms when Signal Forms do not fit.
- Use `@if`/`@for`/`@switch`, direct class/style bindings, and simple templates. Import only needed directives/pipes rather than `CommonModule`; external template/style paths are relative to the component.
- Lazy-load feature routes where useful. Use `NgOptimizedImage` for supported static images.
- Meet WCAG AA requirements with semantic markup, labels, keyboard access, focus, and contrast. Report checks actually performed; ESLint includes template accessibility rules, but no AXE check is currently configured.

## Verification

From `frontend/`: `npm start` runs the dev server, `npm run build` builds the app, and `npm test -- --watch=false` runs tests once. Check test types with `npx tsc --noEmit -p tsconfig.spec.json`. Use the project-local tools rather than installing global versions. For frontend code changes, run affected tests, type checks, lint, and build; use the full test suite after cross-feature or structural refactoring.

HTTP tests use Angular's simulated backend and do not prove live API/SQL Server connectivity; see [local verification setup](../docs/registration-local-setup.md).

`npm run lint` checks TypeScript and Angular templates using `eslint.config.js`. Prettier uses `.prettierrc` for formatting; keep formatting separate from ESLint rules. Run lint without `--fix` when reviewing unrelated or unfinished changes.

For version-specific guidance, consult the [official Angular AI conventions](https://angular.dev/ai/develop-with-ai) and the relevant API documentation; load only what the task needs.

When available, use the `angular_todoapp` MCP server for workspace discovery, version-aware best practices, and Angular documentation search. It runs the project's installed CLI with access scoped to `frontend/`; build/test/dev-server tools remain subject to the requested task's scope.
