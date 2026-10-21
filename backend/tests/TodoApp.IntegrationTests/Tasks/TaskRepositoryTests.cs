using System.Data.SqlTypes;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using TodoApp.Application.Features.Tasks.GetTasks;
using TodoApp.Domain.Features.Auth;
using TodoApp.Domain.Features.Tasks;
using TodoApp.Infrastructure.Features.Tasks.Persistence;
using TodoApp.Infrastructure.Persistence;

namespace TodoApp.IntegrationTests.Tasks;

// Requires AddTodoTasks to be applied to TodoAppTest explicitly. Tests never migrate a database.
// Each test uses the shared connection helper and rolls back only its own transaction.
public sealed class TaskRepositoryTests
{
    private static readonly DateTimeOffset CreatedAt = new(2026, 10, 21, 12, 30, 0, TimeSpan.Zero);

    [Fact]
    public async Task AddPersistsFullUnicodeTaskAndMaterializesItFromSqlServer()
    {
        await using var context = TestDatabase.CreateDbContext();
        await using var transaction = await context.Database.BeginTransactionAsync();
        User owner = await CreateOwner(context);
        string title = string.Concat(Enumerable.Repeat("😀", 200));
        string description = string.Concat(Enumerable.Repeat("🥛", 2000));
        TodoTask task = TodoTask.Create(owner.UserId, title, CreatedAt, description, TaskPriority.High);
        var repository = new TaskRepository(context);

        await repository.AddAsync(task, CancellationToken.None);
        context.ChangeTracker.Clear();
        TodoTask saved = await context.Tasks.AsNoTracking().SingleAsync(row => row.TaskId == task.TaskId);

        Assert.Equal(owner.UserId, saved.UserId);
        Assert.Equal(title, saved.Title);
        Assert.Equal(description, saved.Description);
        Assert.Equal(TaskPriority.High, saved.Priority);
        Assert.Equal(CreatedAt, saved.CreatedAt);
        Assert.Equal(TimeSpan.Zero, saved.CreatedAt.Offset);
        Assert.False(saved.IsCompleted);
        Assert.Null(saved.CompletedAt);
        Assert.Empty(context.ChangeTracker.Entries());
    }

    [Fact]
    public async Task AddAllowsDuplicateTitlesAndStoresNullDescriptionAndNormalPriority()
    {
        await using var context = TestDatabase.CreateDbContext();
        await using var transaction = await context.Database.BeginTransactionAsync();
        User owner = await CreateOwner(context);
        var repository = new TaskRepository(context);

        await repository.AddAsync(TodoTask.Create(owner.UserId, "Same title", CreatedAt), CancellationToken.None);
        await repository.AddAsync(TodoTask.Create(owner.UserId, "Same title", CreatedAt), CancellationToken.None);
        context.ChangeTracker.Clear();
        List<TodoTask> rows = await context.Tasks.AsNoTracking().Where(row => row.UserId == owner.UserId).ToListAsync();

        Assert.Equal(2, rows.Count);
        Assert.All(rows, row =>
        {
            Assert.Null(row.Description);
            Assert.Equal(TaskPriority.Normal, row.Priority);
        });
    }

    [Theory]
    [InlineData(10)]
    [InlineData(20)]
    [InlineData(50)]
    public async Task PageAndCountContainOnlyOwnTasksAndRespectPageSize(int pageSize)
    {
        await using var context = TestDatabase.CreateDbContext();
        await using var transaction = await context.Database.BeginTransactionAsync();
        User owner = await CreateOwner(context);
        User other = await CreateOwner(context);
        TodoTask[] ownTasks = Enumerable.Range(0, 25)
            .Select(index => TodoTask.Create(owner.UserId, $"Own {index}", CreatedAt.AddMinutes(index)))
            .ToArray();
        context.Tasks.AddRange(ownTasks);
        context.Tasks.AddRange(Enumerable.Range(0, 7)
            .Select(index => TodoTask.Create(other.UserId, $"Other {index}", CreatedAt.AddDays(index + 1))));
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var repository = new TaskRepository(context);

        GetTasksResult page = await repository.GetPageAsync(owner.UserId, 1, pageSize, CancellationToken.None);

        Assert.Equal(25, page.TotalCount);
        Assert.Equal(1, page.Page);
        Assert.Equal(pageSize, page.PageSize);
        Assert.Equal(ownTasks.OrderByDescending(task => task.CreatedAt).Take(pageSize).Select(task => task.TaskId),
            page.Items.Select(item => item.TaskId));
        Assert.Empty(context.ChangeTracker.Entries());
    }

