using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TodoApp.Domain.Features.Auth;
using TodoApp.Domain.Features.Tasks;
using TodoApp.IntegrationTests.Auth;

namespace TodoApp.IntegrationTests.Tasks;

// These tests use the real API, password hasher, cookie/CSRF middleware and SQL Server.
public sealed class TaskPersistenceEndpointTests
{
    private const string Password = "correct horse battery staple";

    [Fact]
    public async Task CreatePersistsNormalizedTaskAndGetReadsItInANewRequest()
    {
        string email = NewEmail();
        using var factory = new TestApiFactory();
        using HttpClient client = factory.CreateSafeClient();
        try
        {
            Guid userId = await RegisterAndLogin(client, email);
            DateTimeOffset before = DateTimeOffset.UtcNow;
            using var response = await client.PostAsJsonAsync("/api/tasks", new
            {
                title = "  Learn EF Core 😀  ", description = "  First\nSecond  ", priority = "high"
            });
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            Assert.True(response.Headers.CacheControl?.NoStore);
            Assert.Null(response.Headers.Location);
            using JsonDocument created = await ReadJson(response);
            Guid id = created.RootElement.GetProperty("id").GetGuid();
            Assert.Equal(7, created.RootElement.EnumerateObject().Count());
            Assert.Equal("Learn EF Core 😀", created.RootElement.GetProperty("title").GetString());
            Assert.Equal("First\nSecond", created.RootElement.GetProperty("description").GetString());
            Assert.Equal("high", created.RootElement.GetProperty("priority").GetString());
            Assert.False(created.RootElement.GetProperty("isCompleted").GetBoolean());
            Assert.Equal(JsonValueKind.Null, created.RootElement.GetProperty("completedAt").ValueKind);

            await using (var db = TestDatabase.CreateDbContext())
            {
                TodoTask saved = await db.Tasks.AsNoTracking().SingleAsync(task => task.TaskId == id);
                Assert.Equal(userId, saved.UserId);
                Assert.Equal("Learn EF Core 😀", saved.Title);
                Assert.Equal("First\nSecond", saved.Description);
                Assert.Equal(TaskPriority.High, saved.Priority);
                Assert.Equal(created.RootElement.GetProperty("createdAt").GetDateTimeOffset(), saved.CreatedAt);
                Assert.InRange(saved.CreatedAt, before, DateTimeOffset.UtcNow);
            }

            using var list = await client.GetAsync("/api/tasks");
            Assert.Equal(HttpStatusCode.OK, list.StatusCode);
            Assert.True(list.Headers.CacheControl?.NoStore);
            using JsonDocument page = await ReadJson(list);
            JsonElement item = Assert.Single(page.RootElement.GetProperty("items").EnumerateArray());
            Assert.Equal(id, item.GetProperty("id").GetGuid());
            Assert.Equal(6, item.EnumerateObject().Count());
            Assert.Equal(1, page.RootElement.GetProperty("totalCount").GetInt32());
            Assert.Equal(1, page.RootElement.GetProperty("page").GetInt32());
            Assert.Equal(20, page.RootElement.GetProperty("pageSize").GetInt32());
        }
        finally { await DeleteTestUsers(email); }
    }

