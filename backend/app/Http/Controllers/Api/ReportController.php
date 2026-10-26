<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'year' => ['sometimes', 'integer', 'between:2000,2100'],
            'month' => ['sometimes', 'integer', 'between:1,12'],
        ]);

        $year = (int) ($validated['year'] ?? now()->year);
        $month = (int) ($validated['month'] ?? now()->month);
        $selectedStart = CarbonImmutable::create($year, $month, 1)->toDateString();
        $selectedEnd = CarbonImmutable::create($year, $month, 1)->endOfMonth()->toDateString();

        $monthlySpending = collect(range(1, 12))->map(function (int $monthNumber) use ($request, $year): array {
            $start = CarbonImmutable::create($year, $monthNumber, 1);
            $end = $start->endOfMonth();
            $budget = $request->user()->monthlyPlans()
                ->where('year', $year)
                ->where('month', $monthNumber)
                ->value('total_budget');
            $spent = (float) $request->user()->transactions()
                ->where('status', 'completed')
                ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
                ->sum('amount');

            return [
                'month' => $monthNumber,
                'label' => $start->translatedFormat('M'),
                'spent' => $spent,
                'budget' => (float) ($budget ?? 0),
            ];
        });

        $categorySpending = $request->user()->transactions()
            ->leftJoin('budgets', 'transactions.budget_id', '=', 'budgets.id')
            ->leftJoin('categories', 'budgets.category_id', '=', 'categories.id')
            ->where('transactions.status', 'completed')
            ->whereBetween('transactions.date', [$selectedStart, $selectedEnd])
            ->selectRaw("COALESCE(categories.name, 'Tanpa kategori') as category, SUM(transactions.amount) as total")
            ->groupBy('categories.name')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row): array => [
                'category' => $row->category,
                'total' => (float) $row->total,
            ]);

        $dailySpending = $request->user()->transactions()
            ->where('status', 'completed')
            ->whereBetween('date', [$selectedStart, $selectedEnd])
            ->selectRaw('date, SUM(amount) as total')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row): array => [
                'date' => CarbonImmutable::parse($row->date)->toDateString(),
                'total' => (float) $row->total,
            ]);

        $yearTotal = (float) $monthlySpending->sum('spent');
        $selectedTotal = (float) $categorySpending->sum('total');
        $selectedBudget = (float) ($monthlySpending->firstWhere('month', $month)['budget'] ?? 0);

        return response()->json([
            'data' => [
                'period' => ['year' => $year, 'month' => $month],
                'summary' => [
                    'year_total' => $yearTotal,
                    'monthly_average' => round($yearTotal / 12, 2),
                    'selected_month_total' => $selectedTotal,
                    'selected_month_budget' => $selectedBudget,
                    'budget_variance' => $selectedBudget - $selectedTotal,
                    'category_count' => $categorySpending->count(),
                ],
                'monthly_spending' => $monthlySpending,
                'category_spending' => $categorySpending,
                'daily_spending' => $dailySpending,
            ],
        ]);
    }
}
