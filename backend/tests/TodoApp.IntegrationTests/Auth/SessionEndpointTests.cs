using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace TodoApp.IntegrationTests.Auth;

public sealed class SessionEndpointTests
{
    private const string MeRoute = "/api/auth/me";
    private const string LogoutRoute = "/api/auth/logout";
    private const string CookieName = "__Host-TodoApp.Auth";

    [Fact]
    public async Task MeWithoutCookieReturnsUnauthorizedWithoutRedirect()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient();
        using var response = await client.GetAsync(MeRoute);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Null(response.Headers.Location);
        Assert.False(response.Headers.Contains("Set-Cookie"));
        Assert.Equal(0, factory.Repository.LookupCount);
    }

    [Fact]
    public async Task MeReturnsOnlyTicketIdentityWithoutDatabaseLookupOrCookieRenewal()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient(handleCookies: true);
        using var login = await LoginAsync(client);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        factory.Repository.Failure = new InvalidOperationException("Me must not query the database.");

        // A second request (and a page reload) restores identity from the cookie, not client state.
        using var response = await client.GetAsync(MeRoute);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(factory.Repository.User.UserId, json.RootElement.GetProperty("id").GetGuid());
        Assert.Equal("User@Example.com", json.RootElement.GetProperty("email").GetString());
        Assert.Equal(2, json.RootElement.EnumerateObject().Count());
        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.False(response.Headers.Contains("Set-Cookie"));
        Assert.Equal(1, factory.Repository.LookupCount);
    }

    [Fact]
    public async Task MeRejectsExpiredTicketWithoutSlidingRenewal()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient(handleCookies: true);
        using var login = await LoginAsync(client);
        factory.Clock.Advance(TimeSpan.FromHours(7));
        using var beforeExpiry = await client.GetAsync(MeRoute);
        Assert.Equal(HttpStatusCode.OK, beforeExpiry.StatusCode);
        Assert.False(beforeExpiry.Headers.Contains("Set-Cookie"));
        factory.Clock.Advance(TimeSpan.FromHours(1) + TimeSpan.FromSeconds(1));
        using var afterExpiry = await client.GetAsync(MeRoute);
        Assert.Equal(HttpStatusCode.Unauthorized, afterExpiry.StatusCode);
        Assert.Null(afterExpiry.Headers.Location);
    }

    [Fact]
    public async Task MeRejectsTamperedCookie()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient();
        using var login = await LoginAsync(client);
        string cookie = Assert.Single(login.Headers.GetValues("Set-Cookie")).Split(';')[0];
        using var request = new HttpRequestMessage(HttpMethod.Get, MeRoute);
        request.Headers.Add("Cookie", cookie.Replace(CookieName + "=", CookieName + "=tampered"));
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Null(response.Headers.Location);
    }

    [Theory]
    [InlineData(null, "user@example.com")]
    [InlineData("not-a-guid", "user@example.com")]
    [InlineData("00000000-0000-0000-0000-000000000000", "user@example.com")]
    [InlineData("11111111-1111-1111-1111-111111111111", null)]
    [InlineData("11111111-1111-1111-1111-111111111111", "  ")]
    public async Task MeRejectsProtectedTicketWithIncompleteIdentity(string? id, string? email)
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient();
        var options = factory.Services.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>()
            .Get(CookieAuthenticationDefaults.AuthenticationScheme);
        var claims = new List<Claim>();
        if (id is not null) claims.Add(new Claim(ClaimTypes.NameIdentifier, id));
        if (email is not null) claims.Add(new Claim(ClaimTypes.Email, email));
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var properties = new AuthenticationProperties
        {
            IssuedUtc = factory.Clock.GetUtcNow(), ExpiresUtc = factory.Clock.GetUtcNow().AddHours(8)
        };
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), properties,
            CookieAuthenticationDefaults.AuthenticationScheme);
        using var request = new HttpRequestMessage(HttpMethod.Get, MeRoute);
        request.Headers.Add("Cookie", CookieName + "=" + options.TicketDataFormat.Protect(ticket));
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Null(response.Headers.Location);
    }

    [Fact]
    public async Task LogoutDeletesCookieAndSubsequentMeIsUnauthorized()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient(handleCookies: true);
        using var login = await LoginAsync(client);
        using var beforeLogout = await client.GetAsync(MeRoute);
        Assert.Equal(HttpStatusCode.OK, beforeLogout.StatusCode);
        using var logout = await client.PostAsync(LogoutRoute, null);
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Empty(await logout.Content.ReadAsStringAsync());
        var deletion = SetCookieHeaderValue.Parse(Assert.Single(logout.Headers.GetValues("Set-Cookie")));
        Assert.Equal(CookieName, deletion.Name.ToString());
        Assert.Equal("", deletion.Value.ToString());
        Assert.Equal("/", deletion.Path.ToString());
        Assert.False(deletion.Domain.HasValue);
        Assert.True(deletion.Secure);
        Assert.True(deletion.HttpOnly);
        Assert.True(deletion.Expires < DateTimeOffset.UtcNow);
        using var afterLogout = await client.GetAsync(MeRoute);
        Assert.Equal(HttpStatusCode.Unauthorized, afterLogout.StatusCode);
        using var secondLogout = await client.PostAsync(LogoutRoute, null);
        Assert.Equal(HttpStatusCode.NoContent, secondLogout.StatusCode);
        Assert.Equal(1, factory.Repository.LookupCount);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("__Host-TodoApp.Auth=broken")]
    public async Task LogoutWithoutValidSessionStillSucceeds(string? cookie)
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, LogoutRoute);
        if (cookie is not null) request.Headers.Add("Cookie", cookie);
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Null(response.Headers.Location);
        Assert.Equal(0, factory.Repository.LookupCount);
    }

    [Fact]
    public async Task LogoutWithExpiredSessionStillSucceeds()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient(handleCookies: true);
        using var login = await LoginAsync(client);
        factory.Clock.Advance(TimeSpan.FromHours(9));
        using var response = await client.PostAsync(LogoutRoute, null);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task LogoutDoesNotRevokeIndependentlySavedTicket_CurrentStatelessLimitation()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient();
        using var login = await LoginAsync(client);
        string cookie = Assert.Single(login.Headers.GetValues("Set-Cookie")).Split(';')[0];
        using var logoutRequest = new HttpRequestMessage(HttpMethod.Post, LogoutRoute);
        logoutRequest.Headers.Add("Cookie", cookie);
        using var logout = await client.SendAsync(logoutRequest);
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);

        // Document the limitation: deleting a browser cookie is not server-side ticket revocation.
        using var replay = new HttpRequestMessage(HttpMethod.Get, MeRoute);
        replay.Headers.Add("Cookie", cookie);
        using var response = await client.SendAsync(replay);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetLogoutDoesNotSignOut()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient(handleCookies: true);
        using var login = await LoginAsync(client);
        using var response = await client.GetAsync(LogoutRoute);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
        Assert.False(response.Headers.Contains("Set-Cookie"));
        using var me = await client.GetAsync(MeRoute);
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
    }

    private static Task<HttpResponseMessage> LoginAsync(HttpClient client) =>
        client.PostAsJsonAsync("/api/auth/login", new { email = "user@example.com", password = LoginApiFactory.Password });
}
