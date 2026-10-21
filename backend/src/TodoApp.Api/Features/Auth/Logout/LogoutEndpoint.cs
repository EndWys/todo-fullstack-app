using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace TodoApp.Api.Features.Auth.Logout;

public static class LogoutEndpoint
{
    public static void Map(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/auth/logout", (Delegate)HandleAsync)
            .WithName("Logout")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            // Signing out an already signed-out browser is intentionally a successful operation.
            .AllowAnonymous();
    }

    private static async Task<IResult> HandleAsync(HttpContext context)
    {
        // Deletes the browser cookie; this does not revoke independently saved copies of the ticket.
        await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Results.NoContent();
    }
}
