using System.Text.Json.Serialization;

namespace TodoApp.Api.Features.Tasks.CreateTask;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CreateTaskRequest
{
    public string? Title { get; init; }
    public string? Description { get; init; }
    public string? Priority { get; init; } = "normal";
}
