using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using TodoApp.Api.Features.Auth.Login;
using TodoApp.Application.Features.Auth.Abstractions;
using TodoApp.Domain.Features.Auth;

namespace TodoApp.IntegrationTests.Auth;

// HTTP/framework integration with a repository double: these tests never connect to SQL Server.
public sealed class LoginEndpointTests
{
    private const string Route = "/api/auth/login";
    private const string Password = " correct horse battery staple ";
    private const string CookieName = "__Host-TodoApp.Auth";

    [Fact]
    public async Task ValidCredentialsReturnPublicFieldsAndProtectedSessionCookie()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync(Route,
            new { email = "  user@example.com  ", password = Password });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(factory.Repository.User.UserId, json.RootElement.GetProperty("id").GetGuid());
        Assert.Equal("User@Example.com", json.RootElement.GetProperty("email").GetString());
        Assert.Equal(2, json.RootElement.EnumerateObject().Count());

        string cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"));
        Assert.StartsWith(CookieName + "=", cookie);
        Assert.Contains("; path=/", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("; secure", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("; httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("; samesite=lax", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("domain=", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("expires=", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(Password, cookie);

        var options = factory.Services.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>()
            .Get(CookieAuthenticationDefaults.AuthenticationScheme);
        string protectedValue = Uri.UnescapeDataString(cookie.Split(';')[0][(CookieName.Length + 1)..]);
        AuthenticationTicket ticket = Assert.IsType<AuthenticationTicket>(options.TicketDataFormat.Unprotect(protectedValue));
        Assert.Equal(TimeSpan.FromHours(8), ticket.Properties.ExpiresUtc - ticket.Properties.IssuedUtc);
        Assert.False(ticket.Properties.IsPersistent);
        Assert.False(options.SlidingExpiration);
        Assert.Equal(factory.Repository.User.UserId.ToString(), ticket.Principal.FindFirstValue(ClaimTypes.NameIdentifier));
        Assert.Equal("User@Example.com", ticket.Principal.FindFirstValue(ClaimTypes.Email));
        Assert.Equal(2, ticket.Principal.Claims.Count());

        var authenticated = await AuthenticateAsync(factory, cookie);
        Assert.True(authenticated.Succeeded);
        factory.Clock.Advance(TimeSpan.FromHours(7));
        Assert.True((await AuthenticateAsync(factory, cookie)).Succeeded);
        factory.Clock.Advance(TimeSpan.FromHours(1) + TimeSpan.FromSeconds(1));
        Assert.False((await AuthenticateAsync(factory, cookie)).Succeeded);
    }

    [Fact]
    public async Task UnknownEmailAndWrongPasswordReturnSameUnauthorizedProblemWithoutCookie()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient();
        foreach (var input in new[]
        {
            new { email = "missing@example.com", password = Password },
            new { email = "user@example.com", password = "a completely wrong password" }
        })
        {
            using var response = await client.PostAsJsonAsync(Route, input);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Null(response.Headers.Location);
            Assert.False(response.Headers.Contains("Set-Cookie"));
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal("Invalid email or password.", json.RootElement.GetProperty("title").GetString());
            Assert.Equal(401, json.RootElement.GetProperty("status").GetInt32());
        }
    }

    [Theory]
    [InlineData(null, Password, "email")]
    [InlineData("  ", Password, "email")]
    [InlineData("broken-address", Password, "email")]
    [InlineData("user@example.com", null, "password")]
    [InlineData("user@example.com", "", "password")]
    [InlineData("user@example.com", "short", "password")]
    [InlineData("user@example.com", "               ", "password")]
    public async Task InvalidFieldsReturnValidationProblemWithoutLookup(string? email, string? password, string field)
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync(Route, new { email, password });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.NotEmpty(json.RootElement.GetProperty("errors").GetProperty(field).EnumerateArray());
        Assert.False(response.Headers.Contains("Set-Cookie"));
        Assert.Equal(0, factory.Repository.LookupCount);
    }

