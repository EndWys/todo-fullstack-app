using TodoApp.Domain.Features.Tasks;

namespace TodoApp.Application.Features.Tasks.GetTasks;

public sealed record TaskListItem(
    Guid TaskId,
    string Title,
    TaskPriority Priority,
    bool IsCompleted,
    DateTimeOffset CreatedAt,
    DateTimeOffset? CompletedAt);
