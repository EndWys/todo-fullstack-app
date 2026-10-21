using System.Buffers;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Text;

namespace TodoApp.Domain.Features.Tasks;

// Text validation expects fields normalized by TodoTaskNormalizer in the entity factory.
internal static class TodoTaskValidator
{
    public static void ValidateUserId(Guid userId)
    {
        if (userId == Guid.Empty)
        {
            throw new ArgumentException("Task owner is required.", nameof(userId));
        }
    }

    public static void ValidatePriority(TaskPriority priority)
    {
        if (!Enum.IsDefined(priority))
        {
            throw new ArgumentOutOfRangeException(nameof(priority), "Task priority is invalid.");
        }
    }

    public static void ValidateTitle([NotNull] string? title)
    {
        ArgumentNullException.ThrowIfNull(title);

        if (title.Length == 0)
        {
            throw new ArgumentException("Task title is required.", nameof(title));
        }

        ValidateText(title, TodoTask.MaxTitleLength, allowLineBreaks: false, nameof(title));
    }

    public static void ValidateDescription(string? description)
    {
        if (description is not null)
        {
            ValidateText(description, TodoTask.MaxDescriptionLength, allowLineBreaks: true, nameof(description));
        }
    }

    private static void ValidateText(string value, int maximumLength, bool allowLineBreaks, string parameterName)
    {
        ReadOnlySpan<char> remaining = value.AsSpan();
        int length = 0;

        while (!remaining.IsEmpty)
        {
            // Reject malformed UTF-16 instead of silently replacing it while counting/storing text.
            if (Rune.DecodeFromUtf16(remaining, out Rune rune, out int consumed) != OperationStatus.Done)
            {
                throw new ArgumentException("Task text must contain valid Unicode.", parameterName);
            }

            UnicodeCategory category = Rune.GetUnicodeCategory(rune);
            bool allowedControl = allowLineBreaks && rune.Value is ('\t' or '\r' or '\n');
            if ((category == UnicodeCategory.Control && !allowedControl) ||
                (!allowLineBreaks && category is (UnicodeCategory.LineSeparator or UnicodeCategory.ParagraphSeparator)))
            {
                throw new ArgumentException("Task text contains a forbidden control character or line break.", parameterName);
            }

            length++;
            if (length > maximumLength)
            {
                throw new ArgumentException(
                    $"Task text must not exceed {maximumLength} Unicode code points.", parameterName);
            }

            remaining = remaining[consumed..];
        }
    }
}
