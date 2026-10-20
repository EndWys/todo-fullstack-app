using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using TodoApp.Infrastructure.Features.Auth.Register;

namespace TodoApp.Infrastructure.Tests.Features.Auth.Register;

public sealed class AspNetPasswordHasherTests
{
    [Fact]
    public void HashPasswordCanBeVerifiedWithOriginalPasswordButNotAnotherPassword()
    {
        const string password = "correct horse battery staple";
        var identityHasher = new PasswordHasher<object>();
        var adapter = new AspNetPasswordHasher(identityHasher);

        string passwordHash = adapter.HashPassword(password);

        Assert.True(adapter.VerifyHashedPassword(passwordHash, password));
        Assert.False(adapter.VerifyHashedPassword(passwordHash, "different password"));

        Assert.Equal(
            PasswordVerificationResult.Success,
            identityHasher.VerifyHashedPassword(new object(), passwordHash, password));
        Assert.Equal(
            PasswordVerificationResult.Failed,
            identityHasher.VerifyHashedPassword(new object(), passwordHash, "different password"));
    }

    [Fact]
    public void VerifyHashedPasswordAcceptsSupportedHashNeedingRehash()
    {
        const string password = "correct horse battery staple";
        var oldHasher = new PasswordHasher<object>(Options.Create(new PasswordHasherOptions
        {
            IterationCount = 1_000
        }));
        string oldHash = oldHasher.HashPassword(new object(), password);
        var currentHasher = new PasswordHasher<object>();
        var adapter = new AspNetPasswordHasher(currentHasher);

        Assert.Equal(
            PasswordVerificationResult.SuccessRehashNeeded,
            currentHasher.VerifyHashedPassword(new object(), oldHash, password));
        Assert.True(adapter.VerifyHashedPassword(oldHash, password));
        Assert.False(adapter.VerifyHashedPassword(oldHash, "different password"));
    }

    [Fact]
    public void VerifyHashedPasswordPreservesLeadingAndTrailingSpaces()
    {
        const string password = "  correct horse battery staple  ";
        var adapter = new AspNetPasswordHasher(new PasswordHasher<object>());
        string passwordHash = adapter.HashPassword(password);

        Assert.True(adapter.VerifyHashedPassword(passwordHash, password));
        Assert.False(adapter.VerifyHashedPassword(passwordHash, password.Trim()));
    }

    [Fact]
    public void VerifyHashedPasswordRejectsDifferentCase()
    {
        var adapter = new AspNetPasswordHasher(new PasswordHasher<object>());
        string passwordHash = adapter.HashPassword("Correct horse battery staple");

        Assert.False(adapter.VerifyHashedPassword(passwordHash, "correct horse battery staple"));
    }
}
