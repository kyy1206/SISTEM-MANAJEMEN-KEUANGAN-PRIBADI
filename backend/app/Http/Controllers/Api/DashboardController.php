<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'month' => ['sometimes', 'integer', 'between:1,12'],
            'year' => ['sometimes', 'integer', 'between:2000,2100'],
        ]);

        $today = now();
        $month = (int) ($validated['month'] ?? $today->month);
        $year = (int) ($validated['year'] ?? $today->year);
        $start = CarbonImmutable::create($year, $month, 1)->startOfDay();
        $end = $start->endOfMonth();

        $plan = $request->user()
            ->monthlyPlans()
            ->where('month', $month)
            ->where('year', $year)
            ->first();

        $budgetTotal = (float) ($plan?->total_budget ?? 0);
        $spentTotal = (float) $request->user()
            ->transactions()
            ->where('status', 'completed')
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->sum('amount');
        $remaining = $budgetTotal - $spentTotal;
        $percentage = $budgetTotal > 0
            ? round(($spentTotal / $budgetTotal) * 100, 1)
            : ($spentTotal > 0 ? 100.0 : 0.0);
        $isCurrentPeriod = $month === $today->month && $year === $today->year;
        $daysRemaining = $isCurrentPeriod ? $end->day - $today->day + 1 : 0;
        $dailyLimit = $daysRemaining > 0
            ? round(max(0, $remaining) / $daysRemaining, 2)
            : 0;

        $budgetCategories = $plan
            ? $plan->budgets()
                ->with('category')
                ->withSum([
                    'transactions as spent_amount' => fn (Builder $query) => $query
                        ->where('status', 'completed')
                        ->whereBetween('date', [$start->toDateString(), $end->toDateString()]),
                ], 'amount')
                ->get()
                ->map(function ($budget): array {
                    $amount = (float) $budget->amount;
                    $spent = (float) ($budget->spent_amount ?? 0);
                    $percentage = $amount > 0
                        ? round(($spent / $amount) * 100, 1)
                        : ($spent > 0 ? 100.0 : 0.0);

                    return [
                        'id' => $budget->id,
                        'category' => $budget->category->name,
                        'amount' => $amount,
                        'spent' => $spent,
                        'remaining' => $amount - $spent,
                        'percentage' => $percentage,
                        'status' => $this->statusFor($percentage),
                    ];
                })
                ->values()
            : collect();

        $recentTransactions = $request->user()
            ->transactions()
            ->where('status', 'completed')
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->with('budget.category')
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->limit(5)
            ->get()
            ->map(fn ($transaction): array => [
                'id' => $transaction->id,
                'date' => $transaction->date->toDateString(),
                'description' => $transaction->description,
                'merchant' => $transaction->merchant,
                'amount' => (float) $transaction->amount,
                'category' => $transaction->budget?->category?->name,
            ]);

        $dailySpending = $request->user()
            ->transactions()
            ->where('status', 'completed')
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->selectRaw('date, SUM(amount) as total')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row): array => [
                'date' => CarbonImmutable::parse($row->date)->toDateString(),
                'amount' => (float) $row->total,
            ]);

        return response()->json([
            'data' => [
                'period' => ['month' => $month, 'year' => $year],
                'plan' => $plan ? [
                    'id' => $plan->id,
                    'total_budget' => $budgetTotal,
                ] : null,
                'summary' => [
                    'budget_total' => $budgetTotal,
                    'spent_total' => $spentTotal,
                    'remaining' => $remaining,
                    'percentage' => $percentage,
                    'status' => $this->statusFor($percentage),
                    'daily_limit' => $dailyLimit,
                    'days_remaining' => $daysRemaining,
                ],
                'budget_categories' => $budgetCategories,
                'recent_transactions' => $recentTransactions,
                'daily_spending' => $dailySpending,
            ],
        ]);
    }

    private function statusFor(float $percentage): string
    {
        return match (true) {
            $percentage > 100 => 'overbudget',
            $percentage >= 80 => 'kritis',
            $percentage >= 50 => 'waspada',
            default => 'aman',
        };
    }
}
