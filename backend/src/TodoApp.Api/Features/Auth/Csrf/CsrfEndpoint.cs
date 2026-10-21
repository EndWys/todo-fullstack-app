using Microsoft.AspNetCore.Antiforgery;

namespace TodoApp.Api.Features.Auth.Csrf;

public static class CsrfEndpoint
{
    public static void Map(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/auth/csrf", Handle)
            .WithName("Csrf")
            .Produces(StatusCodes.Status204NoContent)
            .AllowAnonymous();
    }

    private static IResult Handle(HttpContext context, IAntiforgery antiforgery)
    {
        var tokens = antiforgery.GetAndStoreTokens(context);
        // Angular reads only the request token. The paired antiforgery cookie remains HttpOnly.
        context.Response.Cookies.Append(CsrfDefaults.RequestCookieName, tokens.RequestToken!, new CookieOptions
        {
            HttpOnly = false, Secure = true, SameSite = SameSiteMode.Strict, Path = "/", IsEssential = true
        });
        context.Response.Headers.CacheControl = "no-store";
        return Results.NoContent();
    }
}
