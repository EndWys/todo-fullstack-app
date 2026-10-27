using System.Security.Claims;

namespace TodoApp.Api.Features.Auth.Identity;

internal static class AuthIdentity
{
    public static bool TryGetUserId(ClaimsPrincipal? principal, out Guid userId)
    {
        userId = Guid.Empty;
        return principal?.Identity?.IsAuthenticated == true
            && Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out userId)
            && userId != Guid.Empty;
    }

    public static bool HasRequiredClaims(ClaimsPrincipal? principal) =>
        TryGetUserId(principal, out _) && !string.IsNullOrWhiteSpace(principal!.FindFirstValue(ClaimTypes.Email));
}
