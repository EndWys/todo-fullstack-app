using Microsoft.AspNetCore.Antiforgery;
using TodoApp.Api.Features.Auth.Csrf;

namespace TodoApp.Api.Middleware;

public sealed class CsrfProtectionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IAntiforgery antiforgery)
    {
        var request = context.Request;
        bool safeMethod = HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method)
            || HttpMethods.IsOptions(request.Method) || HttpMethods.IsTrace(request.Method);

        if (request.Path.StartsWithSegments("/api") && !safeMethod)
        {
            // JSON Minimal APIs do not automatically validate antiforgery tokens. Validate before
            // endpoint execution, including anonymous login/register. Require the AJAX header.
            bool valid = !string.IsNullOrWhiteSpace(request.Headers[CsrfDefaults.HeaderName]);
            if (valid)
            {
                try
                {
                    await antiforgery.ValidateRequestAsync(context);
                }
                catch (AntiforgeryValidationException)
                {
                    valid = false;
                }
            }

            if (!valid)
            {
                // Do not disclose token contents or framework validation details.
                context.Response.Headers.CacheControl = "no-store";
                await Results.Problem(statusCode: StatusCodes.Status400BadRequest,
                    title: "CSRF validation failed.",
                    extensions: new Dictionary<string, object?> { ["code"] = "csrf_validation_failed" })
                    .ExecuteAsync(context);
                return;
            }
        }

        await next(context);
    }
}
