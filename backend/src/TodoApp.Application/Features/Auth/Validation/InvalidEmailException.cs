namespace TodoApp.Application.Features.Auth.Validation;

public sealed class InvalidEmailException(EmailValidationError error, Exception innerException)
    : Exception("Invalid email.", innerException)
{
    public EmailValidationError Error { get; } = error;
}
