using TodoApp.Api.Features.Auth.Register;
using TodoApp.Api.Features.Auth.Login;
using TodoApp.Api.Features.Auth.Me;
using TodoApp.Api.Features.Auth.Logout;
using TodoApp.Api.Features.Auth.Csrf;
using TodoApp.Api.Middleware;
using TodoApp.Api.Features.Tasks.CreateTask;
using TodoApp.Api.Features.Tasks.GetTasks;

namespace TodoApp.Api.Setup;

public static class WebApplicationSetup
{
    public static WebApplication UseTodoAppPipeline(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
            app.UseSwaggerUI(SwaggerSetup.Configure);
        }

        app.UseMiddleware<TasksNoStoreMiddleware>();
        app.UseExceptionHandler();
        app.UseHttpsRedirection();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseMiddleware<CsrfProtectionMiddleware>();

        return app;
    }

    public static WebApplication MapTodoAppEndpoints(this WebApplication app)
    {
        RegisterEndpoint.Map(app);
        LoginEndpoint.Map(app);
        MeEndpoint.Map(app);
        LogoutEndpoint.Map(app);
        CsrfEndpoint.Map(app);
        CreateTaskEndpoint.Map(app);
        GetTasksEndpoint.Map(app);
        return app;
    }
}
