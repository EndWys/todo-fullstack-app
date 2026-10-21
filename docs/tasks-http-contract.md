# Tasks: HTTP-контракт создания и списка

**Статус:** контракт первого среза принят владельцем; Tasks endpoints, DI и HTTP DTO реализованы и проверены HTTP-тестами. Angular UI задач пока отсутствует, браузерный сценарий не проверялся. Бизнес-правила находятся в [tasks-contract.md](tasks-contract.md), cookie/CSRF — в [auth-contract.md](auth-contract.md).

Текущая реализация: Domain/Application/Infrastructure соединены через DI с `POST /api/tasks` и `GET /api/tasks`. Application использует `ITaskRepository` и `TimeProvider`, возвращает типизированные результаты и ошибки полей без HTTP-статусов. 2026-10-21 миграция применена к локальным TodoAppDev/TodoAppTest. Помимо 14 repository SQL-кейсов добавлены 91 HTTP-кейс с подменой репозитория, проверка DI lifetime и 3 HTTP → SQL Server сценария: сохранение, изоляция пользователей, пагинация. Подробнее — [tasks-persistence.md](tasks-persistence.md).

## 1. Границы первого среза

| Метод и путь | Назначение | Успех |
| --- | --- | --- |
| `POST /api/tasks` | Создать собственную задачу | `201 Created` с созданной задачей |
| `GET /api/tasks?page=1&pageSize=20` | Получить страницу собственных задач | `200 OK` с items и метаданными |

Категорий, поиска, фильтров, изменения состояния, редактирования, удаления и GET конкретной задачи в этом срезе нет. Их контракты согласуются отдельно. Параметров `userId`/`ownerId` нет: пользователь определяется сервером из проверенной cookie-сессии.

## 2. Общие соглашения

- HTTPS, текущая cookie-аутентификация. Оба endpoint требуют действительную идентичность с непустым Guid пользователя; отсутствие/истечение/некорректность сессии — `401`, без HTML redirect.
- POST требует действительную пару antiforgery-cookie и `X-XSRF-TOKEN`. GET не меняет состояние и не требует CSRF-токена. Нет отдельного JWT/Bearer token для Tasks.
- Авторизация выполняется до CSRF-проверки: запрос без сессии получает `401`; запрос с действительной сессией, но неправильным CSRF — `400` с существующим `code: csrf_validation_failed`.
- JSON использует camelCase. Успешные ответы — `application/json`; ответы с ProblemDetails/ValidationProblem — `application/problem+json`. `401` может быть без тела; клиент определяет его по статусу.
- ID — JSON string с Guid. Даты — ISO 8601 в UTC, с `Z` или `+00:00`; точное количество дробных знаков секунд не является контрактом.
- `priority` передаётся строкой: ровно `low`, `normal`, `high`, с учётом регистра. Числовые значения Domain enum не являются HTTP-контрактом.
- Объявленные поля ответа возвращаются всегда; отсутствие optional-значения представлено JSON `null`. `userId`, EF navigation properties и внутренние поля в ответы не входят.
- Ответы Tasks не кэшируются: `Cache-Control: no-store`. Это не заменяет серверную проверку доступа.
- Domain entity не сериализуется напрямую: используются отдельные HTTP request/response DTO и явное отображение приоритетов.

## 3. Создание

```http
POST /api/tasks
Content-Type: application/json
X-XSRF-TOKEN: <request token>
```

```json
{
  "title": "Learn EF Core",
  "description": "Understand entity configuration",
  "priority": "high"
}
```

| Поле | Допустимое значение |
| --- | --- |
| `title` | Обязательная string; после Trim 1–200 Unicode code points, одна строка; null/отсутствие/whitespace-only недопустимы |
| `description` | Необязательная string или null; отсутствие/null/пустое после Trim → null; максимум 2000 code points |
| `priority` | Необязательная string из списка выше; отсутствие → `normal`; явный null/пустая/неизвестная строка/число недопустимы |

