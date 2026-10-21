using TodoApp.Application.Features.Auth.Validation;

namespace TodoApp.Application.Tests.Auth.Validation;

public sealed class EmailValidationTests
{
    [Theory]
    [InlineData(null, EmailValidationError.Required)]
    [InlineData("   ", EmailValidationError.Required)]
    [InlineData("not-an-email", EmailValidationError.InvalidFormat)]
    public void TranslatesOnlyEmailCreationErrors(string? value, EmailValidationError expected)
    {
        InvalidEmailException error = Assert.Throws<InvalidEmailException>(() => EmailValidation.Create(value));
        Assert.Equal(expected, error.Error);
        Assert.NotNull(error.InnerException);
    }

    [Fact]
    public void ReusesDomainNormalizationAndPreservesCase()
    {
        Assert.Equal("User@Example.com", EmailValidation.Create("\u0085 User@Example.com \u0085").EmailAddress);
    }
}
