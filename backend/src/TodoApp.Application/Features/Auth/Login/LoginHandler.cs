using TodoApp.Application.Features.Auth.Abstractions;

using TodoApp.Application.Features.Auth.Validation;
using TodoApp.Domain.Features.Auth;

namespace TodoApp.Application.Features.Auth.Login;

public sealed class LoginHandler(
    IAuthRepository authRepository,
    IPasswordHasher passwordHasher,
    IDummyPasswordHash dummyPasswordHash)
{
    public async Task<LoginResult> Handle(LoginCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        if (PasswordPolicy.Validate(command.Password, AuthPasswordPolicies.Login) is { } error)
        {
            throw new InvalidPasswordException(error);
        }
        
        string password = command.Password!;
        Email email = EmailValidation.Create(command.Email);
        User? user = await authRepository.GetByEmailAsync(email, cancellationToken);
        
        cancellationToken.ThrowIfCancellationRequested();

        // Verify a hash even for unknown emails to reduce account-enumeration timing differences.
        // A dummy-hash match must still be rejected because no user exists.
        bool passwordMatches = passwordHasher
            .VerifyHashedPassword(user?.PasswordHash ?? dummyPasswordHash.Hash, password);
        
        cancellationToken.ThrowIfCancellationRequested();

        if (user is null || !passwordMatches)
        {
            throw new InvalidCredentialsException();
        }

        return new LoginResult(user.UserId, user.Email.EmailAddress);
    }
}