    [Fact]
    public async Task SecondPageSkipsOwnTasksAndKeepsTotalCount()
    {
        await using var context = TestDatabase.CreateDbContext();
        await using var transaction = await context.Database.BeginTransactionAsync();
        User owner = await CreateOwner(context);
        TodoTask[] tasks = Enumerable.Range(0, 23)
            .Select(index => TodoTask.Create(owner.UserId, $"Task {index}", CreatedAt.AddMinutes(index)))
            .ToArray();
        context.Tasks.AddRange(tasks);
        await context.SaveChangesAsync();
        var repository = new TaskRepository(context);

        GetTasksResult page = await repository.GetPageAsync(owner.UserId, 2, 10, CancellationToken.None);

        Assert.Equal(23, page.TotalCount);
        Assert.Equal(2, page.Page);
        Assert.Equal(tasks.OrderByDescending(task => task.CreatedAt).Skip(10).Take(10).Select(task => task.TaskId),
            page.Items.Select(item => item.TaskId));
    }

    [Fact]
    public async Task EmptyAccountDoesNotRevealOtherUsersCount()
    {
        await using var context = TestDatabase.CreateDbContext();
        await using var transaction = await context.Database.BeginTransactionAsync();
        User owner = await CreateOwner(context);
        User other = await CreateOwner(context);
        context.Tasks.Add(TodoTask.Create(other.UserId, "Other user's task", CreatedAt));
        await context.SaveChangesAsync();
        var repository = new TaskRepository(context);

        GetTasksResult page = await repository.GetPageAsync(owner.UserId, 1, 20, CancellationToken.None);

        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
    }

    [Fact]
    public async Task VeryLargePageReturnsEmptyItemsAndActualCountWithoutOverflow()
    {
        await using var context = TestDatabase.CreateDbContext();
        await using var transaction = await context.Database.BeginTransactionAsync();
        User owner = await CreateOwner(context);
        var repository = new TaskRepository(context);
        await repository.AddAsync(TodoTask.Create(owner.UserId, "Title", CreatedAt), CancellationToken.None);

        GetTasksResult page = await repository.GetPageAsync(owner.UserId, int.MaxValue, 50, CancellationToken.None);

        Assert.Empty(page.Items);
        Assert.Equal(1, page.TotalCount);
        Assert.Equal(int.MaxValue, page.Page);
        Assert.Equal(50, page.PageSize);
    }

    [Fact]
    public async Task SortingPutsActiveBeforeCompletedThenNewestFirst()
    {
        await using var context = TestDatabase.CreateDbContext();
        await using var transaction = await context.Database.BeginTransactionAsync();
        User owner = await CreateOwner(context);
        TodoTask activeOld = TodoTask.Create(owner.UserId, "Active old", CreatedAt.AddDays(-1));
        TodoTask activeNew = TodoTask.Create(owner.UserId, "Active new", CreatedAt);
        TodoTask completedOld = TodoTask.Create(owner.UserId, "Completed old", CreatedAt.AddDays(-2));
        TodoTask completedNew = TodoTask.Create(owner.UserId, "Completed new", CreatedAt.AddDays(1));
        context.Tasks.AddRange(activeOld, activeNew, completedOld, completedNew);
        // Seed storage state directly; the completion use case is deliberately not implemented yet.
        foreach (TodoTask task in new[] { completedOld, completedNew })
        {
            context.Entry(task).Property(row => row.IsCompleted).CurrentValue = true;
            context.Entry(task).Property(row => row.CompletedAt).CurrentValue = CreatedAt.AddDays(2);
        }
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var repository = new TaskRepository(context);

        GetTasksResult page = await repository.GetPageAsync(owner.UserId, 1, 20, CancellationToken.None);

        Assert.Equal(new[] { activeNew.TaskId, activeOld.TaskId, completedNew.TaskId, completedOld.TaskId },
            page.Items.Select(item => item.TaskId));
        Assert.All(page.Items.Take(2), item => Assert.Null(item.CompletedAt));
        Assert.All(page.Items.Skip(2), item => Assert.Equal(CreatedAt.AddDays(2), item.CompletedAt));
    }

