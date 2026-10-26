# Angular Tasks: маршрут, доступ и список

## Status 2026-10-26

The lazy `/tasks` page includes navigation, access guard, session-expiry handling, first-page GET, and a separate item component. Creation is now implemented with a Signal Form, shared CSRF bootstrap, validated POST, field/unconfirmed errors, and post-success list refresh. Loading/empty/error and explicit refresh/retry remain. Pagination controls, editing, search, and categories are not implemented. See [creation flow and verification](task-creation-frontend.md). The backend contract is unchanged; the full first slice still needs pagination UI and manual live acceptance.

## Разделение ответственности

### Имена файлов

На стадии именования файлов Tasks используется явная схема «назначение + роль»: `task-list-page.component.ts` — страница списка, `task-list-item.component.ts` — запись списка, `task-list-data.service.ts` — данные и состояние чтения, `task-list-response.parser.ts` — разбор ответа API, `task-list.models.ts` — группа моделей. Шаблон имеет ту же основу имени, что компонент; тесты — имя проверяемого файла с `.spec.ts`. Все тесты Tasks и их helpers находятся в `testing/`, включая `testing/task-list.test-data.ts`.

Это локальная конвенция Tasks, выбранная владельцем для явного обозначения роли файла; Auth пока не переименовывается. После стадии файлов согласованы классы `TaskListPageComponent`, `TaskListItemComponent`, `TaskListDataService` и селекторы `app-task-list-page` / `app-task-list-item`. `TaskListPageData` обозначает данные страницы списка, а не Angular-компонент; `TaskListLoadState` — состояние её загрузки. Описательные `TaskSummary` и `TaskPriority` сохранены.

На стадии методов/полей/переменных используются `authSession`, `taskListDataService`, `pageHeadingElement`, `focusPageHeading()` и `reloadTaskList()`. Сервис предоставляет `taskListLoadState`, хранит `taskListResource` и использует существующий объект запроса под именем `INITIAL_TASK_LIST_REQUEST`. В ready-состоянии поле `pageData` содержит данные, тогда как `page` внутри них остаётся номером страницы по контракту. Страница держит зависимости `authSession` и `taskListDataService` private, а шаблону предоставляет protected-ссылки на readonly signals `authenticatedUser` и `taskListLoadState`. Шаблон читает их в локальные `currentAuthenticatedUser` / `currentTaskListLoadState` и использует `pageData`, `visibleTaskCount`, `taskSummary`; карточка принимает `[taskSummary]` и вычисляет `priorityDisplayLabel`. Парсер называется `parseTaskListResponse()`, тестовые данные — `sampleTaskSummary` / `createTaskListPageTestData()`. Правила и HTTP-поля сохранены.

### Граница страницы и сервисов

HTML не обращается к сервисам напрямую: читает два сигнала страницы и вызывает её `reloadTaskList()`. Это ссылки на существующие сигналы, а не копии значений; отдельные writable signals, computed-обёртки и effect для синхронизации не нужны. Страница по-прежнему отвечает за UI/фокус и делегирует reload сервису; component-scoped provider и HTTP-поведение сохранены.

`TaskListLoadState` экспортируется из `task-list.models.ts`: это общий тип состояния отображения, не HTTP DTO. Сервис вычисляет его, а тестовые подстановки используют `signal<TaskListLoadState>()` и readonly-доступ. `satisfies Pick<TaskListDataService, 'taskListLoadState' | 'reloadTaskList'>` проверяет используемую часть публичного интерфейса без нового service interface или приведения типов. Это проверка компилятора, а не runtime-валидация HTTP. Разделение короткого сервиса на API + Store, вынос helpers парсера и изменение Auth не выполнялись.

### Каталоги — максимум один уровень ниже Tasks

`task-list-page/` содержит страницу (TS/HTML), сервис списка и parser; `task-list-item/` — компонент карточки и его HTML. Общие `task-list.models.ts` и `task-list-pagination.constants.ts` остаются в корне Tasks. Все `.spec.ts` этой фичи и общие тестовые данные находятся в `testing/`, без вложенных папок. Application tests keep their existing locations. Auth specs now live in Auth's own `testing/` directory following stage 2.1 of its refactoring.

