# Angular login: реализация и проверка

## Разделение ответственности

- `frontend/src/app/features/auth/login/login.ts` — Signal Form, нормализация email, обработка submit и привязка ошибок к полям, фокус после результата. Компонент создан через `ng generate component features/auth/login --skip-tests`.
- `login.html` / `login.scss` — labels, password-manager hints, состояние ожидания, errors, account view и кнопка выхода. Используются Bootstrap и нативная семантика form/fieldset/button.
- `login/login-error.ts` — чистый разбор HTTP-ошибок и безопасные сообщения; `401` всегда показывает `Invalid email or password.`, raw details технических сбоев не выводятся.
- `auth-field-errors.ts` — общий парсер `errors.email` / `errors.password` для Register и Login, без зависимости одного сценария от другого.
- `auth-api.ts` — HTTP: регистрация, login, `/me`, logout; подготовка CSRF перед POST и проверка ожидаемых статусов. Автоматических повторов нет.
- `auth.model.ts` — отдельный LoginRequest и readonly AuthUser, без domain entities, passwords в response или token-полей.
- `auth-user.ts` — runtime-проверка public identity response и копирование только `id`/`email`.
- `auth-session.ts` — singleton на `@Service`, созданный CLI `ng generate service features/auth/auth-session --skip-tests`. Хранит подтверждённую identity в signals, управляет restore/login/logout и неопределёнными результатами.
- `app.ts` — запускает restore при создании корневого компонента. `app.html` даёт ссылки Sign in/Account и Register; `app.routes.ts` lazy-loads `/login` и `/register`, `/` ведёт на `/login`.
- Register получил ссылку Sign in после успеха. Успех регистрации говорит, что она **не выполняет автоматический вход**, не утверждая, что браузер обязательно не имеет более ранней сессии.

## Форма и signals

`model = signal({email: '', password: ''})` содержит текущие поля только в памяти. `form(model, schema)` строит дерево полей и их состояние: errors, touched, submitting. `[formField]` связывает input с моделью; `computed` определяет, когда показывать ошибку.

Email нормализуется через существующий `normalizeEmail`: Unicode White_Space по краям удаляется без изменения регистра. Пароль не обрезается и не нормализуется. `autocomplete="username"` и `autocomplete="current-password"` помогают password manager.

`submit(form, async callback)` проверяет схему и отмечает поля. Callback отправки выполняется только при валидной форме. Во время запроса кнопка и fieldset недоступны; повторный submit также проверяется в обработчике. При server-side field error ошибка привязывается к соответствующему field tree. Фокус переводится после render на ошибочное поле, а после успеха — на заголовок account view. Пароль очищается после подтверждённого успеха, включая восстановление успешного входа через `/me` после потери ответа.

Пока страницы задач нет, успешный вход показывает account view на том же `/login`: email и Sign out. Это не защищённая страница задач и не новый бизнес-модуль.

## Запросы входа

```text
Login.onSubmit
  → AuthSession.login
    → AuthApi.login
      → GET /api/auth/csrf: 204 + CSRF cookies
      → Angular XSRF interceptor читает __Host-TodoApp.Xsrf
      → POST /api/auth/login + X-XSRF-TOKEN + cookies
      ← 200 {id,email} + Set-Cookie authentication ticket
    → state = authenticated
  → очистка пароля и account view
```

`switchMap` запускает POST после успешного bootstrap. Если GET неуспешен или имеет неожиданный статус, credentials не отправляются. Каждый HTTP-запрос ограничен 15 секундами, то есть bootstrap и mutation — два отдельных ограниченных запроса.

Браузер сохраняет authentication cookie из ответа и автоматически отправляет её при следующих same-origin запросах. JavaScript не читает `Set-Cookie` или HttpOnly authentication cookie. Никаких JWT, Bearer header, refresh token и localStorage-механизмов в этом потоке не добавлено.

Три роли cookie:

| Cookie | Роль | HttpOnly |
| --- | --- | --- |
| `__Host-TodoApp.Auth` | Защищённый authentication ticket | Да |
| `__Host-TodoApp.Antiforgery` | Парная внутренняя cookie ASP.NET Core | Да |
| `__Host-TodoApp.Xsrf` | Request token для `X-XSRF-TOKEN` | Нет |

Login bootstrap получает гостевой или текущий пользовательский токен в зависимости от cookie браузера. После входа перед logout получается новый токен уже для текущей идентичности. После выхода следующая попытка login снова подготавливает токен. Подробнее: [csrf-protection.md](csrf-protection.md).

