using TodoApp.Application.Features.Tasks.GetTasks;
using TodoApp.Application.Features.Tasks.Validation;
using TodoApp.Domain.Features.Tasks;

namespace TodoApp.Application.Tests.Tasks.GetTasks;

public sealed class GetTasksHandlerTests
{
    private static readonly Guid UserId = Guid.Parse("81fe3ea2-e8e9-4663-9ee5-ae54d7054853");

    [Theory]
    [InlineData(1, 10)]
    [InlineData(2, 20)]
    [InlineData(3, 50)]
    public async Task HandleForwardsOwnerPagingAndCancellationAndKeepsProjection(int page, int pageSize)
    {
        var item = new TaskListItem(Guid.NewGuid(), "Title", TaskPriority.High, false,
            new DateTimeOffset(2026, 10, 21, 12, 30, 0, TimeSpan.Zero), null);
        var expected = new GetTasksResult([item], 123, page, pageSize);
        var repository = new FakeTaskRepository { OnGetPage = (_, _, _, _) => Task.FromResult(expected) };
        var handler = new GetTasksHandler(repository);
        using var source = new CancellationTokenSource();

        GetTasksResult result = await handler.Handle(new GetTasksQuery(UserId, page, pageSize), source.Token);

        Assert.Equal(1, repository.GetPageCount);
        Assert.Equal(0, repository.AddCount);
        Assert.Equal(UserId, repository.RequestedUserId);
        Assert.Equal(page, repository.RequestedPage);
        Assert.Equal(pageSize, repository.RequestedPageSize);
        Assert.Equal(source.Token, repository.GetPageToken);
        Assert.Same(expected, result);
        Assert.Same(item, Assert.Single(result.Items));
    }

    [Fact]
    public async Task DefaultQueryReturnsEmptyFirstPageWithDefaultSize()
    {
        var repository = new FakeTaskRepository();
        var handler = new GetTasksHandler(repository);

        GetTasksResult result = await handler.Handle(new GetTasksQuery(UserId), CancellationToken.None);

        Assert.Equal(1, repository.RequestedPage);
        Assert.Equal(20, repository.RequestedPageSize);
        Assert.Empty(result.Items);
        Assert.Equal(0, result.TotalCount);
        Assert.Equal(1, result.Page);
        Assert.Equal(20, result.PageSize);
    }

    [Fact]
    public async Task OutOfRangePageKeepsTotalCountAndOriginalLargePage()
    {
        var expected = new GetTasksResult([], 3, int.MaxValue, 50);
        var repository = new FakeTaskRepository { OnGetPage = (_, _, _, _) => Task.FromResult(expected) };
        var handler = new GetTasksHandler(repository);

        GetTasksResult result = await handler.Handle(new GetTasksQuery(UserId, int.MaxValue, 50), CancellationToken.None);

        Assert.Empty(result.Items);
        Assert.Equal(3, result.TotalCount);
        Assert.Equal(int.MaxValue, result.Page);
        Assert.Equal(int.MaxValue, repository.RequestedPage);
        Assert.Equal(50, result.PageSize);
    }

    [Fact]
    public async Task EachInvocationPassesItsOwnOwnerToRepository()
    {
        var owners = new List<Guid>();
        var repository = new FakeTaskRepository
        {
            OnGetPage = (owner, page, pageSize, _) =>
            {
                owners.Add(owner);
                return Task.FromResult(new GetTasksResult([], 0, page, pageSize));
            }
        };
        var handler = new GetTasksHandler(repository);
        Guid otherUserId = Guid.NewGuid();

        await handler.Handle(new GetTasksQuery(UserId), CancellationToken.None);
        await handler.Handle(new GetTasksQuery(otherUserId), CancellationToken.None);

        Assert.Equal(new[] { UserId, otherUserId }, owners);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(int.MinValue)]
    public async Task InvalidPageFailsBeforeRepository(int page)
    {
        await AssertInvalidPage(new GetTasksQuery(UserId, page), TaskInputField.Page);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(1)]
    [InlineData(15)]
    [InlineData(30)]
    [InlineData(100)]
    [InlineData(int.MinValue)]
    [InlineData(int.MaxValue)]
    public async Task UnsupportedPageSizeFailsBeforeRepository(int pageSize)
    {
        await AssertInvalidPage(new GetTasksQuery(UserId, PageSize: pageSize), TaskInputField.PageSize);
    }

