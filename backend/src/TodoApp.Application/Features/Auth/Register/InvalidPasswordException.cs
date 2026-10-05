namespace TodoApp.Application.Features.Auth.Register;

public sealed class InvalidPasswordException(PasswordValidationError error) : Exception("Invalid password.")
{
    public PasswordValidationError Error { get; } = error;
}