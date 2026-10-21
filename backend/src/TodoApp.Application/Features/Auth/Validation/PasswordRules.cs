namespace TodoApp.Application.Features.Auth.Validation;

public sealed record PasswordRules
{
    public PasswordRules(int minimumLength, int maximumLength, bool rejectOnlyWhitespace)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(minimumLength, 1);
        ArgumentOutOfRangeException.ThrowIfLessThan(maximumLength, minimumLength);
        MinimumLength = minimumLength;
        MaximumLength = maximumLength;
        RejectOnlyWhitespace = rejectOnlyWhitespace;
    }

    public int MinimumLength { get; }
    public int MaximumLength { get; }
    public bool RejectOnlyWhitespace { get; }
}
