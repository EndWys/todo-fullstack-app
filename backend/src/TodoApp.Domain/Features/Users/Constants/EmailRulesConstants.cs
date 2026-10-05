namespace TodoApp.Domain.Features.Users;

public static class EmailRulesConstants
{
    public const int MaxEmailLength = 254;
    public const int MaxLocalPartLength = 64;
    public const int MaxDomainLabelLength = 63;
    public const string AllowedLocalPartSpecialCharacters = "!#$%&'*+-/=?^_`{|}~.";
}