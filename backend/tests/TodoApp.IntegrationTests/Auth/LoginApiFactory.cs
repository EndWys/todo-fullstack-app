using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Mvc.Testing.Handlers;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TodoApp.Application.Features.Auth.Abstractions;
using TodoApp.Domain.Features.Auth;

namespace TodoApp.IntegrationTests.Auth;

// Shared HTTP/cookie test host. No SQL Server connections are made by this fixture.
internal sealed class LoginApiFactory : WebApplicationFactory<Program>
{
    public const string Password = " correct horse battery staple ";
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

    public HttpClient CreateHttpsClient(bool handleCookies = false, bool prepareCsrf = true)
    {
        var handlers = new List<DelegatingHandler>();
        if (prepareCsrf) handlers.Add(new CsrfTestHandler(handleCookies));
        if (handleCookies) handlers.Add(new CookieContainerHandler());
        return CreateDefaultClient(new Uri("https://localhost"), handlers.ToArray());
    }

    internal sealed class TestClock : TimeProvider
    {
        private DateTimeOffset now = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow() => now;
        public void Advance(TimeSpan duration) => now += duration;
    }

    internal sealed class FakeRepository : IAuthRepository
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