    [Fact]
    public async Task EmptyOwnerIsNotRelabeledAsUserEditableFieldError()
    {
        var repository = new FakeTaskRepository();
        var handler = new GetTasksHandler(repository);

        ArgumentException error = await Assert.ThrowsAsync<ArgumentException>(() =>
            handler.Handle(new GetTasksQuery(Guid.Empty), CancellationToken.None));

        Assert.Equal("UserId", error.ParamName);
        Assert.Equal(0, repository.GetPageCount);
    }

    [Fact]
    public async Task NullQueryFailsBeforeRepository()
    {
        var repository = new FakeTaskRepository();
        var handler = new GetTasksHandler(repository);

        ArgumentNullException error = await Assert.ThrowsAsync<ArgumentNullException>(() =>
            handler.Handle(null!, CancellationToken.None));

        Assert.Equal("query", error.ParamName);
        Assert.Equal(0, repository.GetPageCount);
    }

    [Fact]
    public async Task AlreadyCancelledRequestStopsBeforeValidationAndRepository()
    {
        var repository = new FakeTaskRepository();
        var handler = new GetTasksHandler(repository);
        using var source = new CancellationTokenSource();
        source.Cancel();

        OperationCanceledException error = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            handler.Handle(new GetTasksQuery(Guid.Empty, 0, 0), source.Token));

        Assert.Equal(source.Token, error.CancellationToken);
        Assert.Equal(0, repository.GetPageCount);
    }

    [Theory]
    [InlineData("page")]
    [InlineData("pageSize")]
    public async Task RepositoryArgumentErrorsAreNotTranslatedIntoInputErrors(string parameterName)
    {
        var expected = new ArgumentException("Repository failure.", parameterName);
        var repository = new FakeTaskRepository
        {
            OnGetPage = (_, _, _, _) => Task.FromException<GetTasksResult>(expected)
        };
        var handler = new GetTasksHandler(repository);

        ArgumentException actual = await Assert.ThrowsAsync<ArgumentException>(() =>
            handler.Handle(new GetTasksQuery(UserId), CancellationToken.None));

        Assert.Same(expected, actual);
    }

    [Fact]
    public async Task UnexpectedReadFailureIsPropagated()
    {
        var expected = new InvalidOperationException("Read failed.");
        var repository = new FakeTaskRepository
        {
            OnGetPage = (_, _, _, _) => Task.FromException<GetTasksResult>(expected)
        };
        var handler = new GetTasksHandler(repository);

        InvalidOperationException actual = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            handler.Handle(new GetTasksQuery(UserId), CancellationToken.None));

        Assert.Same(expected, actual);
    }

    [Fact]
    public async Task CancellationDuringReadDoesNotReturnSuccessEvenIfRepositoryIgnoresToken()
    {
        using var source = new CancellationTokenSource();
        var repository = new FakeTaskRepository
        {
            OnGetPage = (_, page, pageSize, _) =>
            {
                source.Cancel();
                return Task.FromResult(new GetTasksResult([], 0, page, pageSize));
            }
        };
        var handler = new GetTasksHandler(repository);

        OperationCanceledException error = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            handler.Handle(new GetTasksQuery(UserId), source.Token));

        Assert.Equal(source.Token, error.CancellationToken);
        Assert.Equal(source.Token, repository.GetPageToken);
    }

    [Fact]
    public void ListItemDoesNotExposeDescriptionOwnerOrDomainEntity()
    {
        Assert.DoesNotContain(typeof(TaskListItem).GetProperties(), property =>
            property.Name is "Description" or "UserId" || property.PropertyType == typeof(TodoTask));
    }

    private static async Task AssertInvalidPage(GetTasksQuery query, TaskInputField field)
    {
        var repository = new FakeTaskRepository();
        var handler = new GetTasksHandler(repository);

        InvalidTaskInputException error = await Assert.ThrowsAsync<InvalidTaskInputException>(() =>
            handler.Handle(query, CancellationToken.None));

        Assert.Equal(field, error.Field);
        Assert.Equal(0, repository.GetPageCount);
        Assert.Equal(0, repository.AddCount);
    }
}
