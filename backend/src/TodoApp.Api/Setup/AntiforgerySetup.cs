using TodoApp.Api.Features.Auth.Csrf;

namespace TodoApp.Api.Setup;

public static class AntiforgerySetup
{
    public static IServiceCollection AddAppAntiforgery(this IServiceCollection services)
    {
        services.AddAntiforgery(options =>
        {
            options.HeaderName = CsrfDefaults.HeaderName;
            options.Cookie.Name = CsrfDefaults.AntiforgeryCookieName;
            options.Cookie.Path = "/";
            options.Cookie.HttpOnly = true;
            options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
            options.Cookie.SameSite = SameSiteMode.Strict;
        });
        return services;
    }
}
