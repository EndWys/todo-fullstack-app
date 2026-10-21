using TodoApp.Domain.Features.Tasks;

namespace TodoApp.Domain.Tests.Tasks;

public sealed class TodoTaskTests
{
    private static readonly Guid UserId = Guid.Parse("81fe3ea2-e8e9-4663-9ee5-ae54d7054853");
    private static readonly DateTimeOffset CreatedAt = new(2026, 10, 21, 12, 30, 0, TimeSpan.Zero);

    public static IEnumerable<object[]> TitleControlCharacters =>
        ControlCharacters().Select(codePoint => new object[] { codePoint });

    public static IEnumerable<object[]> ForbiddenDescriptionControlCharacters =>
        ControlCharacters()
            .Where(codePoint => codePoint is not ('\t' or '\r' or '\n'))
            .Select(codePoint => new object[] { codePoint });

    [Fact]
    public void CreateAssignsIdentityOwnerAndInitialState()
    {
        TodoTask task = TodoTask.Create(UserId, "Learn EF Core", CreatedAt);

        Assert.NotEqual(Guid.Empty, task.TaskId);
        Assert.Equal(UserId, task.UserId);
        Assert.Equal("Learn EF Core", task.Title);
        Assert.Null(task.Description);
        Assert.Equal(TaskPriority.Normal, task.Priority);
        Assert.False(task.IsCompleted);
        Assert.Equal(CreatedAt, task.CreatedAt);
        Assert.Null(task.CompletedAt);
    }

    [Theory]
    [InlineData(TaskPriority.Low)]
    [InlineData(TaskPriority.Normal)]
    [InlineData(TaskPriority.High)]
    public void CreateKeepsExplicitDescriptionAndPriority(TaskPriority priority)
    {
        TodoTask task = TodoTask.Create(UserId, "Learn EF Core", CreatedAt, "Read the mapping guide", priority);

        Assert.Equal("Read the mapping guide", task.Description);
        Assert.Equal(priority, task.Priority);
    }

    [Fact]
    public void CreateAllowsDuplicateTitlesButAssignsDifferentIds()
    {
        TodoTask first = TodoTask.Create(UserId, "Learn EF Core", CreatedAt);
        TodoTask second = TodoTask.Create(UserId, "Learn EF Core", CreatedAt);

        Assert.Equal(first.Title, second.Title);
        Assert.NotEqual(first.TaskId, second.TaskId);
    }

    [Fact]
    public void CreateNormalizesTimestampToUtcWithoutChangingInstant()
    {
        DateTimeOffset localTime = CreatedAt.ToOffset(TimeSpan.FromHours(3));

        TodoTask task = TodoTask.Create(UserId, "Learn EF Core", localTime);

        Assert.Equal(CreatedAt, task.CreatedAt);
        Assert.Equal(TimeSpan.Zero, task.CreatedAt.Offset);
    }

