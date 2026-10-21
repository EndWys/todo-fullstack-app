using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace TodoApp.Api.Features.Tasks.CreateTask;

internal static class CreateTaskOpenApi
{
    public static async Task DescribeRequest(OpenApiOperation operation,
        OpenApiOperationTransformerContext context, CancellationToken cancellationToken)
    {
        // Describe the manually read body without Accepts metadata: its routing-time 415
        // would bypass our reader and return an empty response instead of ProblemDetails.
        var schema = await context.GetOrCreateSchemaAsync(typeof(CreateTaskRequest), null, cancellationToken);
        operation.RequestBody = new OpenApiRequestBody
        {
            Required = true,
            Content = new Dictionary<string, OpenApiMediaType>
            {
                ["application/json"] = new() { Schema = schema }
            }
        };
    }
}
