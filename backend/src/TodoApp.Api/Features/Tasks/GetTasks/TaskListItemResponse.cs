using TodoApp.Application.Features.Tasks.GetTasks;

namespace TodoApp.Api.Features.Tasks.GetTasks;

public sealed record TaskListItemResponse(
    Guid Id,
    string Title,
    string Priority,
    bool IsCompleted,
    DateTimeOffset CreatedAt,
    DateTimeOffset? CompletedAt)
{
    public static TaskListItemResponse From(TaskListItem item) => new(
        item.TaskId, item.Title, TaskPriorityMapping.ToHttp(item.Priority), item.IsCompleted, item.CreatedAt, item.CompletedAt);
}
