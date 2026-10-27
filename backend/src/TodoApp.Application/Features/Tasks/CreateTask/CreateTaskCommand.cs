using TodoApp.Domain.Features.Tasks;

namespace TodoApp.Application.Features.Tasks.CreateTask;

public sealed record CreateTaskCommand(
    Guid UserId,
    string? Title,
    string? Description = null,
    TaskPriority Priority = TaskPriority.Normal)
{
    // Task text is private user data. Structured logging can still inspect properties;
    // never log or destructure the entire command.
    public override string ToString() => nameof(CreateTaskCommand);
}