Нормализация и допустимость Unicode/управляющих символов соответствуют существующему Domain-контракту. Клиентская валидация не заменяет серверную.

Тело — JSON object. Имена полей точно camelCase; повторяющиеся JSON properties отклоняются, а не выбираются по принципу last wins. Неизвестные поля отклоняются с `400`, в том числе попытки передать `id`, `taskId`, `userId`, `ownerId`, `isCompleted`, `createdAt`, `completedAt`, `categoryId`. Это локальное правило нового Tasks request DTO/reader, не изменение поведения существующего Auth API. Строгая проверка полей помогает обнаружить ошибки клиента; изоляция данных обеспечивается серверным выбором владельца независимо от неё.

После успешного сохранения в БД — `201 Created`:

```json
{
  "id": "9df4f8c8-b67c-4456-b88f-05c7d319991e",
  "title": "Learn EF Core",
  "description": "Understand entity configuration",
  "priority": "high",
  "isCompleted": false,
  "createdAt": "2026-10-21T12:30:00+00:00",
  "completedAt": null
}
```

- Возвращается нормализованное и сохранённое состояние, не копия исходного запроса.
- ID и время назначает backend; задача всегда активна, время завершения — null.
- Одинаковые названия разрешены: `409` для дубликата задачи нет.
- В этом срезе не выдаём `Location` на ещё не реализованный GET `/api/tasks/{id}`. При добавлении чтения конкретной задачи согласовать и добавить такой заголовок. Это осознанное временное отклонение от рекомендации для POST в [RFC 9110 §9.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3); `201` без Location предусмотрен [§15.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.2).
- Нет idempotency key: два отдельных успешных POST могут создать две задачи. При потере ответа клиент не повторяет создание автоматически и не объявляет гарантированный откат; сначала предлагает перечитать список.

## 4. Список

```http
GET /api/tasks?page=1&pageSize=20
```

| Параметр | Правило |
| --- | --- |
| `page` | Положительное целое Int32, начиная с 1; отсутствие → 1 |
| `pageSize` | Только 10, 20 или 50; отсутствие → 20 |

- Явное пустое значение, дробь, нечисловая строка, выход за Int32, ноль/отрицательное значение или недопустимый pageSize → `400 ValidationProblem` с ключом `page`/`pageSize`.
- Повтор одного параметра → `400` с ошибкой соответствующего поля. Неизвестный query-параметр → `400 ProblemDetails`; не игнорируем опечатки или ещё не реализованные фильтры. Имена контрактных query-параметров — `page`, `pageSize`.
- У GET нет request body. На этом шаге принимаются только параметры пагинации, не `q`, `status`, `categoryId` или `userId`.
- Порядок: Active перед Completed, затем createdAt по убыванию, затем ID по возрастанию. Сейчас создание даёт только Active, но правило порядка не меняется при последующем добавлении завершения.
- Ограничение по владельцу применяется и к items, и к totalCount до пагинации. Нельзя сначала получить общую страницу и затем удалить чужие элементы.

Успех — `200 OK`:

```json
{
  "items": [
    {
      "id": "9df4f8c8-b67c-4456-b88f-05c7d319991e",
      "title": "Learn EF Core",
      "priority": "high",
      "isCompleted": false,
      "createdAt": "2026-10-21T12:30:00+00:00",
      "completedAt": null
    }
  ],
  "totalCount": 1,
  "page": 1,
  "pageSize": 20
}
```

