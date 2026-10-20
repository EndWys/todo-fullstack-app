using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using TodoApp.Application.Features.Auth.Abstractions;

namespace TodoApp.Infrastructure.Features.Auth.Security;

// Registered as a singleton: create once per service provider, never per login attempt.
public sealed class DummyPasswordHash : IDummyPasswordHash
{
    public DummyPasswordHash(IOptions<PasswordHasherOptions> options)
    {
        var hasher = new PasswordHasher<object>(options);
        string randomPassword = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        Hash = hasher.HashPassword(new object(), randomPassword);
    }

    public string Hash { get; }
}
