using TodoApp.Application.Features.Tasks.GetTasks;
using TodoApp.Domain.Features.Tasks;

namespace TodoApp.Application.Features.Tasks.Abstractions;

public interface ITaskRepository
{
    /// <summary>Completes only after the task has been persisted, not merely tracked.</summary>
    Task AddAsync(TodoTask task, CancellationToken cancellationToken);

    // Scope both items and totalCount by userId before pagination to avoid leaking other users' data.
    // Order by IsCompleted ascending, CreatedAt descending, TaskId ascending. Large valid page
    // numbers must return an empty page when out of range, without overflowing offset arithmetic.
    Task<GetTasksResult> GetPageAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken);
}
