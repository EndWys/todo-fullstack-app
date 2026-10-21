namespace TodoApp.Api.Features.Auth.Csrf;

public static class CsrfDefaults
{
    public const string HeaderName = "X-XSRF-TOKEN";
    public const string RequestCookieName = "__Host-TodoApp.Xsrf";
    public const string AntiforgeryCookieName = "__Host-TodoApp.Antiforgery";
}
