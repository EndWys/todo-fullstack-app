using System.Globalization;
using Microsoft.AspNetCore.Http.Features;
using TodoApp.Api.Features.Tasks.Validation;
using TodoApp.Application.Features.Tasks.GetTasks;
using TodoApp.Application.Features.Tasks.Validation;

namespace TodoApp.Api.Features.Tasks.GetTasks;

internal static class GetTasksRequestReader
{
    public static (GetTasksQuery? Query, IResult? Error) Read(
        GetTasksRequest request, HttpRequest httpRequest, Guid userId)
    {
        if (httpRequest.HttpContext.Features.Get<IHttpRequestBodyDetectionFeature>()?.CanHaveBody == true
            || httpRequest.ContentLength > 0)
            return (null, TaskInputErrors.InvalidBody());

        IQueryCollection query = httpRequest.Query;
        if (query.Keys.Any(key => key is not ("page" or "pageSize")))
            return (null, Results.Problem(statusCode: StatusCodes.Status400BadRequest,
                title: "Unknown query parameter."));

        int page = 1;
        int pageSize = 20;
        if (query.TryGetValue("page", out var pages)
            && (pages.Count != 1 || !int.TryParse(request.Page, NumberStyles.Integer, CultureInfo.InvariantCulture, out page)))
            return (null, TaskInputErrors.Field(TaskInputField.Page));

        if (query.TryGetValue("pageSize", out var sizes)
            && (sizes.Count != 1 || !int.TryParse(request.PageSize, NumberStyles.Integer, CultureInfo.InvariantCulture, out pageSize)))
            return (null, TaskInputErrors.Field(TaskInputField.PageSize));

        return (new GetTasksQuery(userId, page, pageSize), null);
    }
}