    [Fact]
    public void CreateTrimsOuterWhitespaceAndPreservesInnerWhitespaceAndCase()
    {
        TodoTask task = TodoTask.Create(
            UserId,
            "\t\r\n\u00a0 Learn  EF\u00a0Core \u2003",
            CreatedAt,
            "\r\n  First  line\r\n\tSecond line  \u2003");

        Assert.Equal("Learn  EF\u00a0Core", task.Title);
        Assert.Equal("First  line\r\n\tSecond line", task.Description);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t\r\n")]
    [InlineData("\u00a0\u2003\u2028\u2029")]
    public void CreateNormalizesMissingDescriptionToNull(string? description)
    {
        TodoTask task = TodoTask.Create(UserId, "Learn EF Core", CreatedAt, description);

        Assert.Null(task.Description);
    }

    [Fact]
    public void CreateRejectsEmptyOwner()
    {
        ArgumentException exception = Assert.Throws<ArgumentException>(
            () => TodoTask.Create(Guid.Empty, "Learn EF Core", CreatedAt));

        Assert.Equal("userId", exception.ParamName);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(3)]
    [InlineData(int.MaxValue)]
    public void CreateRejectsUndefinedPriority(int priority)
    {
        ArgumentOutOfRangeException exception = Assert.Throws<ArgumentOutOfRangeException>(
            () => TodoTask.Create(UserId, "Learn EF Core", CreatedAt, priority: (TaskPriority)priority));

        Assert.Equal("priority", exception.ParamName);
    }

    [Fact]
    public void CreateRejectsNullTitle()
    {
        ArgumentNullException exception = Assert.Throws<ArgumentNullException>(
            () => TodoTask.Create(UserId, null!, CreatedAt));

        Assert.Equal("title", exception.ParamName);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t\r\n")]
    [InlineData("\u00a0\u2003\u2028\u2029")]
    public void CreateRejectsEmptyOrWhitespaceTitle(string title)
    {
        ArgumentException exception = Assert.Throws<ArgumentException>(
            () => TodoTask.Create(UserId, title, CreatedAt));

        Assert.Equal("title", exception.ParamName);
    }

    [Theory]
    [InlineData("a", 1)]
    [InlineData("a", 200)]
    [InlineData("😀", 1)]
    [InlineData("😀", 200)]
    [InlineData("e\u0301", 100)]
    public void CreateAcceptsTitleLengthInUnicodeCodePointsAfterTrimming(string unit, int repetitions)
    {
        string title = string.Concat(Enumerable.Repeat(unit, repetitions));

        TodoTask task = TodoTask.Create(UserId, "  " + title + "\t", CreatedAt);

        Assert.Equal(title, task.Title);
    }

    [Theory]
    [InlineData("a", 201)]
    [InlineData("😀", 201)]
    [InlineData("e\u0301", 101)]
    public void CreateRejectsTitleOverUnicodeCodePointLimit(string unit, int repetitions)
    {
        string title = string.Concat(Enumerable.Repeat(unit, repetitions));

        ArgumentException exception = Assert.Throws<ArgumentException>(
            () => TodoTask.Create(UserId, title, CreatedAt));

        Assert.Equal("title", exception.ParamName);
    }

    [Theory]
    [InlineData("a", 2000)]
    [InlineData("😀", 2000)]
    [InlineData("e\u0301", 1000)]
    public void CreateAcceptsDescriptionAtUnicodeCodePointLimitAfterTrimming(string unit, int repetitions)
    {
        string description = string.Concat(Enumerable.Repeat(unit, repetitions));

        TodoTask task = TodoTask.Create(UserId, "Title", CreatedAt, "\r\n" + description + "  ");

        Assert.Equal(description, task.Description);
    }

    [Theory]
    [InlineData("a", 2001)]
    [InlineData("😀", 2001)]
    [InlineData("e\u0301", 1001)]
    public void CreateRejectsDescriptionOverUnicodeCodePointLimit(string unit, int repetitions)
    {
        string description = string.Concat(Enumerable.Repeat(unit, repetitions));

        ArgumentException exception = Assert.Throws<ArgumentException>(
            () => TodoTask.Create(UserId, "Title", CreatedAt, description));

        Assert.Equal("description", exception.ParamName);
    }

    [Theory]
    [MemberData(nameof(TitleControlCharacters))]
    public void CreateRejectsEveryControlCharacterInsideTitle(int codePoint)
    {
        string title = "Before" + (char)codePoint + "After";

        ArgumentException exception = Assert.Throws<ArgumentException>(
            () => TodoTask.Create(UserId, title, CreatedAt));

        Assert.Equal("title", exception.ParamName);
    }

    [Theory]
    [InlineData("Before\u2028After")]
    [InlineData("Before\u2029After")]
    public void CreateRejectsUnicodeLineSeparatorsInsideTitle(string title)
    {
        ArgumentException exception = Assert.Throws<ArgumentException>(
            () => TodoTask.Create(UserId, title, CreatedAt));

        Assert.Equal("title", exception.ParamName);
    }

    [Theory]
    [MemberData(nameof(ForbiddenDescriptionControlCharacters))]
    public void CreateRejectsForbiddenControlCharactersInsideDescription(int codePoint)
    {
        string description = "Before" + (char)codePoint + "After";

        ArgumentException exception = Assert.Throws<ArgumentException>(
            () => TodoTask.Create(UserId, "Title", CreatedAt, description));

        Assert.Equal("description", exception.ParamName);
    }

    [Theory]
    [InlineData("First\nSecond")]
    [InlineData("First\rSecond")]
    [InlineData("First\r\nSecond")]
    [InlineData("First\tSecond")]
    [InlineData("First\u2028Second\u2029Third")]
    public void CreateAllowsLineBreaksAndTabsInDescription(string description)
    {
        TodoTask task = TodoTask.Create(UserId, "Title", CreatedAt, description);

        Assert.Equal(description, task.Description);
    }

    [Fact]
    public void CreateRejectsMalformedUnicodeInTitle()
    {
        foreach (string invalidText in MalformedUnicode())
        {
            ArgumentException exception = Assert.Throws<ArgumentException>(
                () => TodoTask.Create(UserId, invalidText, CreatedAt));

            Assert.Equal("title", exception.ParamName);
        }
    }

    [Fact]
    public void CreateRejectsMalformedUnicodeInDescription()
    {
        foreach (string invalidText in MalformedUnicode())
        {
            ArgumentException exception = Assert.Throws<ArgumentException>(
                () => TodoTask.Create(UserId, "Title", CreatedAt, invalidText));

            Assert.Equal("description", exception.ParamName);
        }
    }

    [Fact]
    public void CreatePreservesUnicodeAndMarkupAsPlainTextWithoutFilteringContent()
    {
        const string title = "Купити молоко 🥛 <b>today</b> \uFFFD";
        const string description = "**Important**\n<script>alert('text')</script> 👩‍💻";

        TodoTask task = TodoTask.Create(UserId, title, CreatedAt, description);

        Assert.Equal(title, task.Title);
        Assert.Equal(description, task.Description);
    }

    private static IEnumerable<int> ControlCharacters() =>
        Enumerable.Range(0, 32).Concat(Enumerable.Range(0x7f, 33));

    private static string[] MalformedUnicode() =>
        ["\uD800", "\uDC00", "Before\uD800After", "Before\uDC00After", "\uDC00\uD800"];
}
