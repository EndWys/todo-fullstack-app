using TodoApp.Application.Features.Tasks.CreateTask;
using TodoApp.Application.Features.Tasks.Validation;
using TodoApp.Domain.Features.Tasks;

namespace TodoApp.Application.Tests.Tasks.CreateTask;

public sealed class CreateTaskHandlerTests
{
    private static readonly Guid UserId = Guid.Parse("81fe3ea2-e8e9-4663-9ee5-ae54d7054853");
    private static readonly DateTimeOffset Now = new(2026, 10, 21, 12, 30, 0, TimeSpan.Zero);

    [Theory]
    [InlineData(TaskPriority.Low)]
    [InlineData(TaskPriority.Normal)]
    [InlineData(TaskPriority.High)]
    public async Task HandlePersistsNormalizedTaskWithOwnerAndServerTimeAndReturnsItsData(TaskPriority priority)
    {
        var repository = new FakeTaskRepository();
        var clock = new FixedTimeProvider();
        var handler = new CreateTaskHandler(repository, clock);
        using var source = new CancellationTokenSource();

        CreateTaskResult result = await handler.Handle(
            new CreateTaskCommand(UserId, "  Learn  EF Core 🥛  ", "\r\n First\n\tSecond \t", priority), source.Token);

        Assert.Equal(1, repository.AddCount);
        Assert.Equal(0, repository.GetPageCount);
        Assert.Equal(source.Token, repository.AddToken);
        Assert.Equal(1, clock.ReadCount);
        TodoTask task = Assert.IsType<TodoTask>(repository.AddedTask);
        Assert.NotEqual(Guid.Empty, task.TaskId);
        Assert.Equal(UserId, task.UserId);
        Assert.Equal("Learn  EF Core 🥛", task.Title);
        Assert.Equal("First\n\tSecond", task.Description);
        Assert.Equal(priority, task.Priority);
        Assert.False(task.IsCompleted);
        Assert.Equal(Now, task.CreatedAt);
        Assert.Equal(TimeSpan.Zero, task.CreatedAt.Offset);
        Assert.Null(task.CompletedAt);
        Assert.Equal(new CreateTaskResult(
            task.TaskId, task.Title, task.Description, priority, false, Now, null), result);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" \r\n\t\u2003 ")]
    public async Task MinimalCommandUsesNormalPriorityAndNormalizesAbsentDescription(string? description)
    {
        var repository = new FakeTaskRepository();
        var handler = new CreateTaskHandler(repository, new FixedTimeProvider());

        CreateTaskResult result = await handler.Handle(
            new CreateTaskCommand(UserId, "Title", description), CancellationToken.None);

        Assert.Null(result.Description);
        Assert.Equal(TaskPriority.Normal, result.Priority);
        Assert.Equal(1, repository.AddCount);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" \t\r\n ")]
    [InlineData("Before\nAfter")]
    [InlineData("Before\u2028After")]
    [InlineData("Before\0After")]
    public async Task InvalidTitleBecomesTypedFieldErrorWithoutSaving(string? title)
    {
        await AssertInvalidInput(new CreateTaskCommand(UserId, title), TaskInputField.Title, "title");
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task OverlongUnicodeTitleUsesDomainRulesWithoutSaving(bool useEmoji)
    {
        string title = useEmoji ? string.Concat(Enumerable.Repeat("😀", 201)) : new string('a', 201);

        await AssertInvalidInput(new CreateTaskCommand(UserId, title), TaskInputField.Title, "title");
    }

    [Theory]
    [InlineData("Before\0After")]
    [InlineData("Before\u0001After")]
    public async Task InvalidDescriptionBecomesTypedFieldErrorWithoutSaving(string description)
    {
        await AssertInvalidInput(
            new CreateTaskCommand(UserId, "Title", description), TaskInputField.Description, "description");
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task OverlongUnicodeDescriptionUsesDomainRulesWithoutSaving(bool useEmoji)
    {
        string description = useEmoji ? string.Concat(Enumerable.Repeat("😀", 2001)) : new string('a', 2001);

        await AssertInvalidInput(
            new CreateTaskCommand(UserId, "Title", description), TaskInputField.Description, "description");
    }

    [Fact]
    public async Task MalformedUnicodeIsTranslatedForBothTextFields()
    {
        await AssertInvalidInput(new CreateTaskCommand(UserId, "\uD800"), TaskInputField.Title, "title");
        await AssertInvalidInput(
            new CreateTaskCommand(UserId, "Title", "\uDC00"), TaskInputField.Description, "description");
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(3)]
    [InlineData(int.MaxValue)]
    public async Task UndefinedPriorityBecomesTypedFieldErrorWithoutSaving(int priority)
    {
        await AssertInvalidInput(
            new CreateTaskCommand(UserId, "Title", Priority: (TaskPriority)priority), TaskInputField.Priority, "priority");
    }

    [Fact]
    public async Task EmptyOwnerIsNotRelabeledAsUserEditableFieldError()
    {
        var repository = new FakeTaskRepository();
        var handler = new CreateTaskHandler(repository, new FixedTimeProvider());

        ArgumentException error = await Assert.ThrowsAsync<ArgumentException>(() => handler.Handle(
            new CreateTaskCommand(Guid.Empty, "Title"), CancellationToken.None));

        Assert.Equal("userId", error.ParamName);
        Assert.Equal(0, repository.AddCount);
    }

    [Fact]
    public async Task NullCommandFailsBeforeClockOrRepository()
    {
        var repository = new FakeTaskRepository();
        var clock = new FixedTimeProvider();
        var handler = new CreateTaskHandler(repository, clock);

        ArgumentNullException error = await Assert.ThrowsAsync<ArgumentNullException>(() =>
            handler.Handle(null!, CancellationToken.None));

        Assert.Equal("command", error.ParamName);
        Assert.Equal(0, clock.ReadCount);
        Assert.Equal(0, repository.AddCount);
    }

    [Fact]
    public async Task AlreadyCancelledRequestStopsBeforeValidationClockOrRepository()
    {
        var repository = new FakeTaskRepository();
        var clock = new FixedTimeProvider();
        var handler = new CreateTaskHandler(repository, clock);
        using var source = new CancellationTokenSource();
        source.Cancel();

        OperationCanceledException error = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            handler.Handle(new CreateTaskCommand(Guid.Empty, null), source.Token));

        Assert.Equal(source.Token, error.CancellationToken);
        Assert.Equal(0, clock.ReadCount);
        Assert.Equal(0, repository.AddCount);
    }

    [Fact]
    public async Task CancellationWhileObtainingTimeSkipsPersistence()
    {
        using var source = new CancellationTokenSource();
        var clock = new FixedTimeProvider { OnRead = source.Cancel };
        var repository = new FakeTaskRepository();
        var handler = new CreateTaskHandler(repository, clock);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            handler.Handle(new CreateTaskCommand(UserId, "Title"), source.Token));

        Assert.Equal(0, repository.AddCount);
    }

    [Theory]
    [InlineData("title")]
    [InlineData("description")]
    [InlineData("priority")]
    public async Task RepositoryArgumentErrorsAreNotTranslatedIntoInputErrors(string parameterName)
    {
        var expected = new ArgumentException("Repository failure.", parameterName);
        var repository = new FakeTaskRepository { OnAdd = (_, _) => Task.FromException(expected) };
        var handler = new CreateTaskHandler(repository, new FixedTimeProvider());

        ArgumentException actual = await Assert.ThrowsAsync<ArgumentException>(() =>
            handler.Handle(new CreateTaskCommand(UserId, "Title"), CancellationToken.None));

        Assert.Same(expected, actual);
        Assert.Equal(1, repository.AddCount);
    }

    [Fact]
    public async Task ClockArgumentErrorsAreNotTranslatedIntoInputErrors()
    {
        var expected = new ArgumentException("Clock failure.", "title");
        var clock = new FixedTimeProvider { OnRead = () => throw expected };
        var repository = new FakeTaskRepository();
        var handler = new CreateTaskHandler(repository, clock);

        ArgumentException actual = await Assert.ThrowsAsync<ArgumentException>(() =>
            handler.Handle(new CreateTaskCommand(UserId, "Title"), CancellationToken.None));

        Assert.Same(expected, actual);
        Assert.Equal(0, repository.AddCount);
    }

    [Fact]
    public async Task UnexpectedPersistenceFailureIsPropagated()
    {
        var expected = new InvalidOperationException("Persistence failed.");
        var repository = new FakeTaskRepository { OnAdd = (_, _) => Task.FromException(expected) };
        var handler = new CreateTaskHandler(repository, new FixedTimeProvider());

        InvalidOperationException actual = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            handler.Handle(new CreateTaskCommand(UserId, "Title"), CancellationToken.None));

        Assert.Same(expected, actual);
    }

    [Fact]
    public async Task HandlerDoesNotReturnBeforePersistenceCompletes()
    {
        var persisted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var repository = new FakeTaskRepository { OnAdd = (_, _) => persisted.Task };
        var handler = new CreateTaskHandler(repository, new FixedTimeProvider());

        Task<CreateTaskResult> operation = handler.Handle(new CreateTaskCommand(UserId, "Title"), CancellationToken.None);

        Assert.Equal(1, repository.AddCount);
        Assert.False(operation.IsCompleted);
        persisted.SetResult();
        CreateTaskResult result = await operation;
        Assert.Equal(repository.AddedTask!.TaskId, result.TaskId);
    }

    [Fact]
    public async Task RepositoryCancellationIsPropagatedWithOriginalToken()
    {
        using var source = new CancellationTokenSource();
        var repository = new FakeTaskRepository
        {
            OnAdd = (_, token) =>
            {
                source.Cancel();
                return Task.FromCanceled(token);
            }
        };
        var handler = new CreateTaskHandler(repository, new FixedTimeProvider());

        OperationCanceledException error = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            handler.Handle(new CreateTaskCommand(UserId, "Title"), source.Token));

        Assert.Equal(source.Token, error.CancellationToken);
        Assert.Equal(source.Token, repository.AddToken);
    }

    [Fact]
    public async Task LateCancellationDoesNotReplaceConfirmedPersistenceWithAnError()
    {
        using var source = new CancellationTokenSource();
        var repository = new FakeTaskRepository
        {
            OnAdd = (_, _) =>
            {
                source.Cancel();
                return Task.CompletedTask;
            }
        };
        var handler = new CreateTaskHandler(repository, new FixedTimeProvider());

        CreateTaskResult result = await handler.Handle(new CreateTaskCommand(UserId, "Title"), source.Token);

        Assert.True(source.IsCancellationRequested);
        Assert.Equal(repository.AddedTask!.TaskId, result.TaskId);
    }

    [Fact]
    public void CommandStringDoesNotExposeTaskText()
    {
        var command = new CreateTaskCommand(UserId, "Private title", "Private description");

        Assert.Equal(nameof(CreateTaskCommand), command.ToString());
    }

    [Fact]
    public void CreationResultDoesNotExposeOwnerOrDomainEntity()
    {
        Assert.DoesNotContain(typeof(CreateTaskResult).GetProperties(), property =>
            property.Name == "UserId" || property.PropertyType == typeof(TodoTask));
    }

    private static async Task AssertInvalidInput(CreateTaskCommand command, TaskInputField field, string parameterName)
    {
        var repository = new FakeTaskRepository();
        var handler = new CreateTaskHandler(repository, new FixedTimeProvider());

        InvalidTaskInputException error = await Assert.ThrowsAsync<InvalidTaskInputException>(() =>
            handler.Handle(command, CancellationToken.None));

        Assert.Equal(field, error.Field);
        Assert.Equal("Invalid task input.", error.Message);
        Assert.Equal(parameterName, Assert.IsAssignableFrom<ArgumentException>(error.InnerException).ParamName);
        Assert.Equal(0, repository.AddCount);
        Assert.Equal(0, repository.GetPageCount);
    }

    private sealed class FixedTimeProvider : TimeProvider
    {
        public int ReadCount { get; private set; }
        public Action? OnRead { get; init; }

        public override DateTimeOffset GetUtcNow()
        {
            ReadCount++;
            OnRead?.Invoke();
            return Now;
        }
    }
}
