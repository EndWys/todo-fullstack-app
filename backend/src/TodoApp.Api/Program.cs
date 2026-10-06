using TodoApp.Api.Setup;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddTodoAppServices(builder.Configuration);

var app = builder.Build();
app.UseTodoAppPipeline();
app.MapTodoAppEndpoints();
app.Run();

// WebApplicationFactory uses this type to start the real API in integration tests.
public partial class Program;
