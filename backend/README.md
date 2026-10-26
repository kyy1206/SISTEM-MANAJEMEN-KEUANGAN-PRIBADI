<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework.

In addition, [Laracasts](https://laracasts.com) contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

You can also watch bite-sized lessons with real-world projects on [Laravel Learn](https://laravel.com/learn), where you will be guided through building a Laravel application from scratch while learning PHP fundamentals.

## Agentic Development

Laravel's predictable structure and conventions make it ideal for AI coding agents like Claude Code, Cursor, and GitHub Copilot. Install [Laravel Boost](https://laravel.com/docs/ai) to supercharge your AI workflow:

```bash
composer require laravel/boost --dev

php artisan boost:install
```

Boost provides your agent 15+ tools and skills that help agents build Laravel applications while following best practices.

## Receipt OCR

Receipt scanning is proxied through the authenticated `POST /api/receipt-extractions` endpoint to the OCR.Space POST API. Create a free key from [OCR.Space](https://ocr.space/ocrapi/freekey), then set `RECEIPT_OCR_API_KEY` in the backend environment. `RECEIPT_OCR_LANGUAGE` defaults to `auto` (OCR.Space rejected `ind` in integration testing) and `RECEIPT_OCR_ENGINE` defaults to `2`. Clear Laravel's cached configuration after changing production environment values with `php artisan config:cache` (or `php artisan config:clear` while diagnosing).

The API key stays in the backend and is sent to OCR.Space in the `apikey` request header. Receipt uploads are forwarded as multipart field `file`; the upload is limited to 10 MB and JPG, PNG, WEBP, or PDF. OCR.Space returns recognized text, which the backend heuristically parses into merchant, amount, date, payment method, and a description containing the recognized text. The parser cannot guarantee the correct merchant or total for every receipt, so the user must review and correct the suggested fields before saving. If a field cannot be confidently recognized, it remains empty for manual correction.

The OCR endpoint only returns extracted values for user review; it does not create a transaction. The reviewed form is saved separately through `POST /api/transactions`. Missing credentials return HTTP 503, an unreadable image returns HTTP 422, and provider/network failures return a clear error while manual entry remains available. The free OCR.Space API currently documents a limit of 500 requests per day per IP; use a paid plan or self-hosted OCR for production volume or service-level guarantees. Check the provider's current terms and data-handling policy before sending real receipts.

## Reports and notifications

Run `php artisan migrate` after updating the backend to create the notification de-duplication key.

The authenticated `GET /api/reports?year=2026&month=10` endpoint returns the selected period's summary, all 12 monthly spending totals and budgets for the year, spending by category, and daily totals. Transactions are scoped to the signed-in user and only completed transactions are included.

The authenticated `GET /api/notifications` endpoint returns the latest 30 notifications and an unread count. Budget alerts are generated at 50% and 80% of a monthly target or category allocation, and when spending exceeds 100%. Active subscription reminders are generated when a due date is within seven days. Repeated alerts for the same target and period are de-duplicated. Use `POST /api/notifications/{id}/read` to mark one notification read or `POST /api/notifications/read-all` to mark all of the signed-in user's notifications read.

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
