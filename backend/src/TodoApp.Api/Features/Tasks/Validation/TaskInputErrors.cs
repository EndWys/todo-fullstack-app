using TodoApp.Application.Features.Tasks.Validation;
using TodoApp.Domain.Features.Tasks;

namespace TodoApp.Api.Features.Tasks.Validation;

internal static class TaskInputErrors
{
    public static IResult Field(TaskInputField field)
    {
        (string name, string message) = field switch
        {
            TaskInputField.Title => ("title", $"Title is required and must contain at most {TodoTask.MaxTitleLength} Unicode code points on one line, without control characters."),
            TaskInputField.Description => ("description", $"Description must contain at most {TodoTask.MaxDescriptionLength} Unicode code points and only supported text characters, line breaks and tabs."),
            TaskInputField.Priority => ("priority", "Priority must be low, normal, or high."),
            TaskInputField.Page => ("page", "Page must be a positive 32-bit integer."),
            TaskInputField.PageSize => ("pageSize", "Page size must be 10, 20, or 50."),
            _ => throw new InvalidOperationException("Unknown task input field.")
        };

        // Never forward InnerException.Message or user text as a public validation message.
        return Results.ValidationProblem(new Dictionary<string, string[]> { [name] = [message] });
    }

    public static IResult InvalidBody() => Results.Problem(
        statusCode: StatusCodes.Status400BadRequest, title: "Invalid request body.");
}
