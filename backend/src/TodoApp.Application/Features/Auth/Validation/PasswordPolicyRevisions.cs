namespace TodoApp.Application.Features.Auth.Validation;

public static class PasswordPolicyRevisions
{
    // Published revisions are immutable; changes require a new revision.
    public static PasswordRules V1 { get; } = new(15, 256, rejectOnlyWhitespace: true);

    // Keep every revision that may have been used to create an existing password.
    public static IReadOnlyList<PasswordRules> Supported { get; } =
        Array.AsReadOnly(new[] { V1 });
}
