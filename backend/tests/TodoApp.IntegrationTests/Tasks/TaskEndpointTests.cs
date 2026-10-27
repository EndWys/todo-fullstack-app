using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Net.Http.Headers;
using TodoApp.Api.Features.Auth.Csrf;
using TodoApp.Application.Features.Tasks.GetTasks;
using TodoApp.Domain.Features.Tasks;

namespace TodoApp.IntegrationTests.Tasks;

public sealed class TaskEndpointTests
{
    [Theory]
    [InlineData("low", TaskPriority.Low)]
    [InlineData("normal", TaskPriority.Normal)]
    [InlineData("high", TaskPriority.High)]
    public async Task CreateReturnsNormalizedPublicRepresentationAfterCookieLogin(string priority, TaskPriority expected)
    {
        using var host = new TasksHttpHost();
        using HttpClient client = await host.SignedInClient();
        using var response = await client.PostAsJsonAsync("/api/tasks", new
        {
            title = "  Learn  EF Core 🥛  ", description = "  First\n\tSecond  ", priority
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Null(response.Headers.Location);
        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        TodoTask task = Assert.IsType<TodoTask>(host.Repository.Added);
        Assert.Equal(host.UserId, task.UserId);
        Assert.Equal(expected, task.Priority);
        Assert.Equal(TasksHttpHost.Now, task.CreatedAt);
        using JsonDocument json = await ReadJson(response);
        JsonElement body = json.RootElement;
        Assert.Equal(task.TaskId, body.GetProperty("id").GetGuid());
        Assert.Equal("Learn  EF Core 🥛", body.GetProperty("title").GetString());
        Assert.Equal("First\n\tSecond", body.GetProperty("description").GetString());
        Assert.Equal(priority, body.GetProperty("priority").GetString());
        Assert.False(body.GetProperty("isCompleted").GetBoolean());
        Assert.Equal(TasksHttpHost.Now, body.GetProperty("createdAt").GetDateTimeOffset());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("completedAt").ValueKind);
        Assert.Equal(7, body.EnumerateObject().Count());
        Assert.Equal(1, host.Repository.AddCount);
    }

    [Theory]
    [InlineData("{\"title\":\"Title\"}")]
    [InlineData("{\"title\":\"Title\",\"description\":null}")]
    [InlineData("{\"title\":\"Title\",\"description\":\"  \\t\\r\\n  \"}")]
    public async Task CreateDefaultsOmittedPriorityAndReturnsExplicitNullDescription(string body)
    {
        using var host = new TasksHttpHost();
        using HttpClient client = await host.SignedInClient();
        using var response = await PostJson(client, body);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using JsonDocument json = await ReadJson(response);
        Assert.Equal("normal", json.RootElement.GetProperty("priority").GetString());
        Assert.Equal(JsonValueKind.Null, json.RootElement.GetProperty("description").ValueKind);
    }

    [Theory]
    [InlineData("{}", "title")]
    [InlineData("{\"title\":null}", "title")]
    [InlineData("{\"title\":\" \\t\\r\\n \"}", "title")]
    [InlineData("{\"title\":\"Before\\nAfter\"}", "title")]
    [InlineData("{\"title\":\"Before\\u0000After\"}", "title")]
    [InlineData("{\"title\":\"Title\",\"description\":\"Before\\u0001After\"}", "description")]
    [InlineData("{\"title\":\"Title\",\"priority\":null}", "priority")]
    [InlineData("{\"title\":\"Title\",\"priority\":\"\"}", "priority")]
    [InlineData("{\"title\":\"Title\",\"priority\":\"High\"}", "priority")]
    [InlineData("{\"title\":\"Title\",\"priority\":\"urgent\"}", "priority")]
    [InlineData("{\"title\":\"Title\",\"priority\":\"2\"}", "priority")]
    public async Task SemanticErrorsReturnSafeFieldValidationWithoutSaving(string body, string field)
    {
        using var host = new TasksHttpHost();
        using HttpClient client = await host.SignedInClient();
        using var response = await PostJson(client, body);

        await AssertFieldError(response, field);
        Assert.Equal(0, host.Repository.AddCount);
    }

    [Theory]
    [InlineData("title", 200, true)]
    [InlineData("title", 201, false)]
    [InlineData("description", 2000, true)]
    [InlineData("description", 2001, false)]
    public async Task UnicodeLimitsRemainDomainLimitsNotUtf16Length(string field, int count, bool valid)
    {
        using var host = new TasksHttpHost();
        using HttpClient client = await host.SignedInClient();
        string value = string.Concat(Enumerable.Repeat("😀", count));
        using var response = await client.PostAsJsonAsync("/api/tasks", new
        {
            title = field == "title" ? value : "Title", description = field == "description" ? value : null
        });

        if (valid) Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        else await AssertFieldError(response, field);
        Assert.Equal(valid ? 1 : 0, host.Repository.AddCount);
    }

    [Theory]
    [InlineData("")]
    [InlineData("null")]
    [InlineData("[]")]
    [InlineData("42")]
    [InlineData("\"text\"")]
    [InlineData("{")]
    [InlineData("{\"title\":123}")]
    [InlineData("{\"title\":true}")]
    [InlineData("{\"title\":\"Title\",\"description\":[]}")]
    [InlineData("{\"title\":\"Title\",\"priority\":2}")]
    [InlineData("{\"title\":\"Title\",\"priority\":true}")]
    [InlineData("{\"title\":\"First\",\"title\":\"Second\"}")]
    [InlineData("{\"Title\":\"Title\"}")]
    [InlineData("{\"title\":\"\\uD800\"}")]
    [InlineData("{\"title\":\"\\uDC00\"}")]
    [InlineData("{\"title\":\"Title\",\"description\":\"\\uD800\"}")]
    public async Task InvalidJsonStructureOrTypesReturnProblemDetailsWithoutSaving(string body)
    {
        using var host = new TasksHttpHost();
        using HttpClient client = await host.SignedInClient();
        using var response = await PostJson(client, body);

        await AssertProblem(response, HttpStatusCode.BadRequest);
        Assert.Equal(0, host.Repository.AddCount);
    }

    [Fact]
    public async Task InvalidUtf8JsonIsRejectedWithoutReplacementOrSaving()
    {
        using var host = new TasksHttpHost();
        using HttpClient client = await host.SignedInClient();
        using var content = new ByteArrayContent([.. Encoding.UTF8.GetBytes("{\"title\":\""), 0xFF, .. Encoding.UTF8.GetBytes("\"}")]);
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");
        using var response = await client.PostAsync("/api/tasks", content);
        await AssertProblem(response, HttpStatusCode.BadRequest);
        Assert.Equal(0, host.Repository.AddCount);
    }

    [Theory]
    [InlineData("id")]
    [InlineData("taskId")]
    [InlineData("userId")]
    [InlineData("ownerId")]
    [InlineData("isCompleted")]
    [InlineData("createdAt")]
    [InlineData("completedAt")]
    [InlineData("categoryId")]
    [InlineData("typo")]
    public async Task UnknownAndServerOwnedBodyFieldsAreRejected(string field)
    {
        using var host = new TasksHttpHost();
        using HttpClient client = await host.SignedInClient();
        using var response = await client.PostAsJsonAsync("/api/tasks", new Dictionary<string, object?>
        {
            ["title"] = "Title", [field] = "must-not-be-used"
        });

        await AssertProblem(response, HttpStatusCode.BadRequest);
        Assert.Equal(0, host.Repository.AddCount);
    }

    [Fact]
    public async Task UnsupportedContentTypeReturns415AndDoesNotSave()
    {
        using var host = new TasksHttpHost();
        using HttpClient client = await host.SignedInClient();
        using var response = await client.PostAsync("/api/tasks", new StringContent("Title", Encoding.UTF8, "text/plain"));

        await AssertProblem(response, HttpStatusCode.UnsupportedMediaType);
        Assert.Equal(0, host.Repository.AddCount);
    }

    [Fact]
    public async Task OpenApiDescribesManuallyReadBodyAndBothPaginationParameters()
    {
        using var host = new TasksHttpHost();
        using var development = host.Api.WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
        using var client = development.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false
        });
        using var response = await client.GetAsync("/openapi/v1.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using JsonDocument json = await ReadJson(response);
        JsonElement route = json.RootElement.GetProperty("paths").GetProperty("/api/tasks");
        JsonElement body = route.GetProperty("post").GetProperty("requestBody");
        Assert.True(body.GetProperty("required").GetBoolean());
        JsonElement schema = body.GetProperty("content").GetProperty("application/json").GetProperty("schema");
        if (schema.TryGetProperty("$ref", out JsonElement reference))
            schema = json.RootElement.GetProperty("components").GetProperty("schemas").GetProperty(reference.GetString()!.Split('/')[^1]);
        Assert.Equal(new[] { "description", "priority", "title" }, schema.GetProperty("properties").EnumerateObject()
            .Select(property => property.Name).Order().ToArray());
        Assert.Equal(new[] { "page", "pageSize" }, route.GetProperty("get").GetProperty("parameters").EnumerateArray()
            .Select(parameter => parameter.GetProperty("name").GetString()).Order().ToArray());
        Assert.True(route.GetProperty("post").GetProperty("responses").TryGetProperty("201", out _));
        Assert.True(route.GetProperty("get").GetProperty("responses").TryGetProperty("200", out _));
    }

