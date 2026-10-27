# Backend guidance

ASP.NET Core / EF Core 10, SQL Server, and xUnit. Check `.csproj` files for exact packages and versions. The solution has Domain, Application, Infrastructure, Api, and test projects. Use feature contracts and actual code for implementation status rather than treating this guidance as a progress report.

## Architecture and DDD

- Dependency direction: Domain has no project dependencies; Application depends on Domain; Infrastructure implements abstractions needed by the inner layers; Api is the composition root and depends on Application and Infrastructure.
- Put business invariants and behavior in Domain entities/value objects. Keep Domain free of ASP.NET Core, EF Core, SQL Server, and transport types. Model only useful DDD concepts; avoid ceremonial aggregates, repositories, events, or CQRS for simple CRUD.
- Put use-case orchestration and required ports in Application. Put persistence, EF Core mapping, SQL Server access, and external-service implementations in Infrastructure. Keep Api endpoints focused on HTTP concerns and boundary mapping/validation, preserving status codes, errors, and cancellation behavior.
- Follow the existing `Features/Auth` and `Features/Tasks` slices. Routes use separate static Endpoint classes registered in `Api/Setup/WebApplicationSetup.cs`; DI is in `ServiceCollectionSetup.cs`.
- `Infrastructure/Persistence/AppDbContext.cs` and `Persistence/Migrations/` own the context and migrations. Entity Fluent API mappings are under the feature's persistence folder.
- Configuration reads `ConnectionStrings:TodoApp`. Supply local values through user secrets or environment configuration.
- OpenAPI uses `AddOpenApi`/`MapOpenApi`; Swagger UI consumes `/openapi/v1.json` in Development. Preserve this setup unless changing it is requested.

## Verification

From `backend/`:

- Build: `dotnet build TodoApp.sln`.
- Run affected unit test projects under `tests/TodoApp.Domain.Tests`, `TodoApp.Application.Tests`, and `TodoApp.Infrastructure.Tests` with `dotnet test <project-directory>`; these do not require SQL Server.
- The integration test project contains both HTTP/DI tests with substituted repositories and SQL Server-backed tests. Inspect the relevant fixture before selecting a database-free subset; do not infer database requirements from the project name alone.
- Full integration suite: `dotnet test tests/TodoApp.IntegrationTests`. SQL-backed tests require `TODOAPP_TEST_CONNECTION_STRING` targeting the dedicated `TodoAppTest` database with the schema already applied. They write/delete test rows; inspect `TestDatabase.cs` and the affected fixture before running them. Do not print connection-string values.
- `dotnet test TodoApp.sln` includes integration tests; run it only when their database prerequisites are satisfied. A build or unit test pass does not validate SQL Server behavior.
- Prepare migrations and generated SQL as reviewable changes. Applying even a non-destructive migration requires separate approval; permission to edit code is not permission to update a database.
