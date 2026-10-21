using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using TodoApp.Application.Features.Tasks.Abstractions;
using TodoApp.Application.Features.Tasks.GetTasks;
using TodoApp.Domain.Features.Tasks;
using TodoApp.IntegrationTests.Auth;

namespace TodoApp.IntegrationTests.Tasks;

// Runs the real HTTP/cookie/CSRF pipeline and handlers, but never connects to a database.
internal sealed class TasksHttpHost : IDisposable
{
    public static readonly DateTimeOffset Now = new(2026, 10, 21, 12, 30, 0, TimeSpan.Zero);
    public RecordingTaskRepository Repository { get; } = new();
    public LoginApiFactory Api { get; }
    public Guid UserId => Api.Repository.User.UserId;

    public TasksHttpHost()
    {
        Api = new LoginApiFactory(services =>
        {
            services.RemoveAll<ITaskRepository>();
            services.AddSingleton<ITaskRepository>(Repository);
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(new FixedClock());
        });
    }

    public async Task<HttpClient> SignedInClient(bool prepareCsrf = true)
    {
        HttpClient client = Api.CreateHttpsClient(handleCookies: true);
        using var login = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = Api.Repository.User.Email.EmailAddress,
            password = LoginApiFactory.Password
        });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        if (prepareCsrf) return client;

        HttpClient unprepared = Api.CreateHttpsClient(prepareCsrf: false);
        unprepared.DefaultRequestHeaders.Add("Cookie", Assert.Single(login.Headers.GetValues("Set-Cookie")).Split(';')[0]);
        client.Dispose();
        return unprepared;
    }

    public string ProtectedCookie(string? id, string? email)
    {
        var options = Api.Services.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>()
            .Get(CookieAuthenticationDefaults.AuthenticationScheme);
        var claims = new List<Claim>();
        if (id is not null) claims.Add(new Claim(ClaimTypes.NameIdentifier, id));
        if (email is not null) claims.Add(new Claim(ClaimTypes.Email, email));
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));
        var ticket = new AuthenticationTicket(principal, new AuthenticationProperties
        {
            IssuedUtc = Api.Clock.GetUtcNow(), ExpiresUtc = Api.Clock.GetUtcNow().AddHours(8)
        }, CookieAuthenticationDefaults.AuthenticationScheme);
        return "__Host-TodoApp.Auth=" + options.TicketDataFormat.Protect(ticket);
    }

    public void Dispose() => Api.Dispose();

    private sealed class FixedClock : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => Now;
    }

    internal sealed class RecordingTaskRepository : ITaskRepository
    {
        public int AddCount { get; private set; }
        public int ReadCount { get; private set; }
        public TodoTask? Added { get; private set; }
        public Guid ReadOwner { get; private set; }
        public int Page { get; private set; }
        public int PageSize { get; private set; }
        public Exception? Failure { get; set; }
        public IReadOnlyList<TaskListItem> Items { get; set; } = [];
        public int TotalCount { get; set; }

        public Task AddAsync(TodoTask task, CancellationToken cancellationToken)
        {
            AddCount++;
            if (Failure is not null) throw Failure;
            Added = task;
            return Task.CompletedTask;
        }

        public Task<GetTasksResult> GetPageAsync(Guid userId, int page, int pageSize, CancellationToken cancellationToken)
        {
            ReadCount++;
            ReadOwner = userId;
            Page = page;
            PageSize = pageSize;
            if (Failure is not null) throw Failure;
            return Task.FromResult(new GetTasksResult(Items, TotalCount, page, pageSize));
        }
    }
}
