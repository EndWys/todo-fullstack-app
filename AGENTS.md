# Agent guidance for TodoApp

This is a learning project with an ASP.NET Core backend and Angular frontend. The owner knows C# and architecture professionally, is learning ASP.NET Core/EF Core/SQL Server, and has little TypeScript/Angular experience. Explain unfamiliar framework concepts and the reason for a choice; explain frontend syntax and data flow with small examples. Do not explain basic C# unless asked.

## Repository map

- `backend/TodoApp.sln`: backend solution; see `backend/AGENTS.md` for backend boundaries and verification.
- `frontend/`: Angular application; see `frontend/AGENTS.md` for framework guidance and verification.
- Read the relevant subproject's `AGENTS.md` before working there; its guidance supplements this file.
- Read `docs/auth-contract.md` when changing authentication or cookie/CSRF behavior; agreed requirements are not proof of implementation.
- Read `docs/engineering-followups.md` when a task touches a recorded trade-off.
- Do not infer setup or product requirements from missing documentation; the root `README.md` is empty.

## Working agreement

- Write new repository documentation and agent instructions in English. Do not translate existing documents wholesale unless requested. Continue user-facing explanations in the user's preferred language.
- The developer approves requirements, architecture, and correctness. Propose consequential architecture changes, new dependencies, and public contract changes before implementing them unless already authorized. Carry out routine details within the approved scope without repeated confirmation.
- Change project code only when directly requested. Explanation/review requests authorize inspection and relevant snippets, not implementation. Documentation upkeep does not expand permission to change code.
- Implement the smallest coherent solution within the requested scope. Add patterns, packages, and infrastructure only for a concrete need.
- Follow existing code and installed package versions. Check current official documentation when framework behavior is version-dependent.
- For cross-stack changes, define the HTTP contract explicitly and keep API and frontend request/response models in sync. Do not expose domain entities as public API contracts.
- Use meaningful tests for changed business rules and behavior. Run checks for the affected scope; distinguish passing checks, unrun checks, and required local services. Documentation-only edits need link/fact checks, not an application build.
- Never commit secrets or machine-specific connection strings. Treat database migrations and data changes as separate, reviewable steps; do not apply destructive database changes without an explicit request.
- Add concise inline comments for non-obvious security-sensitive decisions. Explain the threat being mitigated and any important limitation or invariant, rather than restating the code. Do not claim stronger guarantees than the implementation provides.
- Record concrete trade-offs in `docs/engineering-followups.md`: current approach, limitation, and trigger for revisiting it. Distinguish unfinished work from acceptable simplifications; update or remove resolved entries.
- Keep context focused: use `rg` to locate relevant files, follow an existing feature example, and read documents only when their topic applies. Keep detailed procedures out of these instructions and avoid duplicating facts maintained in code/configuration.
- In the final response, briefly explain what changed, the key framework idea involved, and how to try or verify it.