## Восстановление и выход

При запуске `App` вызывает `AuthSession.restore()`:

- `GET /api/auth/me` → `200`: сохраняется только public identity.
- `401`: подтверждено guest-состояние.
- Сеть, `500`, некорректное тело: результат неизвестен, состояние `error`, а не фиктивный guest. На `/login` есть **Check session**, которая безопасно повторяет GET.

`AuthSession` хранит состояния unknown/loading/anonymous/authenticated/error и readonly busy signal. Повторные restore объединяются; restore и auth-mutation не выполняются параллельно внутри сервиса. Поэтому поздний `/me` не может перезаписать результат нового login/logout.

Sign out делает `GET csrf → POST logout`. Только подтверждённый `204` переводит state в anonymous. При потерянном ответе исход неизвестен — его можно проверить `/me`, не повторяя POST автоматически. Неопределённый login восстанавливается аналогично.

Login-запрос принадлежит singleton AuthSession, а не времени жизни страницы. При уходе со страницы ограниченный HTTP-запрос продолжает работать и обновляет глобальную identity; уничтоженный компонент больше не меняет свои UI-поля. Отмена подписки не могла бы гарантировать отмену уже выполненного сервером входа.

Состояние UI — последнее серверное подтверждение, не право доступа. Перезагрузка браузера создаёт новый service и спрашивает `/me`. Между вкладками автоматической синхронизации пока нет, нет и таймера истечения/общего `401`-interceptor для будущих task API. Cookie ticket по-прежнему истекает через восемь часов, logout не отзывает независимо сохранённые копии.

## Нужны ли frontend-ревизии паролей

Выбрано минимальное разделение по сценариям:

- Register: текущая клиентская политика создания пароля (сейчас 15–256 code points, не только whitespace).
- Login: locally required password. Исторические минимумы/максимумы и whitespace-политику проверяет backend по Supported revisions; UI показывает `400 errors.password`.

Это осознанно более мягкая проверка формы входа. Она не позволит будущей регистрационной политике незаметно блокировать старые credentials на клиенте. Серверный максимум остаётся обязательным: отправка длинной строки клиентом не означает, что сервер разрешил её как пароль.

Копирование архива V1/V2 и алгоритма совместимости в TypeScript создало бы второй источник правил. Если потребуется точная синхронизация подсказок до запроса, отдельно согласовать метаданные **эффективных** правил с сервера и неблокирующий fallback. Такой endpoint не добавлен. См. [password-policy-revisions.md](password-policy-revisions.md).

## Как проверить

1. Поднимите API по HTTPS с подготовленной БД и локальными secrets, затем `npm start` из `frontend`. Новых миграций нет.
2. Откройте `https://localhost:4200/login`, при необходимости настройте доверие к локальному сертификату. Первым ожидается `/me`; для гостя это `401`.
3. Используйте существующего вымышленного пользователя. Нажмите Sign in. В Network ожидается GET csrf, затем один POST login с `X-XSRF-TOKEN`. Пароль и cookie/HAR не публикуйте.
4. После `200` появятся email и Sign out. Authentication cookie должна иметь Secure/HttpOnly; JavaScript её не читает.
5. Обновите страницу: `/me` должен восстановить account view. Если снова guest, проверьте фактическое сохранение cookie, HTTPS и настройки proxy.
6. Sign out: GET csrf → POST logout → 204, форма снова доступна с пустым паролем. Обновление страницы подтверждает guest через `/me`.
7. Неверный пароль: один общий `Invalid email or password.`. Короткий пароль не блокируется локальной историей правил, но текущий backend возвращает field error по своей политике.
8. При ошибке связи не считайте вход/выход завершённым. После восстановления API нажмите Check session.

## Автоматические проверки

Из `frontend`: `npm test -- --watch=false` и `npm run build`.

Добавлены `auth-login-api.spec.ts`, `auth-session.spec.ts`, `login/login.spec.ts`, `login/login-error.spec.ts`. Существующие App/routes/Register tests обновлены. Проверяются DTO и статусы, CSRF-порядок, password preservation, malformed responses, /me 401 vs network, serialization, ambiguous outcomes, form feedback/focus, duplicate submits, logout и уход со страницы.

HttpTestingController моделирует API и Set-Cookie: это не доказательство браузерного сохранения cookie или live SQL Server connectivity. AXE/браузерный E2E в этом этапе не запускались.
