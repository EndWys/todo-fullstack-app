using TodoApp.Domain.Features.Users;
using TodoApp.Domain.Features.Users.Entities;

namespace TodoApp.Domain.Tests.Users;

public sealed class UserTests
{
    [Fact]
    public void CreateAssignsIdAndKeepsProvidedEmailAndHash()
    {
        Email email = Email.Create("User@Example.com");
        const string storedHash = "encoded-hash-from-hasher";

        User user = User.Create(email, storedHash);

        Assert.NotEqual(Guid.Empty, user.UserId);
        Assert.Same(email, user.Email);
        Assert.Equal(storedHash, user.PasswordHash);
    }

    [Fact]
    public void CreateAssignsDifferentIdsToDifferentUsers()
    {
        Email email = Email.Create("user@example.com");

        User first = User.Create(email, "first-encoded-hash");
        User second = User.Create(email, "second-encoded-hash");

        Assert.NotEqual(first.UserId, second.UserId);
    }

    [Fact]
    public void CreateRejectsNullEmail()
    {
        ArgumentNullException exception = Assert.Throws<ArgumentNullException>(
            () => User.Create(null!, "encoded-hash"));

        Assert.Equal("email", exception.ParamName);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t\r\n")]
    public void CreateRejectsMissingPasswordHash(string? passwordHash)
    {
        Email email = Email.Create("user@example.com");

        ArgumentException exception = Assert.Throws<ArgumentException>(
            () => User.Create(email, passwordHash!));

        Assert.Equal("passwordHash", exception.ParamName);
    }
}
