namespace TodoApp.Application.Features.Tasks.GetTasks;

public sealed record GetTasksResult(
    IReadOnlyList<TaskListItem> Items,
    int TotalCount,
    int Page,
    int PageSize);
