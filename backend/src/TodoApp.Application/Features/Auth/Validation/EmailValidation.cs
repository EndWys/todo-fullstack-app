using TodoApp.Domain.Features.Auth;

namespace TodoApp.Application.Features.Auth.Validation;

public static class EmailValidation
{
    public static Email Create(string? value)
    {
        try
        {
            return Email.Create(value);
        }
        catch (ArgumentException exception) when (exception.ParamName == "email")
        {
            throw new InvalidEmailException(EmailValidationError.Required, exception);
        }
        catch (FormatException exception)
        {
            throw new InvalidEmailException(EmailValidationError.InvalidFormat, exception);
        }
    }
}
