using Microsoft.EntityFrameworkCore;
using TodoApp.Domain.Features.Tasks;
using TodoApp.Infrastructure.Features.Tasks.Persistence;
using TodoApp.Infrastructure.Persistence;

namespace TodoApp.Infrastructure.Tests.Features.Tasks.Persistence;

public sealed class TaskRepositoryGuardTests
{
    [Fact]
    public async Task AddRejectsNullBeforeTrackingOrConnecting()
    {
        using var context = CreateDisconnectedContext();
        var repository = new TaskRepository(context);

        ArgumentNullException error = await Assert.ThrowsAsync<ArgumentNullException>(() =>
            repository.AddAsync(null!, CancellationToken.None));

        Assert.Equal("task", error.ParamName);
        Assert.Empty(context.ChangeTracker.Entries());
    }

    [Fact]
    public async Task AlreadyCancelledAddDoesNotTrackTaskOrConnect()
    {
        using var context = CreateDisconnectedContext();
        var repository = new TaskRepository(context);
        TodoTask task = TodoTask.Create(Guid.NewGuid(), "Title", DateTimeOffset.UnixEpoch);
        using var source = new CancellationTokenSource();
        source.Cancel();

        OperationCanceledException error = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            repository.AddAsync(task, source.Token));

        Assert.Equal(source.Token, error.CancellationToken);
        Assert.Empty(context.ChangeTracker.Entries());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task InvalidPageIsRejectedBeforeConnecting(int page)
    {
        using var context = CreateDisconnectedContext();
        var repository = new TaskRepository(context);

        ArgumentOutOfRangeException error = await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            repository.GetPageAsync(Guid.NewGuid(), page, 20, CancellationToken.None));

        Assert.Equal("page", error.ParamName);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(25)]
    [InlineData(100)]
    public async Task UnsupportedPageSizeIsRejectedBeforeConnecting(int pageSize)
    {
        using var context = CreateDisconnectedContext();
        var repository = new TaskRepository(context);

        ArgumentOutOfRangeException error = await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            repository.GetPageAsync(Guid.NewGuid(), 1, pageSize, CancellationToken.None));

        Assert.Equal("pageSize", error.ParamName);
    }

    [Fact]
    public async Task EmptyOwnerIsRejectedBeforeConnecting()
    {
        using var context = CreateDisconnectedContext();
        var repository = new TaskRepository(context);

        ArgumentException error = await Assert.ThrowsAsync<ArgumentException>(() =>
            repository.GetPageAsync(Guid.Empty, 1, 20, CancellationToken.None));

        Assert.Equal("userId", error.ParamName);
    }

    [Fact]
    public async Task AlreadyCancelledReadStopsBeforeValidationOrConnecting()
    {
        using var context = CreateDisconnectedContext();
        var repository = new TaskRepository(context);
        using var source = new CancellationTokenSource();
        source.Cancel();

        OperationCanceledException error = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            repository.GetPageAsync(Guid.Empty, 0, 0, source.Token));

        Assert.Equal(source.Token, error.CancellationToken);
    }

    private static AppDbContext CreateDisconnectedContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer().Options);
}
