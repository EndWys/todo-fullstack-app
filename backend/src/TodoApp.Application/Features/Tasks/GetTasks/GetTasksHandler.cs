using TodoApp.Application.Features.Tasks.Abstractions;
using TodoApp.Application.Features.Tasks.Validation;

namespace TodoApp.Application.Features.Tasks.GetTasks;

public sealed class GetTasksHandler(ITaskRepository taskRepository)
{
    public async Task<GetTasksResult> Handle(GetTasksQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        if (query.UserId == Guid.Empty)
        {
            throw new ArgumentException("Task owner is required.", nameof(query.UserId));
        }

        TaskPageValidation.Validate(query.Page, query.PageSize);

        GetTasksResult result = await taskRepository.GetPageAsync(
            query.UserId, query.Page, query.PageSize, cancellationToken);

        cancellationToken.ThrowIfCancellationRequested();
        return result;
    }
}
