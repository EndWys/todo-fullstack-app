namespace TodoApp.Application.Features.Auth.Login;

public sealed class InvalidCredentialsException() : Exception("Invalid email or password.");
