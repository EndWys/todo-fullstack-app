using TodoApp.Application.Features.Auth.Abstractions;
using TodoApp.Domain.Features.Auth;

namespace TodoApp.Application.Features.Auth.Register;

public class RegisterHandler(IAuthRepository authRepository, IPasswordHasher passwordHasher)
{
    public async Task<RegisterResult> Handle(RegisterCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        string password = command.Password ?? throw new InvalidPasswordException(PasswordValidationError.Required);

        if (PasswordPolicy.Validate(password) is { } error)
        {
            throw new InvalidPasswordException(error);
        }
        
        Email email;
        try
        {
            email = Email.Create(command.Email);
        }
        catch (ArgumentException exception) when (exception.ParamName == "email")
        {
            throw new InvalidEmailException(EmailValidationError.Required, exception);
        }
        catch (FormatException exception)
        {
            throw new InvalidEmailException(EmailValidationError.InvalidFormat, exception);
        }

        if (await authRepository.ExistsByEmailAsync(email, cancellationToken))
        {
            throw new EmailAlreadyRegisteredException();
        }
        
        string passwordHash = passwordHasher.HashPassword(password);

        User user = User.Create(email, passwordHash);

        await authRepository.AddAsync(user, cancellationToken);
        
        return new RegisterResult(user.UserId, user.Email.EmailAddress);
    }
}
