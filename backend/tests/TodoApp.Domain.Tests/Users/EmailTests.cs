using TodoApp.Domain.Users;

namespace TodoApp.Domain.Tests.Users;

public sealed class EmailTests
{
    private static readonly EmailCase[] Cases =
    [
        new("null", null, false),
        new("empty", "", false),
        new("spaces only", "   ", false),
        new("ordinary", "user@example.com", true),
        new("uppercase", "User@Example.COM", true),
        new("trimmed outer spaces", "  user@example.com  ", true),
        new("tag and subdomain", "user.name+tag@sub.example.co.uk", true),
        new("digits and hyphen", "user123@my-domain.example", true),
        new("single-letter labels", "a@b.c", true),
        new("plus sign in local part", "user+tag@example.com", true),
        new("apostrophe in local part", "o'hara@example.com", true),
        new("64-character local part", new string('a', 64) + "@example.com", true),
        new("254-character address", new string('a', 64) + "@" + new string('b', 63) + "." + new string('c', 63) + "." + new string('d', 61), true),
        new("missing at sign", "user.example.com", false),
        new("missing local part", "@example.com", false),
        new("missing domain", "user@", false),
        new("two at signs", "user@@example.com", false),
        new("space in local part", "us er@example.com", false),
        new("space in domain", "user@exam ple.com", false),
        new("tab in local part", "us\ter@example.com", false),
        new("newline at end", "user@example.com\n", true), // Create trims outer whitespace.
        new("newline inside", "user@exam\nple.com", false),
        new("header injection", "user@example.com\r\nBcc: victim@example.com", false),
        new("null character", "user@exam\0ple.com", false),
        new("zero-width character", "us\u200Ber@example.com", false),
        new("display name", "Denis <user@example.com>", false),
        new("extra text before address", "some text user@example.com", false),
        new("local starts with dot", ".user@example.com", false),
        new("local ends with dot", "user.@example.com", false),
        new("double dot in local", "us..er@example.com", false),
        new("double dot in domain", "user@exam..ple.com", false),
        new("domain starts with dot", "user@.example.com", false),
        new("domain ends with dot", "user@example.com.", false),
        new("empty middle domain label", "user@a..example.com", false),
        new("domain label starts with hyphen", "user@-example.com", false),
        new("domain label ends with hyphen", "user@example-.com", false),
        new("slash in domain", "user@example.com/", false),
        new("underscore in domain", "user@exa_mple.com", false),
        new("no dot in domain", "user@localhost", false),
        new("address literal", "user@[127.0.0.1]", false),
        new("quoted local part", "\"user.name\"@example.com", false),
        new("quoted local with space", "\"user name\"@example.com", false),
        new("unicode local part", "üser@example.com", false),
        new("unicode domain", "user@bücher.de", false),
        new("65-character local part", new string('a', 65) + "@example.com", false),
        new("63-character domain label", "u@" + new string('a', 63) + ".com", true),
        new("64-character domain label", "u@" + new string('a', 64) + ".com", false),
        new("255-character address", new string('a', 64) + "@" + new string('b', 63) + "." + new string('c', 63) + "." + new string('d', 62), false)
    ];

    public static IEnumerable<object[]> ValidationCases =>
        Cases.Select(testCase => new object[]
        {
            testCase.Name,
            testCase.Input!,
            testCase.ExpectedDomainResult
        });

    [Theory]
    [MemberData(nameof(ValidationCases))]
    public void CreateFollowsSupportedEmailPolicy(string caseName, string? input, bool expectedToSucceed)
    {
        if (expectedToSucceed)
        {
            Email email = Email.Create(input);
            Assert.Equal(input!.Trim(), email.EmailAddress);
            return;
        }

        Exception? exception = Record.Exception(() => Email.Create(input));
        Type expectedException = string.IsNullOrWhiteSpace(input)
            ? typeof(ArgumentException)
            : typeof(FormatException);

        Assert.True(exception?.GetType() == expectedException,
            $"{caseName}: expected {expectedException.Name}, got {exception?.GetType().Name ?? "no exception"}.");
    }

    [Fact]
    public void EmailValueEqualityIgnoresCaseAndPreservesOriginalSpelling()
    {
        Email first = Email.Create(" User@Example.com ");
        Email second = Email.Create("user@example.com");

        Assert.Equal("User@Example.com", first.EmailAddress);
        Assert.True(first.Equals(second));
        Assert.True(first == second);
        Assert.False(first != second);
        Assert.Equal(first.GetHashCode(), second.GetHashCode());
        Assert.Single(new HashSet<Email> { first, second });
    }

    [Fact]
    public void EqualityOperatorsHandleNullOnEitherSide()
    {
        Email? missing = null;
        Email existing = Email.Create("user@example.com");

        Assert.True(missing == null);
        Assert.False(missing != null);
        Assert.False(missing == existing);
        Assert.False(existing == missing);
        Assert.True(missing != existing);
        Assert.True(existing != missing);
    }

    [Fact]
    public void ObjectEqualityUsesEmailValueAndRejectsOtherTypes()
    {
        Email email = Email.Create("User@Example.com");
        object sameAddress = Email.Create("user@example.com");

        Assert.True(email.Equals(email));
        Assert.True(email.Equals((object)email));
        Assert.True(email.Equals(sameAddress));
        Assert.False(email.Equals((object?)null));
        Assert.False(email.Equals("user@example.com"));
        Assert.False(email.Equals(Email.Create("other@example.com")));
    }

    private sealed record EmailCase(string Name, string? Input, bool ExpectedDomainResult);
}