    [Fact]
    public async Task TwoCookieSessionsSeeOnlyTheirOwnItemsAndCounts()
    {
        string firstEmail = NewEmail();
        string secondEmail = NewEmail();
        using var factory = new TestApiFactory();
        using HttpClient first = factory.CreateSafeClient();
        using HttpClient second = factory.CreateSafeClient();
        try
        {
            await RegisterAndLogin(first, firstEmail);
            Guid secondId = await RegisterAndLogin(second, secondEmail);
            Guid firstTask = await Create(first, "First task");
            Guid nextTask = await Create(first, "Next task");
            Guid secondTask = await Create(second, "Other owner's task");

            using var firstResponse = await first.GetAsync("/api/tasks");
            using var secondResponse = await second.GetAsync("/api/tasks");
            Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
            Assert.Equal(HttpStatusCode.OK, secondResponse.StatusCode);
            using JsonDocument firstPage = await ReadJson(firstResponse);
            using JsonDocument secondPage = await ReadJson(secondResponse);
            Assert.Equal(2, firstPage.RootElement.GetProperty("totalCount").GetInt32());
            Assert.Equal(1, secondPage.RootElement.GetProperty("totalCount").GetInt32());
            Guid[] firstIds = firstPage.RootElement.GetProperty("items").EnumerateArray()
                .Select(item => item.GetProperty("id").GetGuid()).ToArray();
            Assert.Equal(new[] { nextTask, firstTask }, firstIds);
            Assert.Equal(secondTask, Assert.Single(secondPage.RootElement.GetProperty("items").EnumerateArray()).GetProperty("id").GetGuid());

            using var spoofedPost = await first.PostAsJsonAsync("/api/tasks", new { title = "Spoof", userId = secondId });
            using var spoofedGet = await first.GetAsync($"/api/tasks?userId={secondId}");
            Assert.Equal(HttpStatusCode.BadRequest, spoofedPost.StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, spoofedGet.StatusCode);
            await using var db = TestDatabase.CreateDbContext();
            Assert.Equal(1, await db.Tasks.CountAsync(task => task.UserId == secondId));
        }
        finally { await DeleteTestUsers(firstEmail, secondEmail); }
    }

    [Fact]
    public async Task HttpPaginationReturnsRealCountAndDoesNotClampOutOfRangePage()
    {
        string email = NewEmail();
        using var factory = new TestApiFactory();
        using HttpClient client = factory.CreateSafeClient();
        try
        {
            Guid userId = await RegisterAndLogin(client, email);
            DateTimeOffset start = DateTimeOffset.UtcNow.AddDays(-1);
            await using (var db = TestDatabase.CreateDbContext())
            {
                db.Tasks.AddRange(Enumerable.Range(0, 12).Select(index =>
                    TodoTask.Create(userId, $"Task {index}", start.AddMinutes(index))));
                await db.SaveChangesAsync();
            }

            using var response = await client.GetAsync("/api/tasks?page=2&pageSize=10");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            using JsonDocument page = await ReadJson(response);
            Assert.Equal(12, page.RootElement.GetProperty("totalCount").GetInt32());
            Assert.Equal(2, page.RootElement.GetProperty("page").GetInt32());
            Assert.Equal(10, page.RootElement.GetProperty("pageSize").GetInt32());
            Assert.Equal(new[] { "Task 1", "Task 0" }, page.RootElement.GetProperty("items").EnumerateArray()
                .Select(item => item.GetProperty("title").GetString()).ToArray());

            using var beyond = await client.GetAsync("/api/tasks?page=2147483647&pageSize=50");
            Assert.Equal(HttpStatusCode.OK, beyond.StatusCode);
            using JsonDocument emptyPage = await ReadJson(beyond);
            Assert.Empty(emptyPage.RootElement.GetProperty("items").EnumerateArray());
            Assert.Equal(12, emptyPage.RootElement.GetProperty("totalCount").GetInt32());
            Assert.Equal(int.MaxValue, emptyPage.RootElement.GetProperty("page").GetInt32());
        }
        finally { await DeleteTestUsers(email); }
    }

    private static string NewEmail() => $"tasks-http-{Guid.NewGuid():N}@example.com";

    private static async Task<Guid> RegisterAndLogin(HttpClient client, string email)
    {
        using var register = await client.PostAsJsonAsync("/api/auth/register", new { email, password = Password });
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);
        using JsonDocument user = await ReadJson(register);
        using var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        return user.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> Create(HttpClient client, string title)
    {
        using var response = await client.PostAsJsonAsync("/api/tasks", new { title });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using JsonDocument json = await ReadJson(response);
        return json.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<JsonDocument> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync());

    private static async Task DeleteTestUsers(params string[] emails)
    {
        await using var db = TestDatabase.CreateDbContext();
        foreach (string email in emails)
        {
            Email address = Email.Create(email);
            Guid? id = await db.Users.Where(user => user.Email == address).Select(user => (Guid?)user.UserId).SingleOrDefaultAsync();
            if (id is null) continue;
            // FK is NO ACTION: remove only this test's tasks before its uniquely named account.
            await db.Tasks.Where(task => task.UserId == id.Value).ExecuteDeleteAsync();
            await db.Users.Where(user => user.UserId == id.Value).ExecuteDeleteAsync();
        }
    }
}
