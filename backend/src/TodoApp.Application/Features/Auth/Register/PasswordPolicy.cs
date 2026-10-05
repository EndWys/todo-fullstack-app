namespace TodoApp.Application.Features.Auth.Register;

public static class PasswordPolicy
{
    private const int MinimumLength = 15;
    private const int MaximumLength = 256;

    public static PasswordValidationError? Validate(string? password)
    {
        if (string.IsNullOrEmpty(password))
        {
            return PasswordValidationError.Required;
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            return PasswordValidationError.OnlyWhitespace;
        }

        int length = password.EnumerateRunes().Count();

        if (length < MinimumLength)
        {
            return PasswordValidationError.TooShort;
        }

        if (length > MaximumLength)
        {
            return PasswordValidationError.TooLong;
        }

        return null;
    }
}
