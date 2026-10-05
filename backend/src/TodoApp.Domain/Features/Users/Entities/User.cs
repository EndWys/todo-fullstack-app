namespace TodoApp.Domain.Features.Users.Entities;

public class User
{
    private User(Guid userId, Email email, string passwordHash)
    {
        UserId = userId;
        Email = email;
        PasswordHash = passwordHash;
    }
    
    public Guid UserId { get; private set; }
    public Email Email { get; private set; }
    public string PasswordHash { get; private set; } 

    public static User Create(Email email, string passwordHash)
    {
        ArgumentNullException.ThrowIfNull(email);

        if (string.IsNullOrWhiteSpace(passwordHash))
        {
            throw new ArgumentException("Password hash is required.", nameof(passwordHash));
        }
        
        Guid userId = Guid.NewGuid();
        
        return new User(userId, email, passwordHash);
    }
}