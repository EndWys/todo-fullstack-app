using TodoApp.Application.Features.Auth.Abstractions;
using TodoApp.Application.Features.Auth.Register;
using TodoApp.Domain.Features.Auth;

namespace TodoApp.Application.Tests.Auth.Register;

public sealed class RegisterHandlerTests
{
    private const string ValidPassword = "correct horse battery staple";
    private const string PasswordHash = "encoded-password-hash";

    [Fact]
    public async Task HandleCreatesAndPersistsUserAndReturnsPublicResult()
    {
        const string inputEmail = "  User@Example.com  ";
        var repository = new FakeAuthRepository();
        var passwordHasher = new FakePasswordHasher(PasswordHash);
        var handler = new RegisterHandler(repository, passwordHasher);

        RegisterResult result = await handler.Handle(
            new RegisterCommand(inputEmail, ValidPassword), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.UserId);
        Assert.Equal("User@Example.com", result.Email);
        Assert.Equal(ValidPassword, passwordHasher.PasswordHashed);
        Assert.Equal(1, repository.ExistenceCheckCount);
        Assert.NotNull(repository.AddedUser);
        Assert.Equal(result.UserId, repository.AddedUser.UserId);
        Assert.Equal(result.Email, repository.AddedUser.Email.EmailAddress);
        Assert.Equal(PasswordHash, repository.AddedUser.PasswordHash);
    }

    [Fact]
    public async Task HandleChecksForExistingEmailBeforeHashingOrSaving()
    {
        var repository = new FakeAuthRepository { EmailExists = true };
        var passwordHasher = new FakePasswordHasher(PasswordHash);
        var handler = new RegisterHandler(repository, passwordHasher);

        await Assert.ThrowsAsync<EmailAlreadyRegisteredException>(() =>
            handler.Handle(new RegisterCommand("user@example.com", ValidPassword), CancellationToken.None));

        Assert.Equal(1, repository.ExistenceCheckCount);
        Assert.Null(repository.AddedUser);
        Assert.Null(passwordHasher.PasswordHashed);
    }

    [Theory]
    [InlineData(null, PasswordValidationError.Required)]
    [InlineData("", PasswordValidationError.Required)]
    [InlineData("               ", PasswordValidationError.OnlyWhitespace)]
    [InlineData("12345678901234", PasswordValidationError.TooShort)]
    public async Task HandleRejectsInvalidPasswordBeforeRepositoryOrHasher(
        string? password,
        PasswordValidationError expectedError)
    {
        var repository = new FakeAuthRepository();
        var passwordHasher = new FakePasswordHasher(PasswordHash);
        var handler = new RegisterHandler(repository, passwordHasher);

        InvalidPasswordException exception = await Assert.ThrowsAsync<InvalidPasswordException>(() =>
            handler.Handle(new RegisterCommand("user@example.com", password), CancellationToken.None));

        Assert.Equal(expectedError, exception.Error);
        Assert.Equal(0, repository.ExistenceCheckCount);
        Assert.Null(repository.AddedUser);
        Assert.Null(passwordHasher.PasswordHashed);
    }

    [Fact]
    public async Task HandleRejectsPasswordAboveMaximumBeforeRepositoryOrHasher()
    {
        var repository = new FakeAuthRepository();
        var passwordHasher = new FakePasswordHasher(PasswordHash);
        var handler = new RegisterHandler(repository, passwordHasher);

        InvalidPasswordException exception = await Assert.ThrowsAsync<InvalidPasswordException>(() =>
            handler.Handle(
                new RegisterCommand("user@example.com", new string('a', 257)),
                CancellationToken.None));

        Assert.Equal(PasswordValidationError.TooLong, exception.Error);
        Assert.Equal(0, repository.ExistenceCheckCount);
        Assert.Null(repository.AddedUser);
        Assert.Null(passwordHasher.PasswordHashed);
    }

    [Fact]
    public async Task HandlePropagatesInvalidEmailWithoutHashingOrSaving()
    {
        var repository = new FakeAuthRepository();
        var passwordHasher = new FakePasswordHasher(PasswordHash);
        var handler = new RegisterHandler(repository, passwordHasher);

        await Assert.ThrowsAsync<FormatException>(() =>
            handler.Handle(new RegisterCommand("not-an-email", ValidPassword), CancellationToken.None));

        Assert.Equal(0, repository.ExistenceCheckCount);
        Assert.Null(repository.AddedUser);
        Assert.Null(passwordHasher.PasswordHashed);
    }

    [Fact]
    public async Task HandlePassesCancellationTokenToRepository()
    {
        using var cancellationSource = new CancellationTokenSource();
        var repository = new FakeAuthRepository();
        var passwordHasher = new FakePasswordHasher(PasswordHash);
        var handler = new RegisterHandler(repository, passwordHasher);

        await handler.Handle(
            new RegisterCommand("user@example.com", ValidPassword), cancellationSource.Token);

        Assert.Equal(cancellationSource.Token, repository.ExistenceCheckToken);
        Assert.Equal(cancellationSource.Token, repository.AddToken);
    }

    [Fact]
    public async Task HandleRejectsNullCommand()
    {
        var handler = new RegisterHandler(new FakeAuthRepository(), new FakePasswordHasher(PasswordHash));

        await Assert.ThrowsAsync<ArgumentNullException>(() =>
            handler.Handle(null!, CancellationToken.None));
    }

    private sealed class FakeAuthRepository : IAuthRepository
    {
        public bool EmailExists { get; init; }
        public int ExistenceCheckCount { get; private set; }
        public User? AddedUser { get; private set; }
        public CancellationToken ExistenceCheckToken { get; private set; }
        public CancellationToken AddToken { get; private set; }

        public Task<bool> ExistsByEmailAsync(Email email, CancellationToken cancellationToken)
        {
            ExistenceCheckCount++;
            ExistenceCheckToken = cancellationToken;
            return Task.FromResult(EmailExists);
        }

        public Task AddAsync(User user, CancellationToken cancellationToken)
        {
            AddedUser = user;
            AddToken = cancellationToken;
            return Task.CompletedTask;
        }
    }

    private sealed class FakePasswordHasher(string passwordHash) : IPasswordHasher
    {
        public string? PasswordHashed { get; private set; }

        public string HashPassword(string password)
        {
            PasswordHashed = password;
            return passwordHash;
        }
    }
}
