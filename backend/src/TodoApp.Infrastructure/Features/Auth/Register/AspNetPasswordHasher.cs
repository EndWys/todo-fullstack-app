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

    public bool VerifyHashedPassword(string passwordHash, string providedPassword)
    {
        PasswordVerificationResult result = hasher.VerifyHashedPassword(
            EmptyHasherContext, passwordHash, providedPassword);

        return result is PasswordVerificationResult.Success
            or PasswordVerificationResult.SuccessRehashNeeded;
    }
}
