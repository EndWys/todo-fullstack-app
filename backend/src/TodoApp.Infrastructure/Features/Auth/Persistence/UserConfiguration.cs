using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TodoApp.Domain.Features.Auth;

namespace TodoApp.Infrastructure.Features.Auth.Persistence;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    private const string EmailCollation = "SQL_Latin1_General_CP1_CI_AS";
    private const int PasswordHashMaxLength = 512;

    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users");

        builder.HasKey(user => user.UserId);

        builder.Property(user => user.UserId)
            .ValueGeneratedNever();

        builder.Property(user => user.Email)
            .HasConversion(
                email => email.EmailAddress,
                emailAddress => Email.Create(emailAddress))
            .HasMaxLength(EmailRulesConstants.MaxEmailLength)
            .UseCollation(EmailCollation)
            .IsRequired();

        builder.HasIndex(user => user.Email)
            .IsUnique();

        builder.Property(user => user.PasswordHash)
            .HasMaxLength(PasswordHashMaxLength)
            .IsRequired();
    }
}
