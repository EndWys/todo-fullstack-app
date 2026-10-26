# Tasks: EF Core, репозиторий и проверенная миграция

## Статус и границы

Реализованы `Infrastructure/Features/Tasks/Persistence/TaskRepository.cs`, `TodoTaskConfiguration.cs` и `AppDbContext.Tasks`. Подготовлены `20261021153632_AddTodoTasks` и [SQL-скрипт](../backend/src/TodoApp.Infrastructure/Persistence/Migrations/Scripts/AddTodoTasks.sql). После явного разрешения владельца 2026-10-21 миграция применена к локальным TodoAppDev и TodoAppTest; SQL Server integration-тесты прошли. Следующими шагами добавлены Tasks API/DI, HTTP-тесты и Angular-чтение первой страницы; UI создания ещё отсутствует. Новых изменений схемы для HTTP/frontend-шагов не потребовалось.

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

Из каталога `backend` выполнены команды подготовки:

```powershell
dotnet ef migrations add AddTodoTasks --project src/TodoApp.Infrastructure --startup-project src/TodoApp.Api --context AppDbContext --output-dir Persistence/Migrations -- --environment Development

dotnet ef migrations script InitialUsers AddTodoTasks --project src/TodoApp.Infrastructure --startup-project src/TodoApp.Api --context AppDbContext --output src/TodoApp.Infrastructure/Persistence/Migrations/Scripts/AddTodoTasks.sql -- --environment Development
```

Up создаёт Tasks, ограничения и индекс; не изменяет Users и не удаляет существующие данные. Down удаляет Tasks вместе с данными при явном откате — его не выполняли.

SQL-скрипт — переход именно от InitialUsers к AddTodoTasks, не idempotent-скрипт и не первоначальное создание всей базы. В нём нет USE или машинной connection string: перед выполнением нужно отдельно проверить целевую базу и текущее состояние миграций. Наличие SQL-файла/записи snapshot не означает его выполнение.

## Проверка и применение 2026-10-21

После review Up/SQL и явного разрешения владельца выполнены следующие действия:

1. Подключения разрешены из Development-конфигурации/user secrets и TODOAPP_TEST_CONNECTION_STRING без вывода их значений. Проверены локальный сервер и конкретные базы TodoAppDev/TodoAppTest; не использовалась рабочая база для тестов.
2. Перед применением в обеих базах была только InitialUsers, таблица Tasks отсутствовала. В TodoAppDev было 5 пользователей, в TodoAppTest — 0.
3. `dotnet ef migrations has-pending-model-changes` подтвердил соответствие текущей модели миграции.
4. Через EF CLI выполнен `database update 20261021153632_AddTodoTasks` отдельно для каждой базы. Для TodoAppTest в процессе CLI временно задавался ConnectionStrings__TodoApp из TODOAPP_TEST_CONNECTION_STRING; user secrets и постоянные настройки не менялись.
5. После применения проверены история миграций, включённые/trusted CHECK constraints, FK с NO_ACTION, состав/направления индекса и ёмкость nvarchar-колонок. Down и ручной SQL-скрипт не выполнялись.
6. После тестов в TodoAppDev осталось 5 пользователей и 0 задач, в TodoAppTest — 0 пользователей и 0 задач.

Это подтверждение состояния проверенных локальных баз на указанную дату, не утверждение о любой другой установке. Автоматического Migrate/EnsureCreated в приложении или тестах нет.

## Проверки

Без подключения к SQL Server проверяются mapping, FK/DeleteBehavior, Unicode-ёмкость, индекс, CHECK metadata, соответствие snapshot текущей модели, операции Up и защитные проверки репозитория:

```powershell
dotnet test tests/TodoApp.Infrastructure.Tests
```

Выполнены 14 SQL Server integration-кейсов в `TodoApp.IntegrationTests/Tasks/TaskRepositoryTests.cs`: сохранение и чтение через EF, максимальные emoji-строки, nullable/default поля и дубликаты названия, размеры/страницы, изоляция items/count, пустая/очень большая страница, сортировка и Guid tie-breaker, FK и CHECK constraints. Все 14 прошли без исправления кода.

Для повторного запуска нужна выделенная TodoAppTest с применённой AddTodoTasks и настроенной TODOAPP_TEST_CONNECTION_STRING. Repository SQL-тесты получают context только через существующий TestDatabase.CreateDbContext и откатывают свои транзакции; не создают/удаляют БД и не применяют миграции:

```powershell
dotnet test tests/TodoApp.IntegrationTests --filter FullyQualifiedName~TodoApp.IntegrationTests.Tasks.TaskRepositoryTests
```

Полный `dotnet test TodoApp.sln --no-restore` также прошёл: Domain 230/230, Application 119/119, Infrastructure 23/23, Integration 83/83, всего 455/455. Сохраняются ранее зафиксированные NU1902/NU1903 для System.Security.Cryptography.Pkcs 9.0.11.

### Дополнение: HTTP → SQL Server

`TaskPersistenceEndpointTests` дополнительно проверяет POST с чтением сохранённой записи новым context, GET после создания, отдельные cookie-сессии двух пользователей с изоляцией items/count, отклонение подмены userId и серверную пагинацию. Регистрация и login выполняются по настоящему HTTP pipeline, включая хеширование и CSRF. TestApiFactory проверяет целевую TodoAppTest до первого запроса; все прямые EF-подключения проходят через TestDatabase.CreateDbContext.

Эти HTTP-тесты не используют одну общую транзакцию для нескольких запросов: они сохраняют собственные строки и в finally удаляют только задачи и пользователей с уникальными email данного теста. Сначала удаляются Tasks, затем Users из-за FK NoAction. Dev-база не используется, DDL/миграции не выполняются. Проверки HTTP не заменяют будущую проверку браузерного Angular-сценария.

После HTTP-шага полный `dotnet test TodoApp.sln --no-restore` прошёл: Domain 230/230, Application 119/119, Infrastructure 23/23, Integration 178/178, всего **550/550**. Из 95 новых проверок 91 относится к HTTP-контракту без БД, одна — к DI, три — к HTTP → SQL Server. Существующие 14 Tasks repository SQL-кейсов и Auth-регрессии также прошли. Прямой read-only запрос после прогона подтвердил 0 Users / 0 Tasks в TodoAppTest. Сохраняются ранее известные NU1902/NU1903; зависимости в этом шаге не менялись.

Повторный запуск Tasks-проверок из `backend`:

```powershell
dotnet test tests/TodoApp.IntegrationTests --filter FullyQualifiedName~TodoApp.IntegrationTests.Tasks
```
