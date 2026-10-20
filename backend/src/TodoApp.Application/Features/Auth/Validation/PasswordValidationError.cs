namespace TodoApp.Application.Features.Auth.Validation;

public enum PasswordValidationError
{
    Required = 0,
    OnlyWhitespace = 1,
    TooShort = 2,
    TooLong = 3
}
