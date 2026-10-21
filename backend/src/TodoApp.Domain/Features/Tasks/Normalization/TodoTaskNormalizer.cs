namespace TodoApp.Domain.Features.Tasks;

internal static class TodoTaskNormalizer
{
    public static string? NormalizeTitle(string? title)
    {
        return title?.Trim();
    }

    public static string? NormalizeDescription(string? description)
    {
        string? normalizedDescription = description?.Trim();
        return string.IsNullOrEmpty(normalizedDescription) ? null : normalizedDescription;
    }
}
