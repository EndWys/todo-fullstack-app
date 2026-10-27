using System.Text.Json;
using Microsoft.AspNetCore.Http.Features;
using TodoApp.Api.Features.Tasks.Validation;

namespace TodoApp.Api.Features.Tasks.CreateTask;

internal static class CreateTaskRequestReader
{
    // Strictness is local to Tasks. Do not silently alter the already-working Auth JSON contract.
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = false,
        AllowDuplicateProperties = false
    };

    public static async Task<(CreateTaskRequest? Request, IResult? Error)> ReadAsync(
        HttpRequest request, CancellationToken cancellationToken)
    {
        if (request.HttpContext.Features.Get<IHttpRequestBodyDetectionFeature>()?.CanHaveBody == false
            || request.ContentLength == 0)
            return (null, TaskInputErrors.InvalidBody());

        if (!request.HasJsonContentType())
            return (null, Results.Problem(statusCode: StatusCodes.Status415UnsupportedMediaType,
                title: "Content-Type must be application/json."));

        try
        {
            CreateTaskRequest? body = await request.ReadFromJsonAsync<CreateTaskRequest>(JsonOptions, cancellationToken);
            return body is null ? (null, TaskInputErrors.InvalidBody()) : (body, null);
        }
        catch (JsonException)
        {
            return (null, TaskInputErrors.InvalidBody());
        }
        catch (BadHttpRequestException exception) when (exception.StatusCode is 400 or 413)
        {
            return (null, Results.Problem(statusCode: exception.StatusCode, title: "Invalid request body."));
        }
    }
}
