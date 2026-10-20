using Microsoft.Net.Http.Headers;
using TodoApp.Api.Features.Auth.Csrf;

namespace TodoApp.IntegrationTests.Auth;

// Existing behavior tests use this real HTTP bootstrap. CSRF rejection tests omit this handler.
internal sealed class CsrfTestHandler(bool cookieContainerHandlesCookies) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
    {
        if (request.Method != HttpMethod.Get && request.Method != HttpMethod.Head && request.Method != HttpMethod.Options)
        {
            using var bootstrap = new HttpRequestMessage(HttpMethod.Get, new Uri(request.RequestUri!, "/api/auth/csrf"));
            if (request.Headers.TryGetValues("Cookie", out var existingCookies))
                bootstrap.Headers.TryAddWithoutValidation("Cookie", existingCookies);
            using var response = await base.SendAsync(bootstrap, token);
            response.EnsureSuccessStatusCode();
            var cookies = response.Headers.GetValues("Set-Cookie").Select(value => SetCookieHeaderValue.Parse(value)).ToArray();
            string requestToken = cookies.Single(cookie => cookie.Name == CsrfDefaults.RequestCookieName).Value.ToString();
            request.Headers.Add(CsrfDefaults.HeaderName, Uri.UnescapeDataString(requestToken));

            if (!cookieContainerHandlesCookies)
            {
                var existing = request.Headers.TryGetValues("Cookie", out var values) ? string.Join("; ", values) : "";
                string issued = string.Join("; ", cookies.Select(cookie => $"{cookie.Name}={cookie.Value}"));
                request.Headers.Remove("Cookie");
                request.Headers.Add("Cookie", string.IsNullOrEmpty(existing) ? issued : existing + "; " + issued);
            }
        }
        return await base.SendAsync(request, token);
    }
}
