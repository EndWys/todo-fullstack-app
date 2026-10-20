using TodoApp.Api.Features.Auth.Register;
using TodoApp.Api.Features.Auth.Login;

namespace TodoApp.Api.Setup;

public static class WebApplicationSetup
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
        app.UseAuthentication();
        app.UseAuthorization();

        return app;
    }

    public static WebApplication MapTodoAppEndpoints(this WebApplication app)
    {
        RegisterEndpoint.Map(app);
        LoginEndpoint.Map(app);
        return app;
    }
}
