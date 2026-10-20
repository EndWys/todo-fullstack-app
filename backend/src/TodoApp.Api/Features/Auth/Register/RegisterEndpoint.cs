using TodoApp.Application.Features.Auth.Register;
using TodoApp.Api.Features.Auth.Validation;

using TodoApp.Application.Features.Auth.Validation;

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
        Dictionary<string, string[]> requiredErrors = AuthInputErrors.RequiredFields(request?.Email, request?.Password);
        
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
            return AuthInputErrors.Field("password",
                AuthInputErrors.PasswordMessage(exception.Error, AuthPasswordPolicies.Registration));
        }
        catch (InvalidEmailException exception)
        {
            return AuthInputErrors.Field("email", AuthInputErrors.EmailMessage(exception.Error));
        }
        catch (EmailAlreadyRegisteredException)
        {
            return AuthInputErrors.Field("email", "Email is already registered.", StatusCodes.Status409Conflict);
        }
    }
}
