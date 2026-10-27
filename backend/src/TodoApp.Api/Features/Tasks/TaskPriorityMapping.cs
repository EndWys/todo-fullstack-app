using TodoApp.Domain.Features.Tasks;

namespace TodoApp.Api.Features.Tasks;

internal static class TaskPriorityMapping
{
    public static bool TryParse(string? value, out TaskPriority priority)
    {
        priority = value switch
        {
            "low" => TaskPriority.Low,
            "high" => TaskPriority.High,
            _ => TaskPriority.Normal
        };
        return value is "low" or "normal" or "high";
    }

    public static string ToHttp(TaskPriority priority) => priority switch
    {
        TaskPriority.Low => "low",
        TaskPriority.Normal => "normal",
        TaskPriority.High => "high",
        _ => throw new InvalidOperationException("Unsupported task priority.")
    };
}
