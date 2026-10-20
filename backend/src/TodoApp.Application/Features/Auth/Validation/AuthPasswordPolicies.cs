namespace TodoApp.Application.Features.Auth.Validation;

public static class AuthPasswordPolicies
{
    public static PasswordRules Registration => PasswordPolicyRevisions.V1;

    public static PasswordRules Login { get; } =
        CreateLoginRules(PasswordPolicyRevisions.Supported);

    public static PasswordRules CreateLoginRules(IEnumerable<PasswordRules> supportedRevisions)
    {
        ArgumentNullException.ThrowIfNull(supportedRevisions);
        PasswordRules[] revisions = supportedRevisions.ToArray();
        if (revisions.Length == 0 || revisions.Any(revision => revision is null))
        {
            throw new ArgumentException("At least one valid revision is required.", nameof(supportedRevisions));
        }

        // A compatibility envelope, not a requirement to meet the latest creation policy.
        return new PasswordRules(
            revisions.Min(revision => revision.MinimumLength),
            revisions.Max(revision => revision.MaximumLength),
            revisions.All(revision => revision.RejectOnlyWhitespace));
    }
}
