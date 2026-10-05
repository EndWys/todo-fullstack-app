namespace TodoApp.Application.Features.Auth.Abstractions;

public interface IPasswordHasher
{
    string HashPassword(string password);
}