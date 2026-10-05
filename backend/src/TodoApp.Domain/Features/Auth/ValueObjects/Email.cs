using System.Net.Mail;

namespace TodoApp.Domain.Features.Auth;

public sealed class Email : IEquatable<Email>
{
    private Email(string emailAddress)
    {
        EmailAddress = emailAddress;
    }

    public string EmailAddress { get; }

    public static Email Create(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new ArgumentException("Email address is required.", nameof(email));
        }

        string trimmedEmail = email.Trim();

        ValidateFormat(trimmedEmail);

        return new Email(trimmedEmail);
    }

    public bool Equals(Email? other)
    {
        if (other is null) return false;
        if (ReferenceEquals(this, other)) return true;
        return StringComparer.OrdinalIgnoreCase.Equals(EmailAddress, other.EmailAddress);
    }

    public override bool Equals(object? obj)
    {
        return ReferenceEquals(this, obj) || obj is Email other && Equals(other);
    }

    public override int GetHashCode()
    {
        return StringComparer.OrdinalIgnoreCase.GetHashCode(EmailAddress);
    }

    public static bool operator ==(Email? first, Email? second)
    {
        if (first is null)
        {
            if (second is null)
            {
                return true;
            }

            return false;
        }

        return first.Equals(second);
    }

    public static bool operator !=(Email? first, Email? second)
    {
        return !(first == second);
    }

    private static void ValidateFormat(string emailAddress)
    {
        if (emailAddress.Length > EmailRulesConstants.MaxEmailLength)
        {
            throw new FormatException($"Email address must not exceed {EmailRulesConstants.MaxEmailLength} characters.");
        }

        if (emailAddress.Any(char.IsWhiteSpace) ||
            !MailAddress.TryCreate(emailAddress, out MailAddress? parsedAddress) ||
            !string.Equals(parsedAddress.Address, emailAddress, StringComparison.Ordinal))
        {
            throw new FormatException("Email address has an invalid format.");
        }

        string localPart = parsedAddress.User;
        if (localPart.Length is 0 or > EmailRulesConstants.MaxLocalPartLength ||
            localPart[^1] == '.' ||
            localPart.Any(character =>
                !char.IsAsciiLetterOrDigit(character) &&
                !EmailRulesConstants.AllowedLocalPartSpecialCharacters.Contains(character)))
        {
            throw new FormatException("Email address has an invalid local part.");
        }

        string[] domainLabels = parsedAddress.Host.Split('.');
        if (domainLabels.Length < 2 ||
            domainLabels.Any(label =>
                label.Length is 0 or > EmailRulesConstants.MaxDomainLabelLength ||
                label[0] == '-' ||
                label[^1] == '-' ||
                label.Any(character =>
                    !char.IsAsciiLetterOrDigit(character) && character != '-')))
        {
            throw new FormatException("Email address has an invalid domain.");
        }
    }
}
