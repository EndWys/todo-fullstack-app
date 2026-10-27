# TodoApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.1.

## Editor and linting

Use Angular Language Service for template completion and type information, ESLint for
TypeScript and template diagnostics, and Prettier for formatting with `.prettierrc`.
Pretty TypeScript Errors and Error Lens improve how existing diagnostics are displayed.
VS Code's built-in JavaScript/TypeScript inlay hints can show inferred types and parameter names.

The local VS Code settings support opening either the repository root or `frontend/`.
They enable formatting and ESLint fixes on explicit saves for TypeScript and HTML,
and formatting on save for SCSS. Select **Use Workspace Version** if VS Code asks
which TypeScript version to use. The `.vscode/` folders are ignored by Git, so these
editor preferences stay local; ESLint and Prettier configuration is kept in the project.

From `frontend/`, run `npm run lint` to check TypeScript and Angular templates without
changing files. Template accessibility rules are included, but do not replace browser
accessibility testing. The setup follows the
[Angular ESLint configuration guide](https://github.com/angular-eslint/angular-eslint/blob/main/docs/CONFIGURING_ESLINT.md).

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
