using TodoApp.Application.Features.Auth.Abstractions;
using TodoApp.Application.Features.Auth.Login;
using TodoApp.Application.Features.Auth.Register;
using TodoApp.Application.Features.Auth.Validation;
using TodoApp.Domain.Features.Auth;

namespace TodoApp.Application.Tests.Auth.Login;

public sealed class LoginHandlerTests
{
    private const string Password = "  correct horse battery staple  ";
    private const string StoredHash = "stored-hash";
    private const string DummyHash = "dummy-hash";

    [Fact]
    public async Task ValidCredentialsReturnOnlyIdentityAndPreservePassword()
    {
        User user = CreateUser();
        var repository = new FakeRepository { User = user };
        var hasher = new FakeHasher { Matches = true };
        var dummy = new FakeDummyHash();
        using var source = new CancellationTokenSource();
        var handler = new LoginHandler(repository, hasher, dummy);

        LoginResult result = await handler.Handle(
            new LoginCommand(" \u0085user@example.com\u0085 ", Password), source.Token);

        Assert.Equal(new LoginResult(user.UserId, user.Email.EmailAddress), result);
        Assert.Equal("user@example.com", repository.LookedUpEmail!.EmailAddress);
        Assert.Equal(source.Token, repository.Token);
        Assert.Equal(Password, hasher.Password);
        Assert.Equal(StoredHash, hasher.Hash);
        Assert.Equal(1, repository.LookupCount);
        Assert.Equal(1, hasher.VerifyCount);
        Assert.Equal(0, dummy.ReadCount);
        Assert.Equal(StoredHash, user.PasswordHash);
        Assert.Equal(new[] { "Email", "UserId" },
            typeof(LoginResult).GetProperties().Select(property => property.Name).Order().ToArray());
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public async Task MissingUserAndWrongPasswordUseSameErrorAndOneVerification(bool exists, bool matches)
    {
        var repository = new FakeRepository { User = exists ? CreateUser() : null };
        var hasher = new FakeHasher { Matches = matches };
        var dummy = new FakeDummyHash();
        var handler = new LoginHandler(repository, hasher, dummy);

        InvalidCredentialsException error = await Assert.ThrowsAsync<InvalidCredentialsException>(() =>
            handler.Handle(new LoginCommand("user@example.com", Password), CancellationToken.None));

        Assert.Equal("Invalid email or password.", error.Message);
        Assert.Equal(1, hasher.VerifyCount);
        Assert.Equal(exists ? StoredHash : DummyHash, hasher.Hash);
        Assert.Equal(Password, hasher.Password);
        Assert.Equal(exists ? 0 : 1, dummy.ReadCount);
    }

    [Theory]
    [InlineData(null, PasswordValidationError.Required)]
    [InlineData("", PasswordValidationError.Required)]
    [InlineData("short", PasswordValidationError.TooShort)]
    [InlineData("               ", PasswordValidationError.OnlyWhitespace)]
    public async Task InvalidPasswordDoesNotQueryDatabase(string? value, PasswordValidationError expected)
    {
        var repository = new FakeRepository();
        var hasher = new FakeHasher();
        var handler = new LoginHandler(repository, hasher, new FakeDummyHash());

        InvalidPasswordException error = await Assert.ThrowsAsync<InvalidPasswordException>(() =>
            handler.Handle(new LoginCommand("user@example.com", value), CancellationToken.None));

        Assert.Equal(expected, error.Error);
        Assert.Equal(0, repository.LookupCount);
        Assert.Equal(0, hasher.VerifyCount);
    }

    [Fact]
    public async Task OverlongPasswordDoesNotQueryDatabase()
    {
        var repository = new FakeRepository();
        var handler = new LoginHandler(repository, new FakeHasher(), new FakeDummyHash());
        InvalidPasswordException error = await Assert.ThrowsAsync<InvalidPasswordException>(() =>
            handler.Handle(new LoginCommand("user@example.com", new string('a', 257)), CancellationToken.None));
        Assert.Equal(PasswordValidationError.TooLong, error.Error);
        Assert.Equal(0, repository.LookupCount);
    }

    [Theory]
    [InlineData(null, EmailValidationError.Required)]
    [InlineData("", EmailValidationError.Required)]
    [InlineData("not-an-email", EmailValidationError.InvalidFormat)]
    public async Task InvalidEmailDoesNotQueryDatabase(string? value, EmailValidationError expected)
    {
        var repository = new FakeRepository();
        var hasher = new FakeHasher();
        var handler = new LoginHandler(repository, hasher, new FakeDummyHash());
        InvalidEmailException error = await Assert.ThrowsAsync<InvalidEmailException>(() =>
            handler.Handle(new LoginCommand(value, Password), CancellationToken.None));
        Assert.Equal(expected, error.Error);
        Assert.Equal(0, repository.LookupCount);
        Assert.Equal(0, hasher.VerifyCount);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task DoesNotTranslateUnrelatedRepositoryOrHasherExceptions(bool hasherFails)
    {
        var failure = new FormatException("Internal failure.");
        var repository = new FakeRepository { User = CreateUser(), Failure = hasherFails ? null : failure };
        var hasher = new FakeHasher { Failure = hasherFails ? failure : null };
        var handler = new LoginHandler(repository, hasher, new FakeDummyHash());

        Exception? thrown = await Record.ExceptionAsync(() =>
            handler.Handle(new LoginCommand("user@example.com", Password), CancellationToken.None));
        Assert.Same(failure, thrown);
    }

    [Fact]
    public async Task RejectsNullCommand()
    {
        var handler = new LoginHandler(new FakeRepository(), new FakeHasher(), new FakeDummyHash());
        await Assert.ThrowsAsync<ArgumentNullException>(() => handler.Handle(null!, CancellationToken.None));
    }

    [Fact]
    public async Task AlreadyCancelledRequestDoesNotQueryDatabase()
    {
        var repository = new FakeRepository();
        using var source = new CancellationTokenSource();
        source.Cancel();
        var handler = new LoginHandler(repository, new FakeHasher(), new FakeDummyHash());
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            handler.Handle(new LoginCommand("user@example.com", Password), source.Token));
        Assert.Equal(0, repository.LookupCount);
    }

    [Fact]
    public async Task CancellationDuringLookupSkipsHashVerification()
    {
        using var source = new CancellationTokenSource();
        var repository = new FakeRepository { User = CreateUser(), OnLookup = source.Cancel };
        var hasher = new FakeHasher();
        var handler = new LoginHandler(repository, hasher, new FakeDummyHash());
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            handler.Handle(new LoginCommand("user@example.com", Password), source.Token));
        Assert.Equal(0, hasher.VerifyCount);
    }

