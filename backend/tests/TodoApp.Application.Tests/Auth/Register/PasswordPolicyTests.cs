using TodoApp.Application.Features.Auth.Validation;

namespace TodoApp.Application.Tests.Auth.Register;

public sealed class PasswordPolicyTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void ValidateReturnsRequiredForMissingPassword(string? password)
    {
        Assert.Equal(PasswordValidationError.Required, PasswordPolicy.Validate(password, PasswordPolicyRevisions.V1));
    }

    [Theory]
    [InlineData("                ")]
    [InlineData("\t\r\n               ")]
    public void ValidateRejectsPasswordContainingOnlyWhitespace(string password)
    {
        Assert.Equal(PasswordValidationError.OnlyWhitespace, PasswordPolicy.Validate(password, PasswordPolicyRevisions.V1));
    }

    [Theory]
    [InlineData("short")]
    [InlineData("12345678901234")]
    public void ValidateRejectsPasswordShorterThanMinimum(string password)
    {
        Assert.Equal(PasswordValidationError.TooShort, PasswordPolicy.Validate(password, PasswordPolicyRevisions.V1));
    }

    [Fact]
    public void ValidateAcceptsPasswordAtMinimumLength()
    {
        Assert.Null(PasswordPolicy.Validate("123456789012345", PasswordPolicyRevisions.V1));
    }

    [Fact]
    public void ValidateCountsUnicodeCodePointsRatherThanUtf16CodeUnits()
    {
        string password = string.Concat(Enumerable.Repeat("😀", 15));

        Assert.Null(PasswordPolicy.Validate(password, PasswordPolicyRevisions.V1));
    }

    [Fact]
    public void ValidateAcceptsWhitespaceWhenPasswordAlsoContainsNonWhitespaceCharacters()
    {
        Assert.Null(PasswordPolicy.Validate("long pass phrase", PasswordPolicyRevisions.V1));
    }

    [Fact]
    public void ValidateAcceptsPasswordAtMaximumLength()
    {
        string password = new('a', 256);

        Assert.Null(PasswordPolicy.Validate(password, PasswordPolicyRevisions.V1));
    }

    [Fact]
    public void ValidateRejectsPasswordLongerThanMaximumLength()
    {
        string password = new('a', 257);

        Assert.Equal(PasswordValidationError.TooLong, PasswordPolicy.Validate(password, PasswordPolicyRevisions.V1));
    }
}
