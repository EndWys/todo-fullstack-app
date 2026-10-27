using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TodoApp.Application.Features.Auth.Abstractions;
using TodoApp.Application.Features.Auth.Register;
using TodoApp.Infrastructure.Features.Auth.Persistence;
using TodoApp.Infrastructure.Features.Auth.Register;
using TodoApp.Infrastructure.Persistence;

using TodoApp.Application.Features.Auth.Login;
using TodoApp.Infrastructure.Features.Auth.Security;
using TodoApp.Application.Features.Tasks.Abstractions;
using TodoApp.Application.Features.Tasks.CreateTask;
using TodoApp.Application.Features.Tasks.GetTasks;
using TodoApp.Infrastructure.Features.Tasks.Persistence;

namespace TodoApp.Api.Setup;

public static class ServiceCollectionSetup
{
    public static IServiceCollection AddTodoAppServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        string connectionString = configuration.GetConnectionString("TodoApp")
                                  ?? throw new InvalidOperationException(
                                      "Connection string 'TodoApp' is not configured.");

        services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connectionString));
        services.AddScoped<IAuthRepository, AuthRepository>();
        services.AddScoped<PasswordHasher<object>>();
        services.AddScoped<IPasswordHasher, AspNetPasswordHasher>();
        services.AddSingleton<IDummyPasswordHash, DummyPasswordHash>();
        services.AddScoped<RegisterHandler>();
        services.AddScoped<LoginHandler>();
        services.AddScoped<ITaskRepository, TaskRepository>();
        services.AddScoped<CreateTaskHandler>();
        services.AddScoped<GetTasksHandler>();
        services.AddSingleton(TimeProvider.System);

        services.AddAppAuthentication();
        services.AddAppAntiforgery();
        services.AddProblemDetails();
        services.AddOpenApi();

        return services;
    }
}
