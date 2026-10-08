using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TodoApp.Application.Features.Auth.Abstractions;
using TodoApp.Domain.Features.Auth;

namespace TodoApp.IntegrationTests.Auth;

public sealed class RegisterEndpointTests
{
    private const string Route = "/api/auth/register";
    private const string ValidPassword = "correct horse battery staple";

    [Fact]
    public async Task Register_WithValidData_CreatesUserAndReturnsOnlyPublicFields()
    {
        string email = $"NewUser-{Guid.NewGuid():N}@Example.com";
        using var factory = new TestApiFactory();
        using HttpClient client = factory.CreateSafeClient();

        try
        {
            using HttpResponseMessage response = await client.PostAsJsonAsync(Route, new
            {
                email = $"  {email}  ",
                password = ValidPassword
            });

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            Assert.False(response.Headers.Contains("Set-Cookie"));

            using JsonDocument body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            JsonElement root = body.RootElement;
            Guid userId = root.GetProperty("id").GetGuid();
            Assert.Equal(email, root.GetProperty("email").GetString());
            Assert.Equal(2, root.EnumerateObject().Count());

            await using var dbContext = TestDatabase.CreateDbContext();
            var saved = await dbContext.Users.AsNoTracking().SingleAsync(user => user.UserId == userId);
            Assert.Equal(email, saved.Email.EmailAddress);
            Assert.NotEqual(ValidPassword, saved.PasswordHash);
            Assert.Equal(
                PasswordVerificationResult.Success,
                new PasswordHasher<object>().VerifyHashedPassword(new object(), saved.PasswordHash, ValidPassword));
        }
        finally
        {
            await DeleteTestUserAsync(email);
        }
    }

    [Fact]
    public async Task Register_WithMissingFields_ReturnsFieldErrors()
    {
        using var factory = new TestApiFactory();
        using HttpClient client = factory.CreateSafeClient();

        using HttpResponseMessage response = await client.PostAsJsonAsync(Route, new { });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using JsonDocument body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        JsonElement errors = body.RootElement.GetProperty("errors");
        Assert.True(errors.TryGetProperty("email", out _));
        Assert.True(errors.TryGetProperty("password", out _));
    }

    [Fact]
    public async Task Register_WithInvalidEmail_ReturnsEmailError()
    {
        using var factory = new TestApiFactory();
        using HttpClient client = factory.CreateSafeClient();

        using HttpResponseMessage response = await client.PostAsJsonAsync(Route, new
        {
            email = "not-an-email",
            password = ValidPassword
        });

        await AssertFieldErrorAsync(response, HttpStatusCode.BadRequest, "email");
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Register_WhenHasherThrowsUnrelatedException_ReturnsServerError(bool argumentException)
    {
        string email = $"hasher-failure-{Guid.NewGuid():N}@example.com";
        Exception failure = argumentException
            ? new ArgumentException("Hasher configuration failed.", "email")
            : new FormatException("Hasher configuration failed.");
        using var factory = new TestApiFactory(services =>
            services.AddScoped<IPasswordHasher>(_ => new ThrowingPasswordHasher(failure)));
        using HttpClient client = factory.CreateSafeClient();

        try
        {
            using HttpResponseMessage response = await client.PostAsJsonAsync(Route, new
            {
                email,
                password = ValidPassword
            });

            Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
            using JsonDocument body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.False(body.RootElement.TryGetProperty("errors", out _));
        }
        finally
        {
            await DeleteTestUserAsync(email);
        }
    }

    [Theory]
    [InlineData("too-short")]
    [InlineData("               ")]
    public async Task Register_WithInvalidPassword_ReturnsPasswordError(string password)
    {
        string email = $"invalid-password-{Guid.NewGuid():N}@example.com";
        using var factory = new TestApiFactory();
        using HttpClient client = factory.CreateSafeClient();

        try
        {
            using HttpResponseMessage response = await client.PostAsJsonAsync(Route, new { email, password });

            await AssertFieldErrorAsync(response, HttpStatusCode.BadRequest, "password");
            await using var dbContext = TestDatabase.CreateDbContext();
            Email address = Email.Create(email);
            Assert.False(await dbContext.Users.AnyAsync(user => user.Email == address));
        }
        finally
        {
            await DeleteTestUserAsync(email);
        }
    }

    [Fact]
    public async Task Register_WithExistingEmailIgnoringCase_ReturnsConflictAndDoesNotCreateAnotherUser()
    {
        string suffix = Guid.NewGuid().ToString("N");
        string email = $"Duplicate-{suffix}@Example.com";
        string duplicate = $"duplicate-{suffix}@example.com";
        using var factory = new TestApiFactory();
        using HttpClient client = factory.CreateSafeClient();

        try
        {
            using HttpResponseMessage first = await client.PostAsJsonAsync(Route, new
            {
                email,
                password = ValidPassword
            });
            Assert.Equal(HttpStatusCode.Created, first.StatusCode);

            using HttpResponseMessage second = await client.PostAsJsonAsync(Route, new
            {
                email = duplicate,
                password = "another secure password"
            });

            await AssertFieldErrorAsync(second, HttpStatusCode.Conflict, "email");
            await using var dbContext = TestDatabase.CreateDbContext();
            Email address = Email.Create(email);
            Assert.Equal(1, await dbContext.Users.CountAsync(user => user.Email == address));
        }
        finally
        {
            await DeleteTestUserAsync(email);
        }
    }

    private static async Task AssertFieldErrorAsync(
        HttpResponseMessage response,
        HttpStatusCode expectedStatus,
        string field)
    {
        Assert.Equal(expectedStatus, response.StatusCode);
        using JsonDocument body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        JsonElement errors = body.RootElement.GetProperty("errors");
        Assert.True(errors.TryGetProperty(field, out JsonElement messages));
        Assert.NotEmpty(messages.EnumerateArray());
    }

    private static async Task DeleteTestUserAsync(string email)
    {
        await using var dbContext = TestDatabase.CreateDbContext();
        Email address = Email.Create(email);
        await dbContext.Users.Where(user => user.Email == address).ExecuteDeleteAsync();
    }

    private sealed class ThrowingPasswordHasher(Exception failure) : IPasswordHasher
    {
        public string HashPassword(string password) => throw failure;
    }
}
