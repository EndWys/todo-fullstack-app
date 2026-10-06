using TodoApp.Application.Features.Auth.Register;

namespace TodoApp.Api.Features.Auth.Register;

public static class RegisterEndpoint
{
    public static void Map(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/auth/register", HandleAsync)
            .WithName("Register")
            .AllowAnonymous();
    }

    private static async Task<IResult> HandleAsync(
        RegisterRequest? request,
        RegisterHandler handler,
        CancellationToken cancellationToken)
    {
        Dictionary<string, string[]> requiredErrors = GetRequiredFieldErrors(request);
        
        if (requiredErrors.Count > 0)
        {
            return Results.ValidationProblem(requiredErrors);
        }

        try
        {
            RegisterResult result = await handler.Handle(
                new RegisterCommand(request!.Email, request.Password), cancellationToken);

            return Results.Json(
                new RegisterResponse(result.UserId, result.Email),
                statusCode: StatusCodes.Status201Created);
        }
        catch (InvalidPasswordException exception)
        {
            return FieldError("password", GetPasswordErrorMessage(exception.Error));
        }
        catch (ArgumentException exception) when (exception.ParamName == "email")
        {
            return FieldError("email", "Email is required.");
        }
        catch (FormatException)
        {
            return FieldError("email", "Email address has an invalid format.");
        }
        catch (EmailAlreadyRegisteredException)
        {
            return FieldError("email", "Email is already registered.", StatusCodes.Status409Conflict);
        }
    }

    private static Dictionary<string, string[]> GetRequiredFieldErrors(RegisterRequest? request)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request?.Email))
        {
            errors["email"] = ["Email is required."];
        }

        if (string.IsNullOrEmpty(request?.Password))
        {
            errors["password"] = ["Password is required."];
        }

        return errors;
    }

    private static string GetPasswordErrorMessage(PasswordValidationError error) => error switch
    {
        PasswordValidationError.Required => "Password is required.",
        PasswordValidationError.OnlyWhitespace => "Password must not consist only of whitespace.",
        PasswordValidationError.TooShort => "Password must contain at least 15 Unicode code points.",
        PasswordValidationError.TooLong => "Password must contain no more than 256 Unicode code points.",
        _ => "Password is invalid."
    };

    private static IResult FieldError(
        string field,
        string message,
        int statusCode = StatusCodes.Status400BadRequest) =>
        Results.ValidationProblem(
            new Dictionary<string, string[]> { [field] = [message] },
            statusCode: statusCode);
}
