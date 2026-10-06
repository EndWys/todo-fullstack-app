using Microsoft.EntityFrameworkCore;
using TodoApp.Application.Features.Auth.Register;
using TodoApp.Domain.Features.Auth;
using TodoApp.Infrastructure.Features.Auth.Persistence;
using TodoApp.Infrastructure.Persistence;

namespace TodoApp.IntegrationTests.Auth;

public sealed class AuthRepositoryTests
{
    [Fact]
    public async Task ExistsByEmailAsync_WhenEmailDoesNotExist_ReturnsFalse()
    {
        await using var dbContext = TestDatabase.CreateDbContext();
        var repository = new AuthRepository(dbContext);
        var email = Email.Create($"missing-{Guid.NewGuid():N}@example.com");

        bool exists = await repository.ExistsByEmailAsync(email, CancellationToken.None);

        Assert.False(exists);
    }

    [Fact]
    public async Task AddAsync_PersistsUserAndPasswordHash()
    {
        await using var dbContext = TestDatabase.CreateDbContext();
        await using var transaction = await dbContext.Database.BeginTransactionAsync();
        var repository = new AuthRepository(dbContext);
        var email = Email.Create($"saved-{Guid.NewGuid():N}@example.com");
        var user = User.Create(email, "stored-test-hash");

        await repository.AddAsync(user, CancellationToken.None);

        // Force EF Core to read the user from SQL Server instead of its change tracker.
        dbContext.ChangeTracker.Clear();
        User savedUser = await dbContext.Users.SingleAsync(saved => saved.UserId == user.UserId);

        Assert.Equal(user.UserId, savedUser.UserId);
        Assert.Equal(email.EmailAddress, savedUser.Email.EmailAddress);
        Assert.Equal("stored-test-hash", savedUser.PasswordHash);
        Assert.True(await repository.ExistsByEmailAsync(email, CancellationToken.None));
    }

    [Fact]
    public async Task ExistsByEmailAsync_IgnoresEmailCase()
    {
        await using var dbContext = TestDatabase.CreateDbContext();
        await using var transaction = await dbContext.Database.BeginTransactionAsync();
        var repository = new AuthRepository(dbContext);
        string suffix = Guid.NewGuid().ToString("N");
        var storedEmail = Email.Create($"MixedCase-{suffix}@Example.com");
        var searchedEmail = Email.Create($"mixedcase-{suffix}@example.com");

        await repository.AddAsync(User.Create(storedEmail, "stored-test-hash"), CancellationToken.None);

        Assert.True(await repository.ExistsByEmailAsync(searchedEmail, CancellationToken.None));
    }

    [Fact]
    public async Task AddAsync_WhenEmailAlreadyExists_IgnoresCaseAndThrowsEmailAlreadyRegistered()
    {
        await using var dbContext = TestDatabase.CreateDbContext();
        await using var transaction = await dbContext.Database.BeginTransactionAsync();
        var repository = new AuthRepository(dbContext);
        string suffix = Guid.NewGuid().ToString("N");
        var firstEmail = Email.Create($"Duplicate-{suffix}@Example.com");
        var duplicateEmail = Email.Create($"duplicate-{suffix}@example.com");

        await repository.AddAsync(User.Create(firstEmail, "first-test-hash"), CancellationToken.None);

        await Assert.ThrowsAsync<EmailAlreadyRegisteredException>(() =>
            repository.AddAsync(User.Create(duplicateEmail, "second-test-hash"), CancellationToken.None));
    }
}
