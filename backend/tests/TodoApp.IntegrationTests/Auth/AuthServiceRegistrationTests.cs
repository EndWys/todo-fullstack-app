using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TodoApp.Api.Setup;
using TodoApp.Application.Features.Auth.Abstractions;
using TodoApp.Application.Features.Auth.Login;

namespace TodoApp.IntegrationTests.Auth;

public sealed class AuthServiceRegistrationTests
{
    [Fact]
    public void LoginResolvesAndDummyHashIsSharedAcrossRequestScopes()
    {
        // Only construct services; never open a database connection.
        IConfiguration configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:TodoApp"] =
                    "Server=unused.invalid;Database=TodoAppTest;Integrated Security=True;Encrypt=True"
            })
            .Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddTodoAppServices(configuration);
        using ServiceProvider provider = services.BuildServiceProvider(
            new ServiceProviderOptions { ValidateScopes = true });
        using IServiceScope first = provider.CreateScope();
        using IServiceScope second = provider.CreateScope();

        Assert.NotNull(first.ServiceProvider.GetRequiredService<LoginHandler>());
        Assert.NotNull(second.ServiceProvider.GetRequiredService<LoginHandler>());
        IDummyPasswordHash firstHash = first.ServiceProvider.GetRequiredService<IDummyPasswordHash>();
        IDummyPasswordHash secondHash = second.ServiceProvider.GetRequiredService<IDummyPasswordHash>();
        Assert.Same(firstHash, secondHash);
        Assert.False(string.IsNullOrWhiteSpace(firstHash.Hash));
    }
}
