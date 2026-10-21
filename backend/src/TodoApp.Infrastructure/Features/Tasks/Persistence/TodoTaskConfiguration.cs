using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TodoApp.Domain.Features.Auth;
using TodoApp.Domain.Features.Tasks;

namespace TodoApp.Infrastructure.Features.Tasks.Persistence;

public sealed class TodoTaskConfiguration : IEntityTypeConfiguration<TodoTask>
{
    public void Configure(EntityTypeBuilder<TodoTask> builder)
    {
        builder.ToTable("Tasks", table =>
        {
            table.HasCheckConstraint("CK_Tasks_Priority", "[Priority] IN (0, 1, 2)");
            table.HasCheckConstraint("CK_Tasks_CompletionState",
                "([IsCompleted] = 0 AND [CompletedAt] IS NULL) OR ([IsCompleted] = 1 AND [CompletedAt] IS NOT NULL)");
        });

        builder.HasKey(task => task.TaskId);
        builder.Property(task => task.TaskId).ValueGeneratedNever();

        // SQL nvarchar measures UTF-16 code units, not the Unicode scalar count validated by Domain.
        builder.Property(task => task.Title)
            .HasMaxLength(TodoTask.MaxTitleLength * 2)
            .IsUnicode()
            .IsRequired();
        builder.Property(task => task.Description)
            .HasMaxLength(TodoTask.MaxDescriptionLength * 2)
            .IsUnicode();

        builder.Property(task => task.Priority).HasConversion<int>().IsRequired();
        builder.Property(task => task.IsCompleted).IsRequired();
        builder.Property(task => task.CreatedAt).HasPrecision(7).IsRequired();
        builder.Property(task => task.CompletedAt).HasPrecision(7);

        // Account deletion must not silently cascade into deleting a user's private task history.
        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(task => task.UserId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(task => new { task.UserId, task.IsCompleted, task.CreatedAt, task.TaskId })
            .IsDescending(false, false, true, false);
    }
}
