using Microsoft.AspNetCore.Identity;
using TodoApp.Application.Features.Auth.Abstractions;

namespace TodoApp.Infrastructure.Features.Auth.Register;

public class AspNetPasswordHasher(PasswordHasher<object> hasher) : IPasswordHasher
{
    private static readonly object EmptyHasherContext = new();

    public string HashPassword(string password)
    {
        return hasher.HashPassword(EmptyHasherContext, password);
    }
}