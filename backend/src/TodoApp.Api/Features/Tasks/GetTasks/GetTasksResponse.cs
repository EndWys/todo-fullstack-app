using TodoApp.Application.Features.Tasks.GetTasks;

namespace TodoApp.Api.Features.Tasks.GetTasks;

public sealed record GetTasksResponse(
    IReadOnlyList<TaskListItemResponse> Items,
    int TotalCount,
    int Page,
    int PageSize)
{
    public static GetTasksResponse From(GetTasksResult result) => new(
        result.Items.Select(TaskListItemResponse.From).ToArray(), result.TotalCount, result.Page, result.PageSize);
}
