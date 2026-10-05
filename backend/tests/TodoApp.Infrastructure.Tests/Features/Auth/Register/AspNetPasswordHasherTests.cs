using Microsoft.AspNetCore.Identity;
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

        Assert.Equal(
            PasswordVerificationResult.Success,
            identityHasher.VerifyHashedPassword(new object(), passwordHash, password));
        Assert.Equal(
            PasswordVerificationResult.Failed,
            identityHasher.VerifyHashedPassword(new object(), passwordHash, "different password"));
    }
}
