BEGIN TRANSACTION;
CREATE TABLE [Tasks] (
    [TaskId] uniqueidentifier NOT NULL,
    [UserId] uniqueidentifier NOT NULL,
    [Title] nvarchar(400) NOT NULL,
    [Description] nvarchar(4000) NULL,
    [Priority] int NOT NULL,
    [IsCompleted] bit NOT NULL,
    [CreatedAt] datetimeoffset(7) NOT NULL,
    [CompletedAt] datetimeoffset(7) NULL,
    CONSTRAINT [PK_Tasks] PRIMARY KEY ([TaskId]),
    CONSTRAINT [CK_Tasks_CompletionState] CHECK (([IsCompleted] = 0 AND [CompletedAt] IS NULL) OR ([IsCompleted] = 1 AND [CompletedAt] IS NOT NULL)),
    CONSTRAINT [CK_Tasks_Priority] CHECK ([Priority] IN (0, 1, 2)),
    CONSTRAINT [FK_Tasks_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([UserId])
);

CREATE INDEX [IX_Tasks_UserId_IsCompleted_CreatedAt_TaskId] ON [Tasks] ([UserId], [IsCompleted], [CreatedAt] DESC, [TaskId]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20261021153632_AddTodoTasks', N'10.0.12');

COMMIT;
GO
