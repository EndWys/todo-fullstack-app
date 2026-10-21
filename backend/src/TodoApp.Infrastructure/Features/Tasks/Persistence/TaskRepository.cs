using Microsoft.EntityFrameworkCore;
using TodoApp.Application.Features.Tasks.Abstractions;
using TodoApp.Application.Features.Tasks.GetTasks;
using TodoApp.Domain.Features.Tasks;
using TodoApp.Infrastructure.Persistence;

namespace TodoApp.Infrastructure.Features.Tasks.Persistence;

public sealed class TaskRepository(AppDbContext dbContext) : ITaskRepository
{
    public async Task AddAsync(TodoTask task, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(task);
        cancellationToken.ThrowIfCancellationRequested();

        dbContext.Tasks.Add(task);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<GetTasksResult> GetPageAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (userId == Guid.Empty)
        {
            throw new ArgumentException("Task owner is required.", nameof(userId));
        }

        ArgumentOutOfRangeException.ThrowIfLessThan(page, 1);
        if (pageSize is not (10 or 20 or 50))
        {
            throw new ArgumentOutOfRangeException(nameof(pageSize), "Page size must be 10, 20, or 50.");
        }

        // Reuse the owner-scoped query for count and items; counting all users would leak private data.
        IQueryable<TodoTask> ownTasks = dbContext.Tasks.AsNoTracking().Where(task => task.UserId == userId);
        int totalCount = await ownTasks.CountAsync(cancellationToken);
        cancellationToken.ThrowIfCancellationRequested();

        long offset = ((long)page - 1) * pageSize;
        if (offset >= totalCount)
        {
            return new GetTasksResult([], totalCount, page, pageSize);
        }

        // offset < an Int32 count here, so conversion for EF's Skip(int) is safe.
        List<TaskListItem> items = await ownTasks
            .OrderBy(task => task.IsCompleted)
            .ThenByDescending(task => task.CreatedAt)
            .ThenBy(task => task.TaskId)
            .Skip(checked((int)offset))
            .Take(pageSize)
            .Select(task => new TaskListItem(
                task.TaskId, task.Title, task.Priority, task.IsCompleted, task.CreatedAt, task.CompletedAt))
            .ToListAsync(cancellationToken);

        return new GetTasksResult(items, totalCount, page, pageSize);
    }
}