Это явная локальная конвенция владельца: тесты сгруппированы отдельно, чтобы не мешать чтению рабочего кода. Она отличается от [рекомендации Angular держать unit-тесты рядом с проверяемым кодом](https://angular.dev/style-guide#group-closely-related-files-together-in-the-same-directory), но не требует изменения test runner: существующие glob-шаблоны уже включают `src/**/*.spec.ts`. Production-файлы не импортируют `testing/`; `templateUrl` остаются относительными к своим TS-файлам. Имена классов, селекторы, component-scoped DI, проверки и assertions при переносе не меняются.

### Константы пагинации и проверки ответа

`task-list-pagination.constants.ts` — единый источник `DEFAULT_TASK_PAGE_SIZE = 20` и `FIRST_TASK_PAGE = 1`. Запрос, проверка ожидаемых метаданных и helper клиентских тестовых данных импортируют их. `SUPPORTED_TASK_PAGE_SIZES` содержит `[10, DEFAULT_TASK_PAGE_SIZE, 50]`; type guard получает union допустимых значений из этого массива, без второго определения `20`. Шаблон показывает фактический `pageData.pageSize`, а не отдельную UI-константу. Явные числа в assertions и HTTP fixtures тестов служат независимыми ожидаемыми значениями контракта, не настройками приложения.

Таймаут `TASK_LIST_REQUEST_TIMEOUT_MS` остаётся локальным сервису; HTTP `200` обозначен `HttpStatusCode.Ok`. Предел `MAX_INT32`, `EMPTY_TASK_ID`, `TASK_ID_PATTERN` и `UTC_TIMESTAMP_PATTERN` остаются локальными парсеру. Значения и regex сохранены; однофайловые детали не вынесены в глобальный constants-файл. Проверки пагинации разделены по объектам: `testing/task-list-pagination.constants.spec.ts` — согласованные defaults/размеры, `testing/task-list-data.service.spec.ts` — default-запрос и соответствие метаданных ответа, `testing/task-list-response.parser.spec.ts` — допустимые/недопустимые размеры, `testing/task-list-page.component.spec.ts` — вывод размера из данных (50 вместо фиксированного 20). Прежний смешанный `task-list-pagination.spec.ts` удалён после переноса всех проверок. Это не UI управления пагинацией.

### Тестовые данные HTTP и клиентской модели

`testing/task-list.test-data.ts` содержит два независимых helper-а: `createTaskListHttpResponseTestData()` возвращает HTTP-форму с `items`, а `createTaskListPageTestData()` — клиентскую модель с `tasks`. Все mock HTTP responses и входы парсера используют первый; второй подходит для прямых проверок клиентской модели и теста, запрещающего принимать её как HTTP-ответ. HTTP helper имеет отдельный тестовый тип, не изменяющий public API или production-модели. Проверки в `testing/task-list.test-data.spec.ts` фиксируют отсутствие чужого поля в каждой форме. Парсер и backend-контракт не менялись: исправлены тесты, а не ослаблена runtime-валидация.

- `frontend/src/app/app.routes.ts`: `/` → `/tasks`, `canActivate: [authGuard]`, lazy import TaskListPageComponent, заголовок документа.
- `features/tasks/task-list-page/task-list-page.component.ts` / `task-list-page.component.html`: standalone-страница, состояния отображения, нативные ul/li, @for с track taskSummary.id, ссылка на account view и кнопка refresh/retry. После открытия/нажатия refresh фокусирует h1; HTTP-вызовов в компоненте нет.
- `features/tasks/task-list-item/task-list-item.component.ts`: один класс компонента, экземпляр на каждый элемент. Получает readonly TaskSummary через input.required, вычисляет подпись приоритета и подключает отдельный шаблон `task-list-item.component.html` через templateUrl. Шаблон выводит название как textContent, приоритет/статус текстом и даты через DatePipe/time. Компонент не выполняет запросов и не изменяет данные; не показывает фиктивные кнопки завершения/удаления.
- `features/tasks/task-list-page/task-list-data.service.ts`: @Service({autoProvided: false}) с provider на TaskListPageComponent. Один httpResource отвечает за чтение страницы и runtime parse, computed отдаёт только idle/loading/error/ready. Нет singleton-кеша списка; destroy страницы отменяет pending request. Отсутствие/смена подтверждённой identity отключает/перезапускает чтение, данные предыдущего пользователя скрываются.
- `features/tasks/task-list.models.ts` и `task-list-page/task-list-response.parser.ts`: readonly клиентские модели и проверка unknown HTTP JSON перед отображением; парсер преобразует `items` в `tasks`. Проверяются поля, известные приоритеты, числовые метаданные, UTC timestamps и уникальные IDs для keyed rendering. В результат копируются только публичные поля, без description/userId. Это boundary-проверка ответа, не копия Domain-правил создания. Count/items не считаются транзакционно согласованным snapshot.
- `features/auth/auth.guard.ts`: ожидает `AuthSessionService.restoreSession(true)`, пропускает только подтверждённого пользователя при отсутствии auth-operation. Возвращает UrlTree на login, а не запускает вторую навигацию вручную.
- `features/auth/auth-session.service.ts`: signals состояния и локальная revision. Начало и завершение auth-операции меняют revision; expireSessionIfCurrent отклоняет устаревшее уведомление `401` и не перезаписывает pending operation.
- `features/auth/session-expiry.interceptor.ts`: только относительные `/api/tasks` и `/api/tasks/...`; при актуальном `401` очищает identity. Если пользователь находится на Tasks, делает replace-навигацию на `/login?reason=session-ended`; на другой странице не мешает навигации. Ошибка остаётся ошибкой для вызывающего кода, повторов запросов нет.
- `app.config.ts`: регистрирует functional interceptor рядом с существующей XSRF-конфигурацией. Cookie/CSRF-механизм не заменяется.
- `app.html`: My tasks видна при подтверждённой identity. Login account view сохраняется, получает Open my tasks; сообщение session-ended описывает отсутствие сессии, не утверждает конкретную причину её потери. Tasks и Login фокусируют заголовок после открытия.

## Потоки

Открытие `/tasks` → guard → AuthSessionService → AuthApiService GET `/api/auth/me`:

- `200`: guard допускает активацию Tasks.
- `401`: anonymous, redirect на login.
- Сеть/500/неожиданный ответ: error, redirect на login с существующим Check session; это не доказательство отсутствия cookie.

Startup restore и guard используют один уже выполняющийся `/me`. При повторной активации сессия проверяется заново, а не только по cached identity. Во время login/logout guard безопасно перенаправляет на login, не пропуская по предыдущему пользователю; ожидание mutation в очередь не добавлено.

Относительный Tasks-запрос → interceptor запоминает revision → API `401` → expireSessionIfCurrent → очистка текущей identity → redirect, если Tasks всё ещё открыта. Revision — только in-memory номер контекста, не auth token и не версия правил валидации пароля. Ответ старого запроса, отправленного до/во время нового login, не сбрасывает новую identity после его завершения.

Login credential `401`, другие API и внешние URL не входят в scope interceptor. `400`, `403`, `500` и сеть сессию не сбрасывают. Нет JWT/localStorage, автоматического logout-запроса или повтора POST. Для `/me` нужен только существующий auth-cookie: GET не требует CSRF bootstrap. Будущий Tasks POST должен явно получить CSRF-токен перед отправкой, как Auth mutations.

После активации Tasks → создаётся локальный TaskListDataService → httpResource отправляет GET с page=1/pageSize=20, timeout=15 секунд, cache=no-store → parse unknown JSON → ready state → @for создаёт TaskListItemComponent для каждой записи. На карточку нет отдельного запроса. Порядок сохраняется серверный. Владелец не передаётся: backend выбирает его по cookie.

До подтверждения identity запрос не отправляется. При loading/reloading старые карточки скрыты; malformed response/неожиданный success status показывается как безопасная ошибка, не как пустой успех. Refresh/retry делает только один GET по явному клику; во время чтения кнопка отключена. Error details, SQL и raw response не выводятся. Карточки показывают Created/Completed в локальном часовом поясе браузера, сохраняя исходную UTC строку в datetime.

Пока UI ограничен первой страницей из 20 задач. Показывается Showing X of Y tasks; если totalCount больше pageSize, есть явное пояснение ограничения. Не загружаем все задачи и не обрезаем их клиентским фильтром. После подключения пагинации нужно сохранить серверный owner predicate и правила [HTTP-контракта](tasks-http-contract.md).

## Проверки

После разделения смешанных тестов 2026-10-26 прошли **235/235 frontend-тестов в 18 файлах**, production build, полный ESLint, проверка типов тестов и форматирование. Сравнение со снимком подтвердило дословное сохранение перенесённых test cases, assertions и setup, а также прежних тестов в целевых файлах (с нормализацией переводов строк). Новых кейсов не добавлялось, существующие не удалялись; production-код и конфигурация не менялись. Первые два запуска отдельного tsc аварийно завершились без диагностики; повтор через Windows PowerShell с ограничением памяти Node прошёл. Bundle — 528.48 kB с прежними Sass/budget warnings. Живой browser/API/SQL Server E2E и AXE не запускались.

После уточнения границ ответственности 2026-10-26 прошли **235/235 frontend-тестов в 17 файлах**, production build, полный ESLint, проверка типов тестов и форматирование затронутого кода. Три новых изолированных теста страницы проверяют реактивность load-state и identity, скрытие списка без пользователя, делегирование retry и фокус заголовка; существующие resource-backed тесты сохранены. Начальный bundle — 528.48 kB, прежние Sass/budget warnings остаются. AXE и живой browser/API/SQL Server E2E в этой стадии не запускались.

После разделения HTTP/client test data 2026-10-26 прошёл полный frontend-прогон: **232/232 теста в 17 файлах**, включая Tasks, маршруты, session-expiry interceptor и Auth. Использован локальный Angular CLI с `VITEST_MAX_WORKERS=1` только для процесса запуска; постоянная конфигурация не менялась. Прежнее падение parser-теста устранено корректными fixtures; негативные envelope-тесты теперь получают валидную исходную HTTP-форму и проверяют именно изменённое поле. Это успешный текущий прогон, в отличие от исторических незавершённых попыток ниже.

После первого шага прошло 155/155 frontend-тестов. После подключения списка — **214/214**, production build также прошёл. Routes используют RouterTestingHarness с настоящим Router, HTTP — HttpTestingController; interceptor-тесты подключают реальные appConfig providers. Дополнительно проверены TaskListItemComponent inputs/plain-text rendering, DTO parse, loading/empty/error, явный retry/refresh, первая страница/metadata, отмена на destroy/смене identity, очистка ранее загруженных данных и отсутствие кеша между экземплярами страницы. Проверен настоящий resource-backed GET с `401` и redirect, а не только отдельный HttpClient-запрос.

Обычный запуск MCP test target завершился ошибкой памяти workers. Успешный повтор из `frontend` ограничивал число workers только в процессе проверки:

```powershell
$env:VITEST_MAX_WORKERS = '2'
npm test -- --watch=false
```

Агент восстановил прежнее значение переменной после запуска; постоянная конфигурация проекта не менялась. Известное Sass @import deprecation warning остаётся. Новый build warning: initial bundle 521.97 kB при warning budget 500 kB; порог не повышался, размер требует отдельного анализа перед публикацией (engineering-followups, пункт 24). AXE и настоящий браузерный frontend/API/SQL Server E2E на этом шаге не запускались; jsdom-тесты не доказывают browser cookie behavior. Таймера истечения и cross-tab synchronization нет: открытая страница узнает об утрате сессии при следующей серверной проверке, не автоматически по часам.

## Ручная проверка

1. Запустить API по HTTPS и `npm start` в frontend; принять только свои локальные development certificates.
2. Гостем открыть `/tasks`: ожидается GET `/api/auth/me` → 401 → `/login`, без показа списка.
3. Войти: account view остаётся на `/login`, появляется Open my tasks и ссылка My tasks в shell.
4. Перейти на Tasks: fresh `/me` → 200 → `/tasks`, заголовок My tasks получает фокус. Затем один GET `/api/tasks?page=1&pageSize=20`, без CSRF bootstrap. Видны карточки либо No tasks to display при успешной пустой странице.
5. Обновить страницу: startup restore и guard не должны делать два одновременных `/me`.
6. Через Manage your account выйти, затем открыть `/tasks` напрямую: guest → login. При недоступном API показывается recovery, не утверждение об успешном выходе.
7. На Tasks нажать Refresh tasks: один новый GET. При недоступном API появляется безопасная ошибка; после восстановления Try again перечитывает список без повтора mutations.
8. Для проверки текущего `401` удалить только свою development auth-cookie в DevTools и нажать Refresh tasks: ожидаются очистка списка и переход на Login. Не публиковать cookie/HAR.

Tasks can now be created through the form on `/tasks`; Swagger remains an alternative API check. A plain DevTools fetch does not pass through Angular's interceptor and does not verify its behavior. See [manual creation acceptance](task-creation-frontend.md#verification-and-manual-acceptance).

## Этап структуры: выполнено и дальнейшие шаги

1. Выполнено по уточнению владельца: рабочие файлы сгруппированы в `task-list-page/` и `task-list-item/`, все тесты и helpers — в `testing/`. Глубина — один уровень ниже Tasks. Общие модели и константы пагинации остались в корне. Обновлены импорты, lazy route и документация; имена/селекторы и component-scoped provider сервиса сохранены. Предыдущий вариант с `pages/`, `components/` и `data-access/` заменён этим решением.
2. Выполнено после согласования: страница скрывает сервисы за private-полями и предоставляет HTML только readonly signals и UI-действие. `TaskListLoadState` перенесён без изменения структуры в общие модели Tasks; тестовые подстановки типизированы этим контрактом. Страница координирует UI/фокус/reload, карточка только отображает input, сервис управляет чтением и состоянием, parser проверяет HTTP JSON и преобразует его в клиентские данные. Деление короткого httpResource-сервиса на API + Store и вынос private helpers парсера в общие utils не требуются на текущем этапе.
3. Выполнено после согласования: группы из `testing/task-list-pagination.spec.ts` распределены по spec-файлам parser/сервиса/страницы/констант внутри того же `testing/`. Старый смешанный файл удалён; test cases, assertions и setup сохранены. Независимые HTTP expectations не заменены импортом проверяемых production defaults. Полный frontend-прогон, lint, build и проверка типов прошли. Новые зависимости, API-контракт, Auth-рефакторинг и бизнес-функции не входили в этот этап.

Все три согласованных пункта этапа структуры выполнены: перенос файлов, уточнение границ ответственности и разделение смешанных тестов. Бизнес-правила и HTTP-контракт не менялись. Это завершение данного рефакторинга, а не оставшейся функциональности Tasks.
