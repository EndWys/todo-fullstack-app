namespace TodoApp.Application.Features.Auth.Register;

public record RegisterCommand(string? Email, string? Password)
{
    // Hide credentials from string output; structured logging can still expose properties.
    // Never log or destructure the entire command.
    public override string ToString() => nameof(RegisterCommand);
}