    [Fact]
    public async Task PostWithoutBodyReturnsSafe400AfterAuthenticationAndCsrf()
    {
        using var host = new TasksHttpHost();
        using HttpClient client = await host.SignedInClient();
        using var response = await client.PostAsync("/api/tasks", null);
        await AssertProblem(response, HttpStatusCode.BadRequest);
        Assert.Equal(0, host.Repository.AddCount);
    }

    [Theory]
    [InlineData("GET")]
    [InlineData("POST")]
    public async Task CorruptedCookieCannotUseTasks(string method)
    {
        using var host = new TasksHttpHost();
        using var client = host.Api.CreateHttpsClient(prepareCsrf: false);
        client.DefaultRequestHeaders.Add("Cookie", "__Host-TodoApp.Auth=not-a-protected-ticket");
        using var request = new HttpRequestMessage(new HttpMethod(method), "/api/tasks");
        if (method == "POST") request.Content = JsonContent.Create(new { title = "Title" });
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.Equal(0, host.Repository.AddCount + host.Repository.ReadCount);
    }

    [Theory]
    [InlineData("tampered")]
    [InlineData("missing-antiforgery-cookie")]
    [InlineData("other-identity")]
    public async Task InvalidCsrfCannotCreateTaskForAnAuthenticatedUser(string scenario)
    {
        using var host = new TasksHttpHost();
        using HttpClient client = await host.SignedInClient(prepareCsrf: false);
        using var bootstrap = await client.GetAsync("/api/auth/csrf");
        Assert.Equal(HttpStatusCode.NoContent, bootstrap.StatusCode);
        var cookies = bootstrap.Headers.GetValues("Set-Cookie").Select(value => SetCookieHeaderValue.Parse(value)).ToArray();
        string requestToken = cookies.Single(cookie => cookie.Name == CsrfDefaults.RequestCookieName).Value.ToString();
        string authCookie = client.DefaultRequestHeaders.GetValues("Cookie").Single();
        if (scenario == "other-identity") authCookie = host.ProtectedCookie(Guid.NewGuid().ToString(), "other@example.com");
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/tasks")
        {
            Content = JsonContent.Create(new { title = "Title" })
        };
        string pairedCookies = scenario == "missing-antiforgery-cookie" ? "" : "; " + string.Join("; ", cookies.Select(cookie => $"{cookie.Name}={cookie.Value}"));
        request.Headers.Add("Cookie", authCookie + pairedCookies);
        request.Headers.Add(CsrfDefaults.HeaderName, scenario == "tampered" ? "tampered" + requestToken : requestToken);
        using var response = await client.SendAsync(request);
        await AssertProblem(response, HttpStatusCode.BadRequest);
        using JsonDocument json = await ReadJson(response);
        Assert.Equal("csrf_validation_failed", json.RootElement.GetProperty("code").GetString());
        Assert.Equal(0, host.Repository.AddCount);
    }

