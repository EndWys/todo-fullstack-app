using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using TodoApp.Domain.Features.Auth;
using TodoApp.Domain.Features.Tasks;
using TodoApp.Infrastructure.Persistence;
using TodoApp.Infrastructure.Persistence.Migrations;

namespace TodoApp.Infrastructure.Tests.Features.Tasks.Persistence;

public sealed class TodoTaskConfigurationTests
{
    [Fact]
    public void ModelMapsIdentityAndUnicodeCapacityWithoutConnectingToSqlServer()
    {
        using var context = CreateModelContext();
        IEntityType entity = GetTaskEntity(context);

        Assert.Equal("Tasks", entity.GetTableName());
        Assert.Equal(nameof(TodoTask.TaskId), Assert.Single(entity.FindPrimaryKey()!.Properties).Name);
        Assert.Equal(ValueGenerated.Never, entity.FindProperty(nameof(TodoTask.TaskId))!.ValueGenerated);
        IProperty title = entity.FindProperty(nameof(TodoTask.Title))!;
        Assert.False(title.IsNullable);
        Assert.True(title.IsUnicode());
        Assert.Equal(400, title.GetMaxLength());
        IProperty description = entity.FindProperty(nameof(TodoTask.Description))!;
        Assert.True(description.IsNullable);
        Assert.True(description.IsUnicode());
        Assert.Equal(4000, description.GetMaxLength());
    }

    [Fact]
    public void ModelStoresPriorityAsIntAndDatesWithExplicitPrecision()
    {
        using var context = CreateModelContext();
        IEntityType entity = GetTaskEntity(context);

        Assert.Equal(typeof(int), entity.FindProperty(nameof(TodoTask.Priority))!.GetProviderClrType());
        Assert.False(entity.FindProperty(nameof(TodoTask.CreatedAt))!.IsNullable);
        Assert.Equal(7, entity.FindProperty(nameof(TodoTask.CreatedAt))!.GetPrecision());
        Assert.True(entity.FindProperty(nameof(TodoTask.CompletedAt))!.IsNullable);
        Assert.Equal(7, entity.FindProperty(nameof(TodoTask.CompletedAt))!.GetPrecision());
    }

    [Fact]
    public void OwnerForeignKeyIsRequiredAndDoesNotCascadeDeletion()
    {
        using var context = CreateModelContext();
        IForeignKey relationship = Assert.Single(GetTaskEntity(context).GetForeignKeys());

        Assert.Equal(typeof(User), relationship.PrincipalEntityType.ClrType);
        Assert.Equal(nameof(TodoTask.UserId), Assert.Single(relationship.Properties).Name);
        Assert.True(relationship.IsRequired);
        Assert.Equal(DeleteBehavior.NoAction, relationship.DeleteBehavior);
    }

    [Fact]
    public void IndexMatchesOwnerScopeAndStableListOrdering()
    {
        using var context = CreateModelContext();
        IIndex index = Assert.Single(GetTaskEntity(context).GetIndexes());

        Assert.Equal(new[] { "UserId", "IsCompleted", "CreatedAt", "TaskId" },
            index.Properties.Select(property => property.Name));
        Assert.Equal(new[] { false, false, true, false }, index.IsDescending);
        Assert.False(index.IsUnique);
    }

    [Fact]
    public void CheckConstraintsProtectPriorityAndCompletionConsistency()
    {
        using var context = CreateModelContext();
        ICheckConstraint[] checks = GetTaskEntity(context).GetCheckConstraints().ToArray();

        Assert.Equal(2, checks.Length);
        Assert.Contains(checks, check => check.Name == "CK_Tasks_Priority" && check.Sql == "[Priority] IN (0, 1, 2)");
        Assert.Contains(checks, check => check.Name == "CK_Tasks_CompletionState"
            && check.Sql.Contains("[CompletedAt] IS NULL") && check.Sql.Contains("[CompletedAt] IS NOT NULL"));
    }

    [Fact]
    public void MigrationSnapshotMatchesCurrentModelWithoutConnectingToSqlServer()
    {
        using var context = CreateModelContext();

        Assert.False(context.Database.HasPendingModelChanges());
    }

    [Fact]
    public void MigrationOnlyAddsTasksTableAndItsIndex()
    {
        var migration = new AddTodoTasks();
        Assert.Equal(2, migration.UpOperations.Count);
        CreateTableOperation table = Assert.IsType<CreateTableOperation>(migration.UpOperations[0]);
        Assert.Equal("Tasks", table.Name);
        Assert.Equal(2, table.CheckConstraints.Count);
        AddForeignKeyOperation foreignKey = Assert.Single(table.ForeignKeys);
        Assert.Equal("Users", foreignKey.PrincipalTable);
        Assert.Equal(ReferentialAction.NoAction, foreignKey.OnDelete);
        Assert.Equal("Tasks", Assert.IsType<CreateIndexOperation>(migration.UpOperations[1]).Table);
    }

    private static AppDbContext CreateModelContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer().Options);

    private static IEntityType GetTaskEntity(AppDbContext context) =>
        context.GetService<IDesignTimeModel>().Model.FindEntityType(typeof(TodoTask))!;
}
