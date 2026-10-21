namespace TodoApp.Domain.Features.Tasks;

public sealed class TodoTask
{
    public const int MaxTitleLength = 200;
    public const int MaxDescriptionLength = 2000;

    private TodoTask(
        Guid taskId,
        Guid userId,
        string title,
        string? description,
        TaskPriority priority,
        DateTimeOffset createdAt)
    {
        TaskId = taskId;
        UserId = userId;
        Title = title;
        Description = description;
        Priority = priority;
        IsCompleted = false;
        CreatedAt = createdAt;
        CompletedAt = null;
    }

    public Guid TaskId { get; private set; }
    public Guid UserId { get; private set; }
    public string Title { get; private set; }
    public string? Description { get; private set; }
    public TaskPriority Priority { get; private set; }
    public bool IsCompleted { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }

    public static TodoTask Create(
        Guid userId,
        string title,
        DateTimeOffset createdAt,
        string? description = null,
        TaskPriority priority = TaskPriority.Normal)
    {
        TodoTaskValidator.ValidateUserId(userId);
        TodoTaskValidator.ValidatePriority(priority);

        string? normalizedTitle = TodoTaskNormalizer.NormalizeTitle(title);
        TodoTaskValidator.ValidateTitle(normalizedTitle);

        string? normalizedDescription = TodoTaskNormalizer.NormalizeDescription(description);
        TodoTaskValidator.ValidateDescription(normalizedDescription);

        return new TodoTask(
            Guid.NewGuid(),
            userId,
            normalizedTitle,
            normalizedDescription,
            priority,
            createdAt.ToUniversalTime());
    }
}
