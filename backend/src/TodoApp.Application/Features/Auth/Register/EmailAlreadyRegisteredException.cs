namespace TodoApp.Application.Features.Auth.Register;

public sealed class EmailAlreadyRegisteredException() : Exception("Email is already registered.");