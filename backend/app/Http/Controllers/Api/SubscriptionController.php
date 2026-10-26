<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subscription;
use App\Services\NotificationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    public function index(Request $request, NotificationService $notificationService): JsonResponse
    {
        $notificationService->syncUpcomingSubscriptionReminders($request->user());
        $validated = $request->validate([
            'search' => ['sometimes', 'string', 'max:255'],
            'status' => ['sometimes', 'in:active,inactive,cancelled'],
        ]);

        $subscriptions = $request->user()
            ->subscriptions()
            ->when(isset($validated['status']), fn (Builder $query) => $query->where('status', $validated['status']))
            ->when(isset($validated['search']), fn (Builder $query) => $query->where('name', 'like', '%'.$validated['search'].'%'))
            ->orderByRaw("CASE status WHEN 'active' THEN 0 WHEN 'inactive' THEN 1 ELSE 2 END")
            ->orderBy('due_date')
            ->get();

        $activeSubscriptions = $request->user()
            ->subscriptions()
            ->where('status', 'active')
            ->orderBy('due_date')
            ->get();
        $monthlyTotal = $activeSubscriptions->sum(
            fn (Subscription $subscription): float => $this->monthlyEquivalent($subscription),
        );
        $monthlyPlan = $request->user()
            ->monthlyPlans()
            ->where('month', now()->month)
            ->where('year', now()->year)
            ->first();
        $nextDue = $activeSubscriptions
            ->filter(fn (Subscription $subscription): bool => $subscription->due_date->greaterThanOrEqualTo(today()))
            ->sortBy('due_date')
            ->first();
        $dueSoon = $activeSubscriptions
            ->filter(fn (Subscription $subscription): bool => $subscription->due_date->lessThanOrEqualTo(today()->addDays(7)))
            ->values()
            ->map(fn (Subscription $subscription): array => [
                'id' => $subscription->id,
                'name' => $subscription->name,
                'due_date' => $subscription->due_date->toDateString(),
                'amount' => (float) $subscription->amount,
                'billing_cycle' => $subscription->billing_cycle,
                'overdue' => $subscription->due_date->lessThan(today()),
            ]);

        return response()->json([
            'data' => $subscriptions,
            'summary' => [
                'monthly_total' => round($monthlyTotal, 2),
                'active_count' => $activeSubscriptions->count(),
                'monthly_budget' => (float) ($monthlyPlan?->total_budget ?? 0),
                'monthly_budget_share' => $monthlyPlan && (float) $monthlyPlan->total_budget > 0
                    ? round(($monthlyTotal / (float) $monthlyPlan->total_budget) * 100, 1)
                    : 0,
                'next_due' => $nextDue ? [
                    'id' => $nextDue->id,
                    'name' => $nextDue->name,
                    'due_date' => $nextDue->due_date->toDateString(),
                    'amount' => (float) $nextDue->amount,
                    'billing_cycle' => $nextDue->billing_cycle,
                ] : null,
                'due_soon' => $dueSoon,
                'category_breakdown' => $activeSubscriptions
                    ->groupBy('category')
                    ->map(fn ($items, string $category): array => [
                        'category' => $category,
                        'count' => $items->count(),
                        'monthly_total' => round($items->sum(
                            fn (Subscription $subscription): float => $this->monthlyEquivalent($subscription),
                        ), 2),
                    ])
                    ->values(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:100'],
            'amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:9999999999999.99'],
            'billing_cycle' => ['required', 'in:monthly,yearly'],
            'due_date' => ['required', 'date_format:Y-m-d'],
            'status' => ['sometimes', 'in:active,inactive,cancelled'],
        ]);

        $subscription = $request->user()->subscriptions()->create($validated + ['status' => 'active']);
        app(NotificationService::class)->syncUpcomingSubscriptionReminders($request->user());

        return response()->json([
            'message' => 'Subscription berhasil ditambahkan.',
            'data' => $subscription,
        ], 201);
    }

    public function show(Request $request, Subscription $subscription): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->subscriptions()->findOrFail($subscription->id),
        ]);
    }

    public function update(Request $request, Subscription $subscription): JsonResponse
    {
        $subscription = $request->user()->subscriptions()->findOrFail($subscription->id);
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'category' => ['sometimes', 'required', 'string', 'max:100'],
            'amount' => ['sometimes', 'required', 'numeric', 'decimal:0,2', 'gt:0', 'max:9999999999999.99'],
            'billing_cycle' => ['sometimes', 'required', 'in:monthly,yearly'],
            'due_date' => ['sometimes', 'required', 'date_format:Y-m-d'],
            'status' => ['sometimes', 'required', 'in:active,inactive,cancelled'],
        ]);

        $subscription->update($validated);
        app(NotificationService::class)->syncUpcomingSubscriptionReminders($request->user());

        return response()->json([
            'message' => 'Subscription berhasil diperbarui.',
            'data' => $subscription->refresh(),
        ]);
    }

    public function destroy(Request $request, Subscription $subscription): JsonResponse
    {
        $request->user()->subscriptions()->findOrFail($subscription->id)->delete();

        return response()->json(['message' => 'Subscription berhasil dihapus.']);
    }

    private function monthlyEquivalent(Subscription $subscription): float
    {
        $amount = (float) $subscription->amount;

        return $subscription->billing_cycle === 'yearly'
            ? round($amount / 12, 2)
            : $amount;
    }
}
