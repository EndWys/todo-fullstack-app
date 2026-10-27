namespace TodoApp.Api.Middleware;

public sealed class TasksNoStoreMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments("/api/tasks"))
        {
            // Includes authorization, CSRF and unexpected failures, not just endpoint success.
            context.Response.OnStarting(() =>
            {
                context.Response.Headers.CacheControl = "no-store";
                return Task.CompletedTask;
            });
        }

        return next(context);
    }
}
