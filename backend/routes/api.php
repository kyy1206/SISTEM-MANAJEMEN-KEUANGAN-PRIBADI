<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BudgetController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\MonthlyPlanController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ReceiptExtractionController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\TransactionController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::post('/logout', [AuthController::class, 'logout']);

    // Categories API
    Route::apiResource('categories', CategoryController::class);

    Route::apiResource('monthly-plans', MonthlyPlanController::class);
    Route::apiResource('budgets', BudgetController::class)->except(['show']);
    Route::apiResource('transactions', TransactionController::class);
    Route::post('/receipt-extractions', [ReceiptExtractionController::class, 'store']);
    Route::apiResource('subscriptions', SubscriptionController::class);
    Route::get('/dashboard', DashboardController::class);
    Route::get('/reports', ReportController::class);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
});
