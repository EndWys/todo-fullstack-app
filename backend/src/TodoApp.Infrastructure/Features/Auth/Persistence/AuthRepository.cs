using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using TodoApp.Application.Features.Auth.Abstractions;
using TodoApp.Application.Features.Auth.Register;
using TodoApp.Domain.Features.Auth;
using TodoApp.Infrastructure.Persistence;

namespace TodoApp.Infrastructure.Features.Auth.Persistence;

public sealed class AuthRepository(AppDbContext dbContext) : IAuthRepository
{
    public Task<bool> ExistsByEmailAsync(Email email, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(email);

        return dbContext.Users.AnyAsync(user => user.Email == email, cancellationToken);
    }

    public async Task AddAsync(User user, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(user);
        
        dbContext.Users.Add(user);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException  exception) when(exception.InnerException is SqlException { Number: 2601 or 2627 })
        {
            if (await ExistsByEmailAsync(user.Email, cancellationToken))
            {
                throw new EmailAlreadyRegisteredException();
            }

            throw;
        }
    }
}