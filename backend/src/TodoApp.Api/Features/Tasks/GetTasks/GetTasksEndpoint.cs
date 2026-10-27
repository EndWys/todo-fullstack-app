using TodoApp.Api.Features.Auth.Identity;
using TodoApp.Api.Features.Tasks.Validation;
using TodoApp.Application.Features.Tasks.GetTasks;
using TodoApp.Application.Features.Tasks.Validation;

namespace TodoApp.Api.Features.Tasks.GetTasks;

public static class GetTasksEndpoint
{
    public static void Map(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/tasks", HandleAsync)
            .WithName("GetTasks")
            .WithTags("Tasks")
            .WithDescription("Get your own tasks. Defaults: page=1, pageSize=20. Allowed page sizes: 10, 20, 50.")
            .Produces<GetTasksResponse>()
            .ProducesValidationProblem()
            .Produces(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status500InternalServerError)
            .RequireAuthorization();
    }

    private static async Task<IResult> HandleAsync(
        HttpContext context, [AsParameters] GetTasksRequest request,
        GetTasksHandler handler, CancellationToken cancellationToken)
    {
        if (!AuthIdentity.TryGetUserId(context.User, out Guid userId))
            return Results.Unauthorized();

        var (query, error) = GetTasksRequestReader.Read(request, context.Request, userId);
        if (error is not null) return error;

        try
        {
            GetTasksResult result = await handler.Handle(query!, cancellationToken);
            return Results.Ok(GetTasksResponse.From(result));
        }
        catch (InvalidTaskInputException exception)
        {
            return TaskInputErrors.Field(exception.Field);
        }
    }
}
