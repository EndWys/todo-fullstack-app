# CSRF-защита TodoApp

## Определение и причина

CSRF (Cross-Site Request Forgery) — атака, при которой чужая страница заставляет браузер пользователя отправить нежелательный запрос нашему приложению. Если браузер приложит authentication cookie, сервер увидит действительную идентичность, хотя запрос инициировало чужое приложение.

CSRF-защита в TodoApp — обязательная серверная проверка связанного с браузерным cookie-контекстом и текущей идентичностью токена в изменяющем API-запросе. Наш JavaScript получает токен и явно передаёт его заголовком. У чужого origin нет обычного доступа к этому значению: браузер изолирует чтение cookie и ответов между origin, а сервер не разрешает credentialed CORS чужим сайтам.

Пример: пользователь вошёл на `https://app.todo.example`, затем открыл недоверенную страницу на `https://evil.todo.example`. На ней размещена форма:

```html
<form action="https://app.todo.example/api/auth/logout" method="post">
  <button>Получить подарок</button>
</form>
```

Это гипотетические адреса, не окружение проекта. Оба HTTPS-поддомена относятся к одному site, но разным origin; SameSite может допустить cookie в таком запросе. Без проверки токена сервер мог бы выполнить logout. С нашей проверкой у формы отсутствует `X-XSRF-TOKEN`, поэтому сервер возвращает `400` до вызова `SignOutAsync`. Сессия пользователя сохраняется.

## Три cookie с разными ролями

| Cookie | Доступ JavaScript | Роль |
| --- | --- | --- |
| `__Host-TodoApp.Auth` | Нет, HttpOnly | Защищённый authentication ticket: кто пользователь |
| `__Host-TodoApp.Antiforgery` | Нет, HttpOnly | Внутренняя cookie штатного antiforgery-механизма |
| `__Host-TodoApp.Xsrf` | Да | Request token, который Angular копирует в `X-XSRF-TOKEN` |

Все три cookie — Secure, host-only, Path=/, без Domain. Authentication cookie имеет SameSite=Lax, две CSRF-cookie — Strict. Читаемость request-token cookie нужна для штатного механизма Angular; authentication cookie остаётся HttpOnly. Нельзя публиковать cookie, токены или HAR.

## Реализованный протокол

1. Клиент отправляет `GET /api/auth/csrf` для своей текущей идентичности; вход не обязателен.
2. API вызывает `IAntiforgery.GetAndStoreTokens`. Framework создаёт внутреннюю cookie, если нужно, и выдаёт связанный с ней request token. API помещает request token в читаемую cookie и возвращает `204`, `Cache-Control: no-store`.
3. Angular отправляет POST. Cookie браузер прикладывает сам, а XSRF-interceptor Angular читает request token и добавляет `X-XSRF-TOKEN`.
4. После authentication/authorization middleware `CsrfProtectionMiddleware` проверяет все unsafe-методы `/api`: заголовок обязателен, затем вызывается `IAntiforgery.ValidateRequestAsync`.
5. Проверяются защищённость токенов, согласованность внутреннего cookie-токена с request token и соответствие текущей идентичности. Строки двух токенов разные; наша реализация не сравнивает cookie и header оператором равенства.
6. Только после успешной проверки запрос попадает в endpoint и бизнес-логику.

Условный запрос на выход выглядит так:

```http
POST /api/auth/logout
Cookie: __Host-TodoApp.Auth=<ticket>; __Host-TodoApp.Antiforgery=<cookie-token>
X-XSRF-TOKEN: <request-token>
```

Дополнительная читаемая cookie тоже обычно отправится браузером, но сервер валидирует заголовок вместе с **внутренней** cookie. Простого присутствия request-token cookie недостаточно.

При ошибке возвращается `400 application/problem+json`:

```json
{
  "title": "CSRF validation failed.",
  "status": 400,
  "code": "csrf_validation_failed"
}
```

Причина расхождения и содержимое токенов клиенту не раскрываются. Это отдельная ошибка безопасности запроса, поэтому `errors.email` / `errors.password` отсутствуют.

## Login, logout и обновление токена

Login изменяет идентичность браузера, поэтому тоже защищён. Например, атакующий мог бы попытаться войти в браузере жертвы в **свой** аккаунт, после чего жертва добавляла бы личные данные в доступный атакующему аккаунт. Гостевой bootstrap позволяет безопасно начать login.

Пока браузер вошёл, гостевой токен не соответствует его идентичности. После logout токен пользователя также не соответствует гостю. Поэтому текущая регистрация Angular и Development Swagger получают токен перед каждым изменяющим запросом. При реализации Angular login/logout нужно использовать ту же последовательность. Даже повторный logout требует корректной CSRF-пары текущего контекста и затем возвращает `204`.

Токен не одноразовый: совместимый token может проходить несколько запросов. Получение нового request token также не означает немедленный отзыв всех старых токенов для той же cookie и идентичности. При гонке bootstrap/смены аккаунта возможен безопасный отказ `400`; POST автоматически не повторяется.

## Места в коде

- `backend/src/TodoApp.Api/Setup/AntiforgerySetup.cs` — штатный сервис и настройки internal-cookie/header.
- `backend/src/TodoApp.Api/Features/Auth/Csrf/` — имена протокола и bootstrap endpoint.
- `backend/src/TodoApp.Api/Middleware/CsrfProtectionMiddleware.cs` — обязательная серверная проверка, включая JSON Minimal APIs и anonymous endpoints.
- `backend/src/TodoApp.Api/Setup/WebApplicationSetup.cs` — порядок middleware и регистрация endpoint.
- `backend/src/TodoApp.Api/Setup/SwaggerSetup.cs` — подготовка токена браузерным Swagger без исключения из серверной проверки.
- `frontend/src/app/app.config.ts` — настройка имени cookie для встроенного Angular XSRF-interceptor.
- `frontend/src/app/features/auth/auth-api.ts` — bootstrap, затем POST через `switchMap`. Если bootstrap неуспешен, POST не отправляется.
- `frontend/angular.json` — HTTPS dev server; запросы `/api` остаются same-origin благодаря proxy.

## Проверка и границы

`CsrfEndpointTests` используют настоящий HTTP pipeline без автоматической подготовки токенов. Проверяются отсутствие cookie/header, повреждение, неверная пара, выдуманные одинаковые cookie/header, смена идентичности, другая identity и сохранение сессии после заблокированного logout. Общие behavior-тесты используют `CsrfTestHandler`: он получает настоящие токены по HTTP, не отключая серверную проверку. Angular-тест проверяет встроенное копирование свежей cookie в header; браузерное применение Set-Cookie моделируется явно.

Защита рассчитана на same-origin браузерный клиент и доверенный JavaScript нашего origin. При добавлении стороннего JavaScript, расширении CORS или размещении недоверенного приложения на том же origin нужно заново оценить границу доверия. Cookie не разделяются по порту: несколько локальных приложений на `localhost` также делят cookie-пространство.

Полноценная браузерная проверка HTTPS, сертификатов, Angular proxy и cookie дополняет HTTP/unit-тесты. Ограничение попыток входа, production key storage и отзыв authentication ticket остаются отдельными задачами.

Официальные материалы: [ASP.NET Core antiforgery](https://learn.microsoft.com/en-us/aspnet/core/security/anti-request-forgery?view=aspnetcore-10.0), [Angular XSRF](https://angular.dev/best-practices/security#httpclient-xsrf-csrf-security), [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
