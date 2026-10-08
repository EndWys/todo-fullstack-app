namespace TodoApp.Application.Features.Auth.Register;

public sealed class InvalidEmailException(EmailValidationError error, Exception innerException)
    : Exception("Invalid email.", innerException)
{
    public EmailValidationError Error { get; } = error;
}
