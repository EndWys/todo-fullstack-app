namespace TodoApp.Application.Features.Tasks.Validation;

internal static class TaskPageValidation
{
    public static void Validate(int page, int pageSize)
    {
        if (page < 1)
        {
            throw new InvalidTaskInputException(TaskInputField.Page);
        }

        if (pageSize is not (10 or 20 or 50))
        {
            throw new InvalidTaskInputException(TaskInputField.PageSize);
        }
    }
}
