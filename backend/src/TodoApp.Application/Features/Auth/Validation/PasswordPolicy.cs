namespace TodoApp.Application.Features.Auth.Validation;

public static class PasswordPolicy
{
    public static PasswordValidationError? Validate(string? password, PasswordRules rules)
    {
        ArgumentNullException.ThrowIfNull(rules);
        if (string.IsNullOrEmpty(password))
        {
            return PasswordValidationError.Required;
        }

        if (rules.RejectOnlyWhitespace && string.IsNullOrWhiteSpace(password))
        {
            return PasswordValidationError.OnlyWhitespace;
        }

        int length = password.EnumerateRunes().Count();

        if (length < rules.MinimumLength)
        {
            return PasswordValidationError.TooShort;
        }

        if (length > rules.MaximumLength)
        {
            return PasswordValidationError.TooLong;
        }

        return null;
    }
}
