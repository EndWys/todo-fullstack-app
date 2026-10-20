using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using TodoApp.Api.Features.Auth.Validation;
using TodoApp.Application.Features.Auth.Login;
using TodoApp.Application.Features.Auth.Validation;

namespace TodoApp.Api.Features.Auth.Login;

public static class LoginEndpoint
{
    public static void Map(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/auth/login", HandleAsync)
            .WithName("Login")
            .Produces<LoginResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .AllowAnonymous();
    }

    private static async Task<IResult> HandleAsync(
        LoginRequest? request,
        LoginHandler handler,
        HttpContext context,
        CancellationToken cancellationToken)
    {
        var requiredErrors = AuthInputErrors.RequiredFields(request?.Email, request?.Password);
        if (requiredErrors.Count > 0)
            return Results.ValidationProblem(requiredErrors);

        LoginResult result;
        try
        {
            result = await handler.Handle(new LoginCommand(request!.Email, request.Password), cancellationToken);
        }
        catch (InvalidPasswordException exception)
        {
            return AuthInputErrors.Field("password",
                AuthInputErrors.PasswordMessage(exception.Error, AuthPasswordPolicies.Login));
        }
        catch (InvalidEmailException exception)
        {
            return AuthInputErrors.Field("email", AuthInputErrors.EmailMessage(exception.Error));
        }
        catch (InvalidCredentialsException)
        {
            // Neither status nor message reveals whether this email belongs to an account.
            return Results.Problem(statusCode: StatusCodes.Status401Unauthorized,
                title: "Invalid email or password.");
        }

        await SignInAsync(context, result);
        return Results.Ok(new LoginResponse(result.UserId, result.Email));
    }

    private static Task SignInAsync(HttpContext context, LoginResult result)
    {
        var identity = new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, result.UserId.ToString()),
            new Claim(ClaimTypes.Email, result.Email)
        ], CookieAuthenticationDefaults.AuthenticationScheme);

        // No credentials in the ticket. Its fixed lifetime comes from the cookie scheme.
        return context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity), new AuthenticationProperties { IsPersistent = false });
    }
}