- Элемент списка — краткое представление, без description. Полное описание в следующем срезе читается через отдельный GET конкретной задачи; такой endpoint не предполагается уже существующим.
- `totalCount` — количество собственных задач до пагинации. Позже, при фильтрах, это будет количество собственных задач, удовлетворяющих всем условиям.
- `page` и `pageSize` — фактически принятые параметры, включая defaults. Сервер не подменяет page на последнюю существующую страницу.
- Пустой список — `items: []`, `totalCount: 0`, остальные поля присутствуют. Не `204` и не `404`.
- Валидная страница за пределами результатов — `200`, пустой items, реальный totalCount и исходный page. Большой допустимый page не должен приводить к integer overflow и `500` при расчёте offset.
- totalPages клиент вычисляет как `ceil(totalCount / pageSize)`; при нуле задач это 0 страниц результатов, UI остаётся в пустом состоянии с page=1.
- Нет гарантии snapshot между чтением count и items или между страницами при конкурентных изменениях. Сортировка детерминированна для неизменной выборки, но не устраняет смещения offset-пагинации при вставках/изменениях.

## 5. Ошибки

| Статус | Случай |
| --- | --- |
| `400 ValidationProblem` | Семантически некорректные title/description/priority или параметры пагинации |
| `400 ProblemDetails` | Некорректная структура/синтаксис/JSON-типы запроса, неизвестные поля/параметры; отдельно — существующая CSRF-ошибка |
| `401` | Нет действительной пользовательской сессии; форма тела не гарантируется |
| `415` | POST с неподдерживаемым Content-Type |
| `500 ProblemDetails` | Неожиданная техническая ошибка; без SQL, введённых текстов и stack trace |

Для ошибок полей сохраняем подход Auth: `errors` — словарь имён HTTP-полей и массивов безопасных англоязычных сообщений. Пример:

```json
{
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "title": ["Title is required."],
    "priority": ["Priority must be low, normal, or high."]
  }
}
```

`title` верхнего уровня описывает ошибку целиком; `errors.title` относится к полю формы. Дополнительные стандартные поля ProblemDetails могут присутствовать. Клиент не должен определять тип ошибки по точному тексту сообщения. Все ошибки полей не обязаны собираться за один проход; неверные данные никогда не сохраняются частично. Body/JSON type errors могут возвращать общую ошибку без errors отдельных полей.

## 6. HTTP DTO

- `CreateTaskRequest`: title, description, priority; никаких owner/time/state.
- `CreateTaskResponse`: полное представление созданной задачи из §3.
- `TaskListItemResponse`: краткий элемент из §4.
- `GetTasksResponse`: items, totalCount, page, pageSize.

Это transport DTO слоя Api, не Domain entities и не Application commands/results. Общий generic envelope, API-versioning и дополнительные пакеты для двух endpoint сейчас не вводятся. Правила этого документа относятся к согласованному Tasks API; глобальная переработка Auth не входит в срез.

## 7. Детали HTTP-границы и проверки

- POST читает тело через `CreateTaskRequestReader` с локальными System.Text.Json options. OpenAPI request body описан отдельным operation transformer: `Accepts` не используется, поскольку routing-time `415` обходил reader и возвращал пустое тело. Некорректные JSON-типы/Unicode и пустое тело возвращают безопасный `400`, неподдерживаемый media type — `415 ProblemDetails`.
- GET использует `[AsParameters] GetTasksRequest` с nullable string-полями. Reader явно проверяет повторения и формат Int32; Application проверяет диапазон и разрешённые размеры. Это сохраняет field ProblemDetails вместо раннего пустого `400` от встроенного int binding. OpenAPI показывает оба query-параметра с описанием числовых правил.
- Cookie validation отклоняет ticket без непустого Guid/Email до authorization и CSRF. Это проверка структуры подписанной identity, не проверка существования аккаунта в БД.
- `TasksNoStoreMiddleware` добавляет `no-store` через `OnStarting`, в том числе для `401`, CSRF `400` и технических `500`.
- HTTP-тесты запускают настоящий ASP.NET Core pipeline. Только `TaskPersistenceEndpointTests` и существующие repository-тесты используют SQL Server; остальные Tasks HTTP/DI проверки обходятся без БД. Полный backend-прогон и ограничения описаны в [tasks-persistence.md](tasks-persistence.md).
