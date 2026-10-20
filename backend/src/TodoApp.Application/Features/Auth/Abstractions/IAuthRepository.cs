using TodoApp.Domain.Features.Auth;

namespace TodoApp.Application.Features.Auth.Abstractions;

public interface IAuthRepository
{
    Task<bool> ExistsByEmailAsync(Email email, CancellationToken cancellationToken);
    Task AddAsync(User user, CancellationToken cancellationToken);
    Task<User?> GetByEmailAsync(Email email, CancellationToken cancellationToken);
}