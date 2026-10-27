using TodoApp.Domain.Features.Tasks;

namespace TodoApp.Application.Features.Tasks.CreateTask;

public sealed record CreateTaskResult(
    Guid TaskId,
    string Title,
    string? Description,
    TaskPriority Priority,
    bool IsCompleted,
    DateTimeOffset CreatedAt,
    DateTimeOffset? CompletedAt);
