<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request, NotificationService $notificationService): JsonResponse
    {
        $notificationService->syncUpcomingSubscriptionReminders($request->user());
        $notifications = $request->user()
            ->notifications()
            ->latest()
            ->paginate(30);

        return response()->json([
            'data' => $notifications,
            'unread_count' => $request->user()->notifications()->whereNull('read_at')->count(),
        ]);
    }

    public function markRead(Request $request, Notification $notification): JsonResponse
    {
        $notification = $request->user()->notifications()->findOrFail($notification->id);
        $notification->markAsRead();

        return response()->json(['data' => $notification->fresh()]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->notifications()
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json([
            'message' => 'Semua notifikasi telah ditandai dibaca.',
            'unread_count' => 0,
        ]);
    }
}
