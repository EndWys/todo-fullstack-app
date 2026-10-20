# Проверка login endpoint: промежуточный этап

Реализованы только cookie-схема и `POST /api/auth/login`. `/me`, logout, CSRF и Angular login пока не реализованы. Не публикуйте этот промежуточный вариант: `SameSite=Lax` не заменяет antiforgery-проверку; ограничение попыток входа также ещё отсутствует.

## Ручная проверка

1. Запустите API через HTTPS profile, как описано в [registration-local-setup.md](registration-local-setup.md). Схема БД должна быть подготовлена ранее; новых миграций этот этап не требует.
2. Откройте Swagger UI API и выполните `POST /api/auth/login` с email и паролем существующего тестового пользователя. Используйте только вымышленные данные. Регистрация по-прежнему не выполняет автоматический вход.
3. Ожидайте `200` с двумя полями `id` и `email`. В Network ответ должен содержать `Set-Cookie: __Host-TodoApp.Auth=...`; cookie имеет `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, без `Domain` и `Expires`. Не публикуйте cookie, пароль, полный запрос или HAR.
4. Неверный пароль и неизвестный email должны давать одинаковый `401` с заголовком ошибки `Invalid email or password.`. Некорректные поля дают `400` с `errors.email` / `errors.password`; ошибки входа не выдают новую cookie.

Используйте HTTPS-адрес самого API. Текущий HTTP Angular dev server пока не является настроенным cookie/CSRF-потоком. Полную ручную проверку доступа к защищённому ресурсу добавим вместе с `/me`.

## Как работает сессия

`LoginHandler` проверяет credentials, API создаёт claims `NameIdentifier`/`Email` и вызывает `SignInAsync`. Cookie-handler защищает ticket через ASP.NET Core Data Protection. При последующих запросах authentication middleware восстанавливает `HttpContext.User` из действительного ticket. Cookie не содержит пароль/хеш.

Ticket живёт восемь часов с момента входа, без продления при активности. Cookie не persistent: обновление страницы не завершает сессию, а закрытие браузера может завершить её раньше. Серверного списка сессий/механизма отзыва пока нет; изменения аккаунта не перепроверяются для каждого ticket. Production-конфигурация Data Protection требует отдельного решения, особенно для нескольких экземпляров сервера.

## Автоматическая проверка без SQL Server

Из `backend`:

```powershell
dotnet test tests/TodoApp.IntegrationTests --filter "FullyQualifiedName~LoginEndpointTests|FullyQualifiedName~AuthServiceRegistrationTests"
```

Эти тесты используют настоящий API-host и cookie-handler, но заменяют репозиторий тестовой реализацией. Они не открывают соединение с БД и не требуют `TODOAPP_TEST_CONNECTION_STRING`. Это не проверка SQL Server или браузерной CSRF-защиты. Время в тестах контролируется через `TimeProvider`, поэтому проверка истечения не требует ожидания восьми часов.