    [Theory]
    [InlineData("GET")]
    [InlineData("POST")]
    public async Task AnonymousRequestIs401BeforeCsrfOrInputHandling(string method)
    {
        using var host = new TasksHttpHost();
        using var client = host.Api.CreateHttpsClient(prepareCsrf: false);
        using var request = new HttpRequestMessage(new HttpMethod(method), "/api/tasks");
        if (method == "POST") request.Content = new StringContent("{", Encoding.UTF8, "application/json");
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Null(response.Headers.Location);
        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.Equal(0, host.Repository.AddCount + host.Repository.ReadCount);
    }

    [Theory]
    [InlineData(null, "user@example.com")]
    [InlineData("not-a-guid", "user@example.com")]
    [InlineData("00000000-0000-0000-0000-000000000000", "user@example.com")]
    [InlineData("11111111-1111-1111-1111-111111111111", null)]
    public async Task IncompleteProtectedIdentityIs401BeforeCsrf(string? id, string? email)
    {
        using var host = new TasksHttpHost();
        using var client = host.Api.CreateHttpsClient(prepareCsrf: false);
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/tasks");
        request.Headers.Add("Cookie", host.ProtectedCookie(id, email));
        request.Content = JsonContent.Create(new { title = "Title" });
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.Equal(0, host.Repository.AddCount);
    }

