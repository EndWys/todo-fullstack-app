using Swashbuckle.AspNetCore.SwaggerUI;
using TodoApp.Api.Features.Auth.Csrf;

namespace TodoApp.Api.Setup;

internal static class SwaggerSetup
{
    public static void Configure(SwaggerUIOptions options)
    {
        options.SwaggerEndpoint("/openapi/v1.json", "TodoApp v1");
        // Swagger is another browser client: acquire a token normally, never bypass server checks.
        options.UseRequestInterceptor($$"""
            async (request) => {
                const url = new URL(request.url, window.location.origin);
                const safe = ['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes((request.method ?? 'GET').toUpperCase());
                if (url.origin === window.location.origin && url.pathname.startsWith('/api/') && !safe) {
                    const response = await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
                    if (!response.ok) throw new Error('Could not prepare CSRF protection.');
                    const prefix = '{{CsrfDefaults.RequestCookieName}}=';
                    const cookie = document.cookie.split('; ').find(value => value.startsWith(prefix));
                    if (!cookie) throw new Error('CSRF request-token cookie is missing.');
                    request.headers ??= {};
                    request.headers['{{CsrfDefaults.HeaderName}}'] = decodeURIComponent(cookie.slice(prefix.length));
                }
                return request;
            }
            """);
    }
}
