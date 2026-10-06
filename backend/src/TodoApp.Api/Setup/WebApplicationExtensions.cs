using TodoApp.Api.Features.Auth.Register;

namespace TodoApp.Api.Setup;

public static class WebApplicationExtensions
{
    public static WebApplication UseTodoAppPipeline(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
            app.UseSwaggerUI(options =>
                options.SwaggerEndpoint("/openapi/v1.json", "TodoApp v1"));
        }

        app.UseExceptionHandler();
        app.UseHttpsRedirection();

        return app;
    }

    public static WebApplication MapTodoAppEndpoints(this WebApplication app)
    {
        RegisterEndpoint.Map(app);
        return app;
    }
}
