using TodoApp.Application.Features.Tasks.CreateTask;
using TodoApp.Domain.Features.Tasks;

namespace TodoApp.Application.Features.Tasks.Validation;

internal static class TaskCreation
{
    public static TodoTask Create(CreateTaskCommand command, DateTimeOffset createdAt)
    {
        try
        {
            // The Domain factory validates null and malformed text; do not duplicate its rules here.
            return TodoTask.Create(command.UserId, command.Title!, createdAt, command.Description, command.Priority);
        }
        catch (ArgumentException exception) when (exception.ParamName is "title" or "description" or "priority")
        {
            // Catch only expected factory input errors. Repository/clock failures stay technical,
            // even if they throw ArgumentException with a matching parameter name.
            TaskInputField field = exception.ParamName switch
            {
                "title" => TaskInputField.Title,
                "description" => TaskInputField.Description,
                _ => TaskInputField.Priority
            };

            throw new InvalidTaskInputException(field, exception);
        }
    }
}
