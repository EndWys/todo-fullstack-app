using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using TodoApp.Application.Features.Auth.Abstractions;
using TodoApp.Application.Features.Auth.Login;
using TodoApp.Domain.Features.Auth;
using TodoApp.Infrastructure.Features.Auth.Register;
using TodoApp.Infrastructure.Features.Auth.Security;

namespace TodoApp.Infrastructure.Tests.Features.Auth;

public sealed class LoginVerificationTests
{
    [Fact]
    public async Task HandlerVerifiesRealHashWithoutChangingPasswordOrCreatingSession()
    {
        const string password = "  correct horse battery staple  ";
        var options = Options.Create(new PasswordHasherOptions());
        var hasher = new AspNetPasswordHasher(new PasswordHasher<object>(options));
        User user = User.Create(Email.Create("User@example.com"), hasher.HashPassword(password));
        var handler = new LoginHandler(new Repository(user), hasher, new DummyPasswordHash(options));

        LoginResult result = await handler.Handle(
            new LoginCommand(" user@example.com ", password), CancellationToken.None);
        Assert.Equal(new LoginResult(user.UserId, user.Email.EmailAddress), result);

        await Assert.ThrowsAsync<InvalidCredentialsException>(() =>
            handler.Handle(new LoginCommand("user@example.com", password.Trim()), CancellationToken.None));
    }

    [Fact]
    public async Task MissingUserUsesRealDummyHashAndNeverAuthenticates()
    {
        var options = Options.Create(new PasswordHasherOptions());
        var hasher = new AspNetPasswordHasher(new PasswordHasher<object>(options));
        var dummy = new DummyPasswordHash(options);
        string originalHash = dummy.Hash;
        var handler = new LoginHandler(new Repository(null), hasher, dummy);

        for (int attempt = 0; attempt < 2; attempt++)
        {
            await Assert.ThrowsAsync<InvalidCredentialsException>(() =>
                handler.Handle(new LoginCommand("missing@example.com", "correct horse battery staple"),
                    CancellationToken.None));
            Assert.Equal(originalHash, dummy.Hash);
        }
    }

    private sealed class Repository(User? user) : IAuthRepository
    {
        public Task<User?> GetByEmailAsync(Email email, CancellationToken cancellationToken) =>
            Task.FromResult(user);
        public Task<bool> ExistsByEmailAsync(Email email, CancellationToken cancellationToken) =>
            throw new NotSupportedException();
        public Task AddAsync(User user, CancellationToken cancellationToken) =>
            throw new NotSupportedException();
    }
}
