using System.Security.Claims;

namespace TodoApp.Api.Features.Auth.Me;

public static class MeEndpoint
{
    public static void Map(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/auth/me", Handle)
            .WithName("Me")
            .Produces<MeResponse>()
            .Produces(StatusCodes.Status401Unauthorized)
            .RequireAuthorization();
    }

    private static IResult Handle(HttpContext context)
    {
        // Identity is user-specific; a cached response must not outlive the browser's session.
        context.Response.Headers.CacheControl = "no-store";
        string? id = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        string? email = context.User.FindFirstValue(ClaimTypes.Email);

        // A protected ticket is trusted, but must still contain the identity fields this API needs.
        if (!Guid.TryParse(id, out Guid userId) || userId == Guid.Empty || string.IsNullOrWhiteSpace(email))
            return Results.Unauthorized();

        // Claims are a login-time snapshot, not a fresh database lookup or account-status check.
        return Results.Ok(new MeResponse(userId, email));
    }
}
