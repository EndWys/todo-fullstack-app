using TodoApp.Api.Features.Auth.Identity;
using TodoApp.Api.Features.Tasks.Validation;
using TodoApp.Application.Features.Tasks.CreateTask;
using TodoApp.Application.Features.Tasks.Validation;

namespace TodoApp.Api.Features.Tasks.CreateTask;

public static class CreateTaskEndpoint
{
    public static void Map(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/tasks", HandleAsync)
            .WithName("CreateTask")
            .WithTags("Tasks")
            .WithDescription("Create an active task. Priority: low, normal, high; omitted priority defaults to normal.")
            .AddOpenApiOperationTransformer(CreateTaskOpenApi.DescribeRequest)
            .Produces<CreateTaskResponse>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .Produces(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status415UnsupportedMediaType)
            .ProducesProblem(StatusCodes.Status500InternalServerError)
            .RequireAuthorization();
    }

    private static async Task<IResult> HandleAsync(
        HttpContext context, CreateTaskHandler handler, CancellationToken cancellationToken)
    {
        if (!AuthIdentity.TryGetUserId(context.User, out Guid userId))
            return Results.Unauthorized();

        var (request, error) = await CreateTaskRequestReader.ReadAsync(context.Request, cancellationToken);
        if (error is not null) return error;

        if (!TaskPriorityMapping.TryParse(request!.Priority, out var priority))
            return TaskInputErrors.Field(TaskInputField.Priority);

        try
        {
            CreateTaskResult result = await handler.Handle(
                new CreateTaskCommand(userId, request.Title, request.Description, priority), cancellationToken);
            return Results.Json(CreateTaskResponse.From(result), statusCode: StatusCodes.Status201Created);
        }
        catch (InvalidTaskInputException exception)
        {
            return TaskInputErrors.Field(exception.Field);
        }
    }
}
