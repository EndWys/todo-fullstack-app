using TodoApp.Application.Features.Tasks.Abstractions;
using TodoApp.Application.Features.Tasks.Validation;
using TodoApp.Domain.Features.Tasks;

namespace TodoApp.Application.Features.Tasks.CreateTask;

public sealed class CreateTaskHandler(ITaskRepository taskRepository, TimeProvider timeProvider)
{
    public async Task<CreateTaskResult> Handle(CreateTaskCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        TodoTask task = TaskCreation.Create(command, timeProvider.GetUtcNow());

        cancellationToken.ThrowIfCancellationRequested();
        await taskRepository.AddAsync(task, cancellationToken);

        // Persistence has confirmed success; a late cancellation must not hide that confirmation.
        return new CreateTaskResult(
            task.TaskId,
            task.Title,
            task.Description,
            task.Priority,
            task.IsCompleted,
            task.CreatedAt,
            task.CompletedAt);
    }
}
