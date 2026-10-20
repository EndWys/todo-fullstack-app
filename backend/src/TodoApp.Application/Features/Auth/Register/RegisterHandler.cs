using TodoApp.Application.Features.Auth.Abstractions;
using TodoApp.Domain.Features.Auth;

using TodoApp.Application.Features.Auth.Validation;

namespace TodoApp.Application.Features.Auth.Register;

public class RegisterHandler(IAuthRepository authRepository, IPasswordHasher passwordHasher)
{
    public async Task<RegisterResult> Handle(RegisterCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (PasswordPolicy.Validate(command.Password, AuthPasswordPolicies.Registration) is { } error)
        {
            throw new InvalidPasswordException(error);
        }
        string password = command.Password!;
        
        Email email = EmailValidation.Create(command.Email);

        if (await authRepository.ExistsByEmailAsync(email, cancellationToken))
        {
            throw new EmailAlreadyRegisteredException();
        }
        
        cancellationToken.ThrowIfCancellationRequested();
        
        string passwordHash = passwordHasher.HashPassword(password);

        User user = User.Create(email, passwordHash);

        await authRepository.AddAsync(user, cancellationToken);
        
        return new RegisterResult(user.UserId, user.Email.EmailAddress);
    }
}
