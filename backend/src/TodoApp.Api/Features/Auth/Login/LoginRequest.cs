namespace TodoApp.Api.Features.Auth.Login;

public sealed record LoginRequest(string? Email, string? Password)
{
    // Do not include the password in incidental string logging; structured logging still needs care.
    public override string ToString() => nameof(LoginRequest);
}
