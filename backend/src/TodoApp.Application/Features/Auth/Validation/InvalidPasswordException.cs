namespace TodoApp.Application.Features.Auth.Validation;

public sealed class InvalidPasswordException(PasswordValidationError error) : Exception("Invalid password.")
{
    public PasswordValidationError Error { get; } = error;
}
