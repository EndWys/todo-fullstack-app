using Microsoft.AspNetCore.Mvc;
using System.ComponentModel;

namespace TodoApp.Api.Features.Tasks.GetTasks;

public sealed class GetTasksRequest
{
    [FromQuery(Name = "page")]
    [Description("Positive Int32 page number; default 1.")]
    public string? Page { get; init; }

    [FromQuery(Name = "pageSize")]
    [Description("Page size: 10, 20, or 50; default 20.")]
    public string? PageSize { get; init; }
}