    [Fact]
    public async Task EqualTimestampsUseSqlServerGuidOrderingAcrossPages()
    {
        await using var context = TestDatabase.CreateDbContext();
        await using var transaction = await context.Database.BeginTransactionAsync();
        User owner = await CreateOwner(context);
        TodoTask[] tasks = Enumerable.Range(0, 15)
            .Select(index => TodoTask.Create(owner.UserId, $"Task {index}", CreatedAt)).ToArray();
        context.Tasks.AddRange(tasks);
        await context.SaveChangesAsync();
        var repository = new TaskRepository(context);

        GetTasksResult first = await repository.GetPageAsync(owner.UserId, 1, 10, CancellationToken.None);
        GetTasksResult second = await repository.GetPageAsync(owner.UserId, 2, 10, CancellationToken.None);

        // SQL Server uniqueidentifier ordering differs from Guid.CompareTo; SqlGuid matches the server.
        Guid[] expected = tasks.OrderBy(task => new SqlGuid(task.TaskId)).Select(task => task.TaskId).ToArray();
        Assert.Equal(expected, first.Items.Concat(second.Items).Select(item => item.TaskId));
        Assert.Equal(15, first.TotalCount);
        Assert.Equal(15, second.TotalCount);
    }

    [Fact]
    public async Task DatabaseRejectsTaskWithoutExistingOwner()
    {
        await using var context = TestDatabase.CreateDbContext();
        await using var transaction = await context.Database.BeginTransactionAsync();
        var repository = new TaskRepository(context);

        DbUpdateException error = await Assert.ThrowsAsync<DbUpdateException>(() => repository.AddAsync(
            TodoTask.Create(Guid.NewGuid(), "Title", CreatedAt), CancellationToken.None));

        Assert.Equal(547, Assert.IsType<SqlException>(error.InnerException).Number);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task DatabaseRejectsInconsistentCompletionState(bool isCompleted, bool hasCompletedAt)
    {
        await using var context = TestDatabase.CreateDbContext();
        await using var transaction = await context.Database.BeginTransactionAsync();
        User owner = await CreateOwner(context);
        TodoTask task = TodoTask.Create(owner.UserId, "Title", CreatedAt);
        context.Tasks.Add(task);
        context.Entry(task).Property(row => row.IsCompleted).CurrentValue = isCompleted;
        context.Entry(task).Property(row => row.CompletedAt).CurrentValue = hasCompletedAt ? CreatedAt : null;

        DbUpdateException error = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());

        Assert.Equal(547, Assert.IsType<SqlException>(error.InnerException).Number);
    }

    [Fact]
    public async Task DatabaseRejectsUndefinedPriority()
    {
        await using var context = TestDatabase.CreateDbContext();
        await using var transaction = await context.Database.BeginTransactionAsync();
        User owner = await CreateOwner(context);
        TodoTask task = TodoTask.Create(owner.UserId, "Title", CreatedAt);
        context.Tasks.Add(task);
        context.Entry(task).Property(row => row.Priority).CurrentValue = (TaskPriority)42;

        DbUpdateException error = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());

        Assert.Equal(547, Assert.IsType<SqlException>(error.InnerException).Number);
    }

    private static async Task<User> CreateOwner(AppDbContext context)
    {
        User user = User.Create(Email.Create($"tasks-{Guid.NewGuid():N}@example.com"), "stored-test-hash");
        context.Users.Add(user);
        await context.SaveChangesAsync();
        return user;
    }
}