    [Fact]
    public async Task ExpiredCookieCannotReadTasks()
    {
        using var host = new TasksHttpHost();
        using HttpClient client = await host.SignedInClient();
        host.Api.Clock.Advance(TimeSpan.FromHours(8) + TimeSpan.FromSeconds(1));
        using var response = await client.GetAsync("/api/tasks");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(0, host.Repository.ReadCount);
    }

    [Fact]
    public async Task AuthenticatedPostWithoutCsrfIsRejectedBeforeSaving()
    {
        using var host = new TasksHttpHost();
        using HttpClient client = await host.SignedInClient(prepareCsrf: false);
        using var response = await client.PostAsJsonAsync("/api/tasks", new { title = "Title" });

        await AssertProblem(response, HttpStatusCode.BadRequest);
        using JsonDocument json = await ReadJson(response);
        Assert.Equal("csrf_validation_failed", json.RootElement.GetProperty("code").GetString());
        Assert.Equal(0, host.Repository.AddCount);
    }

    [Theory]
    [InlineData("", 1, 20)]
    [InlineData("?page=2&pageSize=10", 2, 10)]
    [InlineData("?pageSize=50", 1, 50)]
    [InlineData("?page=2147483647&pageSize=50", int.MaxValue, 50)]
    public async Task GetPassesOwnerAndPaginationAndReturnsEmptyEnvelope(string query, int page, int pageSize)
    {
        using var host = new TasksHttpHost();
        using HttpClient client = await host.SignedInClient(prepareCsrf: false);
        using var response = await client.GetAsync("/api/tasks" + query);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.Equal(host.UserId, host.Repository.ReadOwner);
        Assert.Equal(page, host.Repository.Page);
        Assert.Equal(pageSize, host.Repository.PageSize);
        using JsonDocument json = await ReadJson(response);
        Assert.Empty(json.RootElement.GetProperty("items").EnumerateArray());
        Assert.Equal(0, json.RootElement.GetProperty("totalCount").GetInt32());
        Assert.Equal(page, json.RootElement.GetProperty("page").GetInt32());
        Assert.Equal(pageSize, json.RootElement.GetProperty("pageSize").GetInt32());
    }

    [Fact]
    public async Task GetUsesShortHttpProjectionAndKeepsTotalCount()
    {
        using var host = new TasksHttpHost();
        Guid id = Guid.NewGuid();
        host.Repository.Items = [new TaskListItem(id, "Title", TaskPriority.Low, false, TasksHttpHost.Now, null)];
        host.Repository.TotalCount = 41;
        using HttpClient client = await host.SignedInClient();
        using var response = await client.GetAsync("/api/tasks?page=2&pageSize=20");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using JsonDocument json = await ReadJson(response);
        Assert.Equal(41, json.RootElement.GetProperty("totalCount").GetInt32());
        JsonElement item = Assert.Single(json.RootElement.GetProperty("items").EnumerateArray());
        Assert.Equal(id, item.GetProperty("id").GetGuid());
        Assert.Equal("low", item.GetProperty("priority").GetString());
        Assert.Equal(JsonValueKind.Null, item.GetProperty("completedAt").ValueKind);
        Assert.Equal(6, item.EnumerateObject().Count());
    }

