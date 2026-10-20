using TodoApp.Application.Features.Auth.Validation;

namespace TodoApp.Application.Tests.Auth.Validation;

public sealed class PasswordRevisionTests
{
    [Fact]
    public void V1KeepsPublishedRules()
    {
        Assert.Equal(15, PasswordPolicyRevisions.V1.MinimumLength);
        Assert.Equal(256, PasswordPolicyRevisions.V1.MaximumLength);
        Assert.True(PasswordPolicyRevisions.V1.RejectOnlyWhitespace);
        Assert.Same(PasswordPolicyRevisions.V1, AuthPasswordPolicies.Registration);
        Assert.Contains(AuthPasswordPolicies.Registration, PasswordPolicyRevisions.Supported);
    }

    [Fact]
    public void LoginUsesAllSupportedRevisions()
    {
        PasswordRules expected = AuthPasswordPolicies.CreateLoginRules(PasswordPolicyRevisions.Supported);
        Assert.Equal(expected, AuthPasswordPolicies.Login);
        foreach (PasswordRules revision in PasswordPolicyRevisions.Supported)
        {
            Assert.Null(PasswordPolicy.Validate(new string('a', revision.MinimumLength), AuthPasswordPolicies.Login));
            Assert.Null(PasswordPolicy.Validate(new string('a', revision.MaximumLength), AuthPasswordPolicies.Login));
        }
    }

    [Fact]
    public void LongerNewPasswordsCanLogInWithoutBreakingV1()
    {
        PasswordRules v1 = PasswordPolicyRevisions.V1;
        var futureRevision = new PasswordRules(20, 512, true);
        PasswordRules loginRules = AuthPasswordPolicies.CreateLoginRules([v1, futureRevision]);

        Assert.Null(PasswordPolicy.Validate(new string('a', 300), futureRevision));
        Assert.Null(PasswordPolicy.Validate(new string('a', 300), loginRules));
        Assert.Null(PasswordPolicy.Validate(new string('a', 15), loginRules));
        Assert.Equal(PasswordValidationError.TooLong, PasswordPolicy.Validate(new string('a', 300), v1));
        Assert.Equal(PasswordValidationError.TooShort, PasswordPolicy.Validate(new string('a', 15), futureRevision));
    }

    [Fact]
    public void MorePermissiveNewRulesAreAlsoCompatible()
    {
        var futureRevision = new PasswordRules(8, 512, false);
        PasswordRules loginRules = AuthPasswordPolicies.CreateLoginRules([PasswordPolicyRevisions.V1, futureRevision]);

        Assert.Null(PasswordPolicy.Validate("12345678", loginRules));
        Assert.Null(PasswordPolicy.Validate(new string(' ', 15), loginRules));
        Assert.Null(PasswordPolicy.Validate(new string('a', 256), loginRules));
        Assert.Equal(PasswordValidationError.TooShort, PasswordPolicy.Validate("12345678", PasswordPolicyRevisions.V1));
        Assert.Equal(PasswordValidationError.OnlyWhitespace, PasswordPolicy.Validate(new string(' ', 15), PasswordPolicyRevisions.V1));
    }

    [Fact]
    public void CombiningRulesDoesNotMutatePublishedRevisions()
    {
        AuthPasswordPolicies.CreateLoginRules([PasswordPolicyRevisions.V1, new PasswordRules(8, 512, false)]);
        Assert.Equal(new PasswordRules(15, 256, true), PasswordPolicyRevisions.V1);
    }

    [Fact]
    public void SharedValidationCountsUnicodeCodePointsForAnyRevision()
    {
        var rules = new PasswordRules(8, 8, false);
        string password = string.Concat(Enumerable.Repeat("😀", 8));
        Assert.Null(PasswordPolicy.Validate(password, rules));
        Assert.Equal(PasswordValidationError.TooLong, PasswordPolicy.Validate(password + "a", rules));
        Assert.Equal(PasswordValidationError.Required, PasswordPolicy.Validate("", rules));
    }

    [Theory]
    [InlineData(0, 10)]
    [InlineData(15, 14)]
    public void RejectsInvalidRuleLimits(int minimum, int maximum)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new PasswordRules(minimum, maximum, true));
    }

    [Fact]
    public void RejectsMissingOrEmptySupportedRevisions()
    {
        Assert.Throws<ArgumentNullException>(() => AuthPasswordPolicies.CreateLoginRules(null!));
        Assert.Throws<ArgumentException>(() => AuthPasswordPolicies.CreateLoginRules([]));
        Assert.Throws<ArgumentException>(() => AuthPasswordPolicies.CreateLoginRules([null!]));
    }

    [Fact]
    public void SupportedRevisionCollectionIsReadOnly()
    {
        var revisions = Assert.IsAssignableFrom<IList<PasswordRules>>(PasswordPolicyRevisions.Supported);
        Assert.Throws<NotSupportedException>(() => revisions.Add(new PasswordRules(8, 512, false)));
    }
}
