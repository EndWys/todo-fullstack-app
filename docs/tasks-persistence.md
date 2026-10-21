# Tasks: EF Core, репозиторий и подготовленная миграция

## Статус и границы

Реализованы `Infrastructure/Features/Tasks/Persistence/TaskRepository.cs`, `TodoTaskConfiguration.cs` и `AppDbContext.Tasks`. Подготовлены `20261021153632_AddTodoTasks` и [SQL-скрипт](../backend/src/TodoApp.Infrastructure/Persistence/Migrations/Scripts/AddTodoTasks.sql). Миграция не применялась ни к рабочей, ни к тестовой БД. Tasks API/DI/UI не добавлялись.

Это продолжение [принятого HTTP-контракта](tasks-http-contract.md), не доказательство готовности полного full-stack среза.

## Mapping

- Таблица `Tasks`, PK `TaskId`, ID генерирует Domain, не SQL Server.
- FK `UserId` → `Users.UserId`, без навигационных коллекций в Domain и без каскадного удаления при удалении пользователя. SQL Server использует NO ACTION.
- Title — обязательный nvarchar(400), Description — nullable nvarchar(4000). Это вместимость в UTF-16, а не увеличение бизнес-лимитов 200/2000 code points.
- Priority хранится как int с CHECK на 0/1/2. HTTP-значения low/normal/high остаются отдельным API mapping.
- CreatedAt и nullable CompletedAt — datetimeoffset(7). CHECK гарантирует отсутствие CompletedAt у активной задачи и наличие у выполненной; он не проверяет показания серверных часов.
- Индекс `(UserId ASC, IsCompleted ASC, CreatedAt DESC, TaskId ASC)` соответствует owner scope и согласованному порядку списка. Дубликаты названия разрешены.
- Domain проверяет текст; SQL-схема не повторяет все Unicode/normalization-правила.

## Repository

`AddAsync` добавляет сущность и ожидает SaveChangesAsync; не переводит ошибки БД в ошибки пользовательского ввода.

`GetPageAsync` создаёт общий AsNoTracking query с условием UserId, считает собственные задачи и получает страницу через OrderBy/Skip/Take/Select. В SQL-проекцию списка не входит описание. EF entities для списка не материализуются и не отслеживаются.

Offset рассчитывается в long. Если он уже за totalCount, возвращаются пустые items с исходным page и настоящим count; иначе преобразование к int безопасно, так как offset < totalCount (Int32). Count и items не являются транзакционным snapshot; см. пункт 22 [engineering-followups.md](engineering-followups.md).

## Что сгенерировано

Из каталога `backend` выполнены только команды подготовки:

```powershell
dotnet ef migrations add AddTodoTasks --project src/TodoApp.Infrastructure --startup-project src/TodoApp.Api --context AppDbContext --output-dir Persistence/Migrations -- --environment Development

dotnet ef migrations script InitialUsers AddTodoTasks --project src/TodoApp.Infrastructure --startup-project src/TodoApp.Api --context AppDbContext --output src/TodoApp.Infrastructure/Persistence/Migrations/Scripts/AddTodoTasks.sql -- --environment Development
```

Up создаёт Tasks, ограничения и индекс; не изменяет Users и не удаляет существующие данные. Down удаляет Tasks вместе с данными при явном откате — его не выполняли.

SQL-скрипт — переход именно от InitialUsers к AddTodoTasks, не idempotent-скрипт и не первоначальное создание всей базы. В нём нет USE или машинной connection string: перед выполнением нужно отдельно проверить целевую базу и текущее состояние миграций. Наличие SQL-файла/записи snapshot не означает его выполнение.

Применение миграции — следующий отдельно согласуемый шаг после review. Автоматического Migrate/EnsureCreated в приложении или новых тестах нет.

## Проверки

Без подключения к SQL Server проверяются mapping, FK/DeleteBehavior, Unicode-ёмкость, индекс, CHECK metadata, соответствие snapshot текущей модели, операции Up и защитные проверки репозитория:

```powershell
dotnet test tests/TodoApp.Infrastructure.Tests
```

Подготовлены 14 SQL Server integration-кейсов в `TodoApp.IntegrationTests/Tasks/TaskRepositoryTests.cs`: сохранение и чтение через EF, максимальные emoji-строки, nullable/default поля и дубликаты названия, размеры/страницы, изоляция items/count, пустая/очень большая страница, сортировка и Guid tie-breaker, FK и CHECK constraints.

**Они пока не запускались.** Для запуска сначала отдельно применить проверенную миграцию к выделенной TodoAppTest и настроить TODOAPP_TEST_CONNECTION_STRING. Все новые SQL-тесты получают context только через существующий TestDatabase.CreateDbContext и откатывают свои транзакции; не создают/удаляют БД и не применяют миграции:

```powershell
dotnet test tests/TodoApp.IntegrationTests --filter FullyQualifiedName~TodoApp.IntegrationTests.Tasks.TaskRepositoryTests
```

Model/guard-тесты и генерация SQL не доказывают фактическое исполнение команд SQL Server, применение миграции или работоспособность будущего HTTP-сценария.
