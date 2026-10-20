# Проверка login endpoint: промежуточный этап

Реализованы cookie-схема, login, `/me`, logout и серверная CSRF-защита. Angular login пока не реализован. Ограничение попыток входа и production-конфигурация остаются незавершёнными; добавление CSRF само по себе не означает готовность к публикации. Механизм объяснён в [csrf-protection.md](csrf-protection.md).

## Ручная проверка

1. Запустите API через HTTPS profile, как описано в [registration-local-setup.md](registration-local-setup.md). Схема БД должна быть подготовлена ранее; новых миграций этот этап не требует.
2. Откройте Swagger UI API и выполните `POST /api/auth/login` с email и паролем существующего тестового пользователя. Используйте только вымышленные данные. Регистрация по-прежнему не выполняет автоматический вход.
   Development Swagger перед каждым изменяющим запросом сам вызывает `GET /api/auth/csrf`, читает request-token cookie и добавляет `X-XSRF-TOKEN`. Для отдельного HTTP-клиента выполните эти действия явно: сохраните парную cookie и передайте request token заголовком. Вызов GET без последующей передачи заголовка недостаточен.
3. Ожидайте `200` с двумя полями `id` и `email`. В Network ответ должен содержать `Set-Cookie: __Host-TodoApp.Auth=...`; cookie имеет `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, без `Domain` и `Expires`. Не публикуйте cookie, пароль, полный запрос или HAR.
4. Неверный пароль и неизвестный email должны давать одинаковый `401` с заголовком ошибки `Invalid email or password.`. Некорректные поля дают `400` с `errors.email` / `errors.password`; ошибки входа не выдают новую cookie.
5. В том же браузере после успешного login вызовите `GET /api/auth/me`: ожидайте `200` с `id`/`email` и `Cache-Control: no-store`. Обновление Swagger-страницы не завершает вход. Это данные ticket на момент входа, а не повторное чтение пользователя из БД.
6. Выполните `POST /api/auth/logout`: ожидайте пустой `204` и удаление `__Host-TodoApp.Auth`. Следующий `/me` должен вернуть `401` без перенаправления; повторный logout — снова `204`. `GET /api/auth/logout` возвращает `405` и не выполняет выход. Logout удаляет cookie у этого клиента, но не отзывает скопированные ticket на сервере.

Используйте HTTPS-адрес самого API. Браузер сохраняет и отправляет cookie автоматически; вводить authentication cookie в Swagger Authorize не требуется. Angular dev server также работает по HTTPS, но UI login пока отсутствует. Для проверки гостевого `/me` используйте отдельное приватное окно или сначала выполните logout. Для login и logout нужен свежий CSRF-токен текущей идентичности; даже повторный logout проходит CSRF-проверку.

## Как работает сессия

`LoginHandler` проверяет credentials, API создаёт claims `NameIdentifier`/`Email` и вызывает `SignInAsync`. Cookie-handler защищает ticket через ASP.NET Core Data Protection. При последующих запросах authentication middleware восстанавливает `HttpContext.User` из действительного ticket. Cookie не содержит пароль/хеш.

Ticket живёт восемь часов с момента входа, без продления при активности. Cookie не persistent: обновление страницы не завершает сессию, а закрытие браузера может завершить её раньше. Серверного списка сессий/механизма отзыва пока нет; изменения аккаунта не перепроверяются для каждого ticket. Production-конфигурация Data Protection требует отдельного решения, особенно для нескольких экземпляров сервера.

## Автоматическая проверка без SQL Server

Из `backend`:

```powershell
dotnet test tests/TodoApp.IntegrationTests --filter "FullyQualifiedName~LoginEndpointTests|FullyQualifiedName~SessionEndpointTests|FullyQualifiedName~CsrfEndpointTests|FullyQualifiedName~AuthServiceRegistrationTests"
```

Эти тесты используют настоящий API-host и cookie-handler, но заменяют репозиторий тестовой реализацией в общем `LoginApiFactory`. Они не открывают соединение с БД и не требуют `TODOAPP_TEST_CONNECTION_STRING`. Существующие behavior-тесты через `CsrfTestHandler` получают настоящие токены по HTTP; server-side проверка не отключается. `CsrfEndpointTests` используют raw-клиент без этой автоматизации и проверяют отказы при отсутствии/подмене токенов, разные пары, смену идентичности и предотвращение logout. Это не браузерный E2E-тест. Время cookie-сессии контролируется через `TimeProvider`, поэтому проверка истечения не требует ожидания восьми часов.
