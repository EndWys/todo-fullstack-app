using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using TodoApp.Infrastructure.Persistence;

namespace TodoApp.IntegrationTests;

internal static class TestDatabase
{
    private const string TestConnectionVariable = "TODOAPP_TEST_CONNECTION_STRING";
    private const string TestDatabaseName = "TodoAppTest";

    public static string ConnectionString
    {
        get
        {
            string? connectionString = Environment.GetEnvironmentVariable(TestConnectionVariable);
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException(
                    $"Set {TestConnectionVariable} to the dedicated {TestDatabaseName} SQL Server database before running integration tests.");
            }

            AssertTestDatabase(connectionString);
            return connectionString;
        }
    }

    public static void AssertTestDatabase(string? connectionString)
    {
        var sqlConnection = new SqlConnectionStringBuilder(connectionString);
        if (!string.Equals(sqlConnection.InitialCatalog, TestDatabaseName, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"Integration tests require Database={TestDatabaseName}; the configured database is '{sqlConnection.InitialCatalog}'.");
        }
    }

    public static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(ConnectionString)
            .Options;

        return new AppDbContext(options);
    }
}