    [Fact]
    public async Task OverlongPasswordIsRejectedBeforeLookup()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync(Route,
            new { email = "user@example.com", password = new string('a', 257) });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, factory.Repository.LookupCount);
    }

    [Fact]
    public async Task MissingBothFieldsReturnBothErrors()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync(Route, new { });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var errors = json.RootElement.GetProperty("errors");
        Assert.NotEmpty(errors.GetProperty("email").EnumerateArray());
        Assert.NotEmpty(errors.GetProperty("password").EnumerateArray());
    }

    [Theory]
    [InlineData(null, Password, "email")]
    [InlineData("invalid", Password, "email")]
    [InlineData("user@example.com", "short", "password")]
    public async Task RegistrationStillUsesSharedFieldErrors(string? email, string password, string field)
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync("/api/auth/register", new { email, password });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.NotEmpty(json.RootElement.GetProperty("errors").GetProperty(field).EnumerateArray());
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    [Theory]
    [InlineData("null")]
    [InlineData("{}")]
    [InlineData("{")]
    public async Task InvalidBodyDoesNotSetCookie(string body)
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsync(Route, new StringContent(body, Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.False(response.Headers.Contains("Set-Cookie"));
        Assert.Equal(0, factory.Repository.LookupCount);
    }

    [Fact]
    public async Task DatabaseFailureRemainsServerErrorAndDoesNotLeakDetails()
    {
        using var factory = new LoginApiFactory();
        factory.Repository.Failure = new InvalidOperationException("private-database-failure");
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync(Route, new { email = "user@example.com", password = Password });
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.False(response.Headers.Contains("Set-Cookie"));
        Assert.DoesNotContain("private-database-failure", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task TamperedCookieCannotAuthenticate()
    {
        using var factory = new LoginApiFactory();
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync(Route, new { email = "user@example.com", password = Password });
        string cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"));
        Assert.False((await AuthenticateAsync(factory, cookie.Replace(CookieName + "=", CookieName + "=tampered"))).Succeeded);
    }

    [Theory]
    [InlineData(false, StatusCodes.Status401Unauthorized)]
    [InlineData(true, StatusCodes.Status403Forbidden)]
    public async Task CookieChallengeAndForbidNeverRedirect(bool forbid, int status)
    {
        using var factory = new LoginApiFactory();
        using var scope = factory.Services.CreateScope();
        var context = new DefaultHttpContext { RequestServices = scope.ServiceProvider };
        if (forbid) await context.ForbidAsync();
        else await context.ChallengeAsync();
        Assert.Equal(status, context.Response.StatusCode);
        Assert.False(context.Response.Headers.ContainsKey("Location"));
    }

    [Fact]
    public void RequestToStringDoesNotExposePassword() =>
        Assert.Equal(nameof(LoginRequest), new LoginRequest("user@example.com", Password).ToString());

    private static async Task<AuthenticateResult> AuthenticateAsync(LoginApiFactory factory, string cookie)
    {
        using var scope = factory.Services.CreateScope();
        var context = new DefaultHttpContext { RequestServices = scope.ServiceProvider };
        context.Request.Scheme = "https";
        context.Request.Headers.Cookie = cookie.Split(';')[0];
        return await context.AuthenticateAsync();
    }

    private sealed class LoginApiFactory : WebApplicationFactory<Program>
    {
        public FakeRepository Repository { get; } = new();
        public TestClock Clock { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            // A deliberately unreachable placeholder: the repository is replaced, so no DB is used.
            builder.UseSetting("ConnectionStrings:TodoApp", "Server=unused.invalid;Database=TodoAppTest;Integrated Security=True;Encrypt=True");
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IAuthRepository>();
                services.AddSingleton<IAuthRepository>(Repository);
                services.PostConfigure<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme,
                    options => options.TimeProvider = Clock);
            });
        }

        public HttpClient CreateHttpsClient() => CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false, HandleCookies = false
        });
    }

    private sealed class TestClock : TimeProvider
    {
        private DateTimeOffset now = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow() => now;
        public void Advance(TimeSpan duration) => now += duration;
    }

    private sealed class FakeRepository : IAuthRepository
    {
        public User User { get; } = User.Create(Email.Create("User@Example.com"),
            new Microsoft.AspNetCore.Identity.PasswordHasher<object>().HashPassword(new object(), Password));
        public int LookupCount { get; private set; }
        public Exception? Failure { get; set; }

        public Task<User?> GetByEmailAsync(Email email, CancellationToken cancellationToken)
        {
            LookupCount++;
            if (Failure is not null) throw Failure;
            return Task.FromResult(User.Email.Equals(email) ? User : null);
        }

        public Task<bool> ExistsByEmailAsync(Email email, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task AddAsync(User user, CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
