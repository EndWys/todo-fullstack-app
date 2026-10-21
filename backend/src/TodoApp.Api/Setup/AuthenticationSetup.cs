using Microsoft.AspNetCore.Authentication.Cookies;
using TodoApp.Api.Features.Auth.Identity;

namespace TodoApp.Api.Setup;

public static class AuthenticationSetup
{
    public static IServiceCollection AddAppAuthentication(this IServiceCollection services)
    {
        services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                // The host-only prefix prevents sibling hosts from setting this cookie.
                options.Cookie.Name = "__Host-TodoApp.Auth";
                options.Cookie.Path = "/";
                options.Cookie.HttpOnly = true;
                options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                // SameSite complements the server-validated antiforgery token on API mutations.
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.ExpireTimeSpan = TimeSpan.FromHours(8);
                options.SlidingExpiration = false;

                // Signed tickets still require the expected identity fields. Reject incomplete
                // identities before authorization/CSRF, without claiming to check account status in DB.
                options.Events.OnValidatePrincipal = context =>
                {
                    if (!AuthIdentity.HasRequiredClaims(context.Principal))
                        context.RejectPrincipal();
                    return Task.CompletedTask;
                };

                // This host is an API: never turn authentication failures into HTML redirects.
                options.Events.OnRedirectToLogin = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                options.Events.OnRedirectToAccessDenied = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };
            });
        services.AddAuthorization();
        return services;
    }
}
