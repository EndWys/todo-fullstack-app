using TodoApp.Application.Features.Auth.Validation;

namespace TodoApp.Api.Features.Auth.Validation;

internal static class AuthInputErrors
{
    public static Dictionary<string, string[]> RequiredFields(string? email, string? password)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(email))
            errors["email"] = ["Email is required."];
        if (string.IsNullOrEmpty(password))
            errors["password"] = ["Password is required."];
        return errors;
    }

    public static string PasswordMessage(PasswordValidationError error, PasswordRules rules) => error switch
    {
        PasswordValidationError.Required => "Password is required.",
        PasswordValidationError.OnlyWhitespace => "Password must not consist only of whitespace.",
        PasswordValidationError.TooShort => $"Password must contain at least {rules.MinimumLength} Unicode code points.",
        PasswordValidationError.TooLong => $"Password must contain no more than {rules.MaximumLength} Unicode code points.",
        _ => "Password is invalid."
    };

    public static string EmailMessage(EmailValidationError error) => error switch
    {
        EmailValidationError.Required => "Email is required.",
        EmailValidationError.InvalidFormat => "Email address has an invalid format.",
        _ => "Email address is invalid."
    };

    public static IResult Field(string field, string message, int statusCode = StatusCodes.Status400BadRequest) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] }, statusCode: statusCode);
}
