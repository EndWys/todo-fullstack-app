using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TodoApp.Application.Features.Auth.Abstractions;
using TodoApp.Application.Features.Auth.Register;
using TodoApp.Infrastructure.Features.Auth.Persistence;
using TodoApp.Infrastructure.Features.Auth.Register;
using TodoApp.Infrastructure.Persistence;

namespace TodoApp.Api.Setup;

public static class ServiceCollectionExtensions
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
        services.AddScoped<RegisterHandler>();

        services.AddProblemDetails();
        services.AddOpenApi();

        return services;
    }
}
