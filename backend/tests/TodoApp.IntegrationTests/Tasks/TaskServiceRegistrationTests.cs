using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TodoApp.Api.Setup;
using TodoApp.Application.Features.Tasks.Abstractions;
using TodoApp.Application.Features.Tasks.CreateTask;
using TodoApp.Application.Features.Tasks.GetTasks;
using TodoApp.Infrastructure.Features.Tasks.Persistence;
using TodoApp.Infrastructure.Persistence;

namespace TodoApp.IntegrationTests.Tasks;

public sealed class TaskServiceRegistrationTests
{
    [Fact]
    public void HandlersAndRepositoryResolveWithScopedPersistenceAndSharedClock()
    {
        // Construct services only; this deliberately unreachable connection must never open.
        IConfiguration configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:TodoApp"] =
                    "Server=unused.invalid;Database=TodoAppTest;Integrated Security=True;Encrypt=True"
            }).Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddTodoAppServices(configuration);
        using ServiceProvider provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
        using IServiceScope first = provider.CreateScope();
        using IServiceScope second = provider.CreateScope();

        var repository = first.ServiceProvider.GetRequiredService<ITaskRepository>();
        Assert.IsType<TaskRepository>(repository);
        Assert.Same(repository, first.ServiceProvider.GetRequiredService<ITaskRepository>());
        Assert.NotSame(repository, second.ServiceProvider.GetRequiredService<ITaskRepository>());
        Assert.Same(first.ServiceProvider.GetRequiredService<AppDbContext>(), first.ServiceProvider.GetRequiredService<AppDbContext>());
        Assert.NotSame(first.ServiceProvider.GetRequiredService<AppDbContext>(), second.ServiceProvider.GetRequiredService<AppDbContext>());
        Assert.NotNull(first.ServiceProvider.GetRequiredService<CreateTaskHandler>());
        Assert.NotNull(second.ServiceProvider.GetRequiredService<GetTasksHandler>());
        Assert.Same(TimeProvider.System, first.ServiceProvider.GetRequiredService<TimeProvider>());
        Assert.Same(first.ServiceProvider.GetRequiredService<TimeProvider>(), second.ServiceProvider.GetRequiredService<TimeProvider>());
    }
}