    [Theory]
    [InlineData("?page=", "page")]
    [InlineData("?page=abc", "page")]
    [InlineData("?page=1.5", "page")]
    [InlineData("?page=2147483648", "page")]
    [InlineData("?page=0", "page")]
    [InlineData("?page=-1", "page")]
    [InlineData("?page=1&page=2", "page")]
    [InlineData("?pageSize=", "pageSize")]
    [InlineData("?pageSize=abc", "pageSize")]
    [InlineData("?pageSize=20.0", "pageSize")]
    [InlineData("?pageSize=0", "pageSize")]
    [InlineData("?pageSize=15", "pageSize")]
    [InlineData("?pageSize=2147483648", "pageSize")]
    [InlineData("?pageSize=10&pageSize=10", "pageSize")]
    public async Task InvalidPaginationReturnsFieldErrorWithoutReading(string query, string field)
    {
        using var host = new TasksHttpHost();
        using HttpClient client = await host.SignedInClient();
        using var response = await client.GetAsync("/api/tasks" + query);

        await AssertFieldError(response, field);
        Assert.Equal(0, host.Repository.ReadCount);
    }

    [Theory]
    [InlineData("?userId=someone")]
    [InlineData("?categoryId=someone")]
    [InlineData("?q=text")]
    [InlineData("?status=active")]
    [InlineData("?Page=1")]
    [InlineData("?typo=1")]
    public async Task UnknownQueryParametersAreRejected(string query)
    {
        using var host = new TasksHttpHost();
        using HttpClient client = await host.SignedInClient();
        using var response = await client.GetAsync("/api/tasks" + query);

        await AssertProblem(response, HttpStatusCode.BadRequest);
        Assert.Equal(0, host.Repository.ReadCount);
    }

    [Fact]
    public async Task GetBodyIsRejectedWithoutReadingRepository()
    {
        using var host = new TasksHttpHost();
        using HttpClient client = await host.SignedInClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/tasks")
        {
            Content = JsonContent.Create(new { page = 1 })
        };
        using var response = await client.SendAsync(request);

        await AssertProblem(response, HttpStatusCode.BadRequest);
        Assert.Equal(0, host.Repository.ReadCount);
    }

    [Theory]
    [InlineData("GET", "page")]
    [InlineData("POST", "title")]
    public async Task RepositoryArgumentExceptionRemainsSafe500NotFieldError(string method, string parameterName)
    {
        using var host = new TasksHttpHost();
        host.Repository.Failure = new ArgumentException("PRIVATE-SQL-DETAILS", parameterName);
        using HttpClient client = await host.SignedInClient();
        using var response = method == "POST"
            ? await client.PostAsJsonAsync("/api/tasks", new { title = "Title" })
            : await client.GetAsync("/api/tasks");

        await AssertProblem(response, HttpStatusCode.InternalServerError);
        string body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("PRIVATE-SQL-DETAILS", body);
        Assert.DoesNotContain("ArgumentException", body);
        using JsonDocument json = JsonDocument.Parse(body);
        Assert.False(json.RootElement.TryGetProperty("errors", out _));
    }

    private static Task<HttpResponseMessage> PostJson(HttpClient client, string body) =>
        client.PostAsync("/api/tasks", new StringContent(body, Encoding.UTF8, "application/json"));

    private static async Task<JsonDocument> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync());

    private static async Task AssertProblem(HttpResponseMessage response, HttpStatusCode status)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.True(response.Headers.CacheControl?.NoStore);
        using JsonDocument json = await ReadJson(response);
        Assert.Equal((int)status, json.RootElement.GetProperty("status").GetInt32());
    }

    private static async Task AssertFieldError(HttpResponseMessage response, string field)
    {
        await AssertProblem(response, HttpStatusCode.BadRequest);
        using JsonDocument json = await ReadJson(response);
        Assert.NotEmpty(json.RootElement.GetProperty("errors").GetProperty(field).EnumerateArray());
    }
}
