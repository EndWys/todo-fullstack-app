using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;
using TodoApp.Api.Features.Auth.Csrf;

namespace TodoApp.IntegrationTests.Auth;

// Raw clients intentionally omit CsrfTestHandler: the real server must reject invalid requests.
public sealed class CsrfEndpointTests
{
    [Fact]
    public async Task BootstrapIssuesSecureCookiePairWithoutAuthenticationOrCaching()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient(prepareCsrf: false);
        using var response = await client.GetAsync("/api/auth/csrf");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.Empty(await response.Content.ReadAsStringAsync());
        var cookies = response.Headers.GetValues("Set-Cookie").Select(value => SetCookieHeaderValue.Parse(value)).ToArray();
        Assert.Equal(2, cookies.Length);
        foreach (var cookie in cookies)
        {
            Assert.True(cookie.Secure);
            Assert.Equal("/", cookie.Path.ToString());
            Assert.False(cookie.Domain.HasValue);
            Assert.Equal(Microsoft.Net.Http.Headers.SameSiteMode.Strict, cookie.SameSite);
        }
        Assert.True(cookies.Single(cookie => cookie.Name == CsrfDefaults.AntiforgeryCookieName).HttpOnly);
        Assert.False(cookies.Single(cookie => cookie.Name == CsrfDefaults.RequestCookieName).HttpOnly);
        Assert.Equal(0, factory.Repository.LookupCount);
    }

    [Theory]
    [InlineData("POST", "/api/auth/register")]
    [InlineData("POST", "/api/auth/login")]
    [InlineData("POST", "/api/auth/logout")]
    [InlineData("PUT", "/api/future-resource")]
    [InlineData("PATCH", "/api/future-resource")]
    [InlineData("DELETE", "/api/future-resource")]
    public async Task MissingTokenIsRejectedBeforeAnyEndpointWork(string method, string route)
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient(prepareCsrf: false);
        using var request = new HttpRequestMessage(new HttpMethod(method), route)
        {
            Content = JsonContent.Create(new { email = "user@example.com", password = LoginApiFactory.Password })
        };
        using var response = await client.SendAsync(request);
        await AssertCsrfFailure(response);
        Assert.Equal(0, factory.Repository.LookupCount);
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    [Theory]
    [InlineData("cookie-only")]
    [InlineData("header-only")]
    [InlineData("tampered")]
    [InlineData("forged-cookie-and-header")]
    [InlineData("wrong-pair")]
    public async Task InvalidTokenCombinationsAreRejected(string scenario)
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient(prepareCsrf: false);
        var first = await GetPair(client);
        var second = await GetPair(client);
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new { email = "user@example.com", password = LoginApiFactory.Password })
        };
        if (scenario != "header-only")
            request.Headers.Add("Cookie", scenario == "forged-cookie-and-header"
                ? first.CookieHeader.Replace(first.RequestToken, "made-up") : first.CookieHeader);
        if (scenario != "cookie-only")
            request.Headers.Add(CsrfDefaults.HeaderName, scenario switch
            {
                "tampered" => "tampered" + first.RequestToken,
                "forged-cookie-and-header" => "made-up",
                "wrong-pair" => second.RequestToken,
                _ => first.RequestToken
            });
        using var response = await client.SendAsync(request);
        await AssertCsrfFailure(response);
        Assert.Equal(0, factory.Repository.LookupCount);
    }

    [Fact]
    public async Task FormPostWithoutAjaxTokenIsRejected()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient(prepareCsrf: false);
        using var response = await client.PostAsync("/api/auth/logout",
            new StringContent("anything=value", Encoding.UTF8, "application/x-www-form-urlencoded"));
        await AssertCsrfFailure(response);
    }

    [Fact]
    public async Task MissingHeaderCannotLogoutAuthenticatedBrowser()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient(handleCookies: true, prepareCsrf: false);
        var pair = await GetPair(client);
        client.DefaultRequestHeaders.Add(CsrfDefaults.HeaderName, pair.RequestToken);
        using var login = await Login(client);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        client.DefaultRequestHeaders.Remove(CsrfDefaults.HeaderName);
        using var logout = await client.PostAsync("/api/auth/logout", null);
        await AssertCsrfFailure(logout);
        Assert.False(logout.Headers.Contains("Set-Cookie"));
        using var me = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
    }

    [Fact]
    public async Task TokensMustBeRefreshedAcrossLoginAndLogoutIdentityChanges()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient(handleCookies: true, prepareCsrf: false);
        var guestPair = await GetPair(client);
        client.DefaultRequestHeaders.Add(CsrfDefaults.HeaderName, guestPair.RequestToken);
        using var login = await Login(client);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        using var staleLogout = await client.PostAsync("/api/auth/logout", null);
        await AssertCsrfFailure(staleLogout);

        var signedInPair = await GetPair(client);
        client.DefaultRequestHeaders.Remove(CsrfDefaults.HeaderName);
        client.DefaultRequestHeaders.Add(CsrfDefaults.HeaderName, signedInPair.RequestToken);
        using var logout = await client.PostAsync("/api/auth/logout", null);
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        using var staleGuestLogout = await client.PostAsync("/api/auth/logout", null);
        await AssertCsrfFailure(staleGuestLogout);

        var freshGuest = await GetPair(client);
        client.DefaultRequestHeaders.Remove(CsrfDefaults.HeaderName);
        client.DefaultRequestHeaders.Add(CsrfDefaults.HeaderName, freshGuest.RequestToken);
        using var repeatLogout = await client.PostAsync("/api/auth/logout", null);
        Assert.Equal(HttpStatusCode.NoContent, repeatLogout.StatusCode);
    }

    [Fact]
    public async Task DifferentAuthenticatedIdentityCannotUseAnotherUsersRequestToken()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient(handleCookies: true, prepareCsrf: false);
        var guest = await GetPair(client);
        client.DefaultRequestHeaders.Add(CsrfDefaults.HeaderName, guest.RequestToken);
        using var login = await Login(client);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var userPair = await GetPair(client);

        // Control: the same cookie/token pair succeeds for the identity that obtained it.
        using var controlClient = factory.CreateHttpsClient(prepareCsrf: false);
        using var control = new HttpRequestMessage(HttpMethod.Post, "/api/auth/logout");
        control.Headers.Add(CsrfDefaults.HeaderName, userPair.RequestToken);
        control.Headers.Add("Cookie", guest.CookieHeader + "; "
            + login.Headers.GetValues("Set-Cookie").Single().Split(';')[0]);
        using var controlResponse = await controlClient.SendAsync(control);
        Assert.Equal(HttpStatusCode.NoContent, controlResponse.StatusCode);

        // Reuse the same antiforgery cookie with a different valid signed identity ticket.
        var options = factory.Services.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>()
            .Get(CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())], "Cookies"));
        var properties = new AuthenticationProperties
        {
            IssuedUtc = factory.Clock.GetUtcNow(), ExpiresUtc = factory.Clock.GetUtcNow().AddHours(8)
        };
        string otherTicket = options.TicketDataFormat.Protect(new AuthenticationTicket(principal, properties, "Cookies"));
        using var otherClient = factory.CreateHttpsClient(prepareCsrf: false);
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/logout");
        request.Headers.Add(CsrfDefaults.HeaderName, userPair.RequestToken);
        request.Headers.Add("Cookie", guest.CookieHeader + "; __Host-TodoApp.Auth=" + otherTicket);
        using var response = await otherClient.SendAsync(request);
        await AssertCsrfFailure(response);
    }

    private static Task<HttpResponseMessage> Login(HttpClient client) => client.PostAsJsonAsync("/api/auth/login",
        new { email = "user@example.com", password = LoginApiFactory.Password });

    private static async Task<(string RequestToken, string CookieHeader)> GetPair(HttpClient client)
    {
        using var response = await client.GetAsync("/api/auth/csrf");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var cookies = response.Headers.GetValues("Set-Cookie").Select(value => SetCookieHeaderValue.Parse(value)).ToArray();
        string requestToken = cookies.Single(cookie => cookie.Name == CsrfDefaults.RequestCookieName).Value.ToString();
        // The existing internal cookie might not be reissued. The browser-like client retains it.
        string cookieHeader = string.Join("; ", cookies.Select(cookie => $"{cookie.Name}={cookie.Value}"));
        return (requestToken, cookieHeader);
    }

    private static async Task AssertCsrfFailure(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("csrf_validation_failed", body.RootElement.GetProperty("code").GetString());
        Assert.Equal("CSRF validation failed.", body.RootElement.GetProperty("title").GetString());
        Assert.False(body.RootElement.TryGetProperty("errors", out _));
    }
}
