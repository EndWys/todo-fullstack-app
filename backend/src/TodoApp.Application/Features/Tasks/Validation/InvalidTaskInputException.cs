namespace TodoApp.Application.Features.Tasks.Validation;

public sealed class InvalidTaskInputException(TaskInputField field, Exception? innerException = null)
    : Exception("Invalid task input.", innerException)
{
    public TaskInputField Field { get; } = field;
}
