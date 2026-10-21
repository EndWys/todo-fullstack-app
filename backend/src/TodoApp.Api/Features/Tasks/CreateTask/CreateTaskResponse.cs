using TodoApp.Application.Features.Tasks.CreateTask;

namespace TodoApp.Api.Features.Tasks.CreateTask;

public sealed record CreateTaskResponse(
    Guid Id,
    string Title,
    string? Description,
    string Priority,
    bool IsCompleted,
    DateTimeOffset CreatedAt,
    DateTimeOffset? CompletedAt)
{
    public static CreateTaskResponse From(CreateTaskResult result) => new(
        result.TaskId, result.Title, result.Description, TaskPriorityMapping.ToHttp(result.Priority),
        result.IsCompleted, result.CreatedAt, result.CompletedAt);
}