    [Fact]
    public async Task CancellationDuringVerificationDoesNotReturnSuccess()
    {
        using var source = new CancellationTokenSource();
        var repository = new FakeRepository { User = CreateUser() };
        var hasher = new FakeHasher { Matches = true, OnVerify = source.Cancel };
        var handler = new LoginHandler(repository, hasher, new FakeDummyHash());
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            handler.Handle(new LoginCommand("user@example.com", Password), source.Token));
    }

    [Fact]
    public void CommandToStringDoesNotContainCredentials()
    {
        Assert.Equal(nameof(LoginCommand), new LoginCommand("secret@example.com", Password).ToString());
        Assert.Equal(nameof(RegisterCommand), new RegisterCommand("secret@example.com", Password).ToString());
    }

    private static User CreateUser() => User.Create(Email.Create("User@Example.com"), StoredHash);

    private sealed class FakeDummyHash : IDummyPasswordHash
    {
        public int ReadCount { get; private set; }
        public string Hash { get { ReadCount++; return DummyHash; } }
    }

    private sealed class FakeRepository : IAuthRepository
    {
        public User? User { get; init; }
        public Exception? Failure { get; init; }
        public Action? OnLookup { get; init; }
        public int LookupCount { get; private set; }
        public Email? LookedUpEmail { get; private set; }
        public CancellationToken Token { get; private set; }

        public Task<User?> GetByEmailAsync(Email email, CancellationToken cancellationToken)
        {
            LookupCount++;
            LookedUpEmail = email;
            Token = cancellationToken;
            OnLookup?.Invoke();
            if (Failure is not null) throw Failure;
            return Task.FromResult(User);
        }

        public Task<bool> ExistsByEmailAsync(Email email, CancellationToken cancellationToken) =>
            throw new NotSupportedException("Login must not perform a separate existence check.");
        public Task AddAsync(User user, CancellationToken cancellationToken) =>
            throw new NotSupportedException("Login must not create users.");
    }

    private sealed class FakeHasher : IPasswordHasher
    {
        public bool Matches { get; init; }
        public Exception? Failure { get; init; }
        public Action? OnVerify { get; init; }
        public int VerifyCount { get; private set; }
        public string? Hash { get; private set; }
        public string? Password { get; private set; }

        public bool VerifyHashedPassword(string passwordHash, string providedPassword)
        {
            VerifyCount++;
            Hash = passwordHash;
            Password = providedPassword;
            OnVerify?.Invoke();
            if (Failure is not null) throw Failure;
            return Matches;
        }

        public string HashPassword(string password) =>
            throw new NotSupportedException("Login must not create a password hash.");
    }
}
