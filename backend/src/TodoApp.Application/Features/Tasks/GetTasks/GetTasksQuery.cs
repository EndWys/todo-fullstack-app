namespace TodoApp.Application.Features.Tasks.GetTasks;

public sealed record GetTasksQuery(Guid UserId, int Page = 1, int PageSize = 20);
