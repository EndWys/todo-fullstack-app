using TodoApp.Application.Features.Tasks.Abstractions;
using TodoApp.Application.Features.Tasks.GetTasks;
using TodoApp.Domain.Features.Tasks;

namespace TodoApp.Application.Tests.Tasks;

internal sealed class FakeTaskRepository : ITaskRepository
{
    public int AddCount { get; private set; }
    public int GetPageCount { get; private set; }
    public TodoTask? AddedTask { get; private set; }
    public CancellationToken AddToken { get; private set; }
    public Guid RequestedUserId { get; private set; }
    public int RequestedPage { get; private set; }
    public int RequestedPageSize { get; private set; }
    public CancellationToken GetPageToken { get; private set; }
    public Func<TodoTask, CancellationToken, Task>? OnAdd { get; init; }
    public Func<Guid, int, int, CancellationToken, Task<GetTasksResult>>? OnGetPage { get; init; }

    public Task AddAsync(TodoTask task, CancellationToken cancellationToken)
    {
        AddCount++;
        AddedTask = task;
        AddToken = cancellationToken;
        return OnAdd?.Invoke(task, cancellationToken) ?? Task.CompletedTask;
    }

    public Task<GetTasksResult> GetPageAsync(Guid userId, int page, int pageSize, CancellationToken cancellationToken)
    {
        GetPageCount++;
        RequestedUserId = userId;
        RequestedPage = page;
        RequestedPageSize = pageSize;
        GetPageToken = cancellationToken;
        return OnGetPage?.Invoke(userId, page, pageSize, cancellationToken)
            ?? Task.FromResult(new GetTasksResult([], 0, page, pageSize));
    }
}
