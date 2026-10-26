<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Models\Transaction;
use App\Services\NotificationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TransactionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date_from' => ['sometimes', 'date_format:Y-m-d'],
            'date_to' => array_merge(
                ['sometimes', 'date_format:Y-m-d'],
                $request->filled('date_from') ? ['after_or_equal:date_from'] : [],
            ),
            'budget_id' => ['sometimes', 'integer'],
            'category_id' => ['sometimes', 'integer'],
            'search' => ['sometimes', 'string', 'max:255'],
        ]);

        $transactions = $request->user()
            ->transactions()
            ->with('budget.category')
            ->when(isset($validated['date_from']), fn (Builder $query) => $query->whereDate('date', '>=', $validated['date_from']))
            ->when(isset($validated['date_to']), fn (Builder $query) => $query->whereDate('date', '<=', $validated['date_to']))
            ->when(isset($validated['budget_id']), fn (Builder $query) => $query->where('budget_id', $validated['budget_id']))
            ->when(isset($validated['category_id']), fn (Builder $query) => $query->whereHas(
                'budget',
                fn (Builder $budgetQuery) => $budgetQuery->where('category_id', $validated['category_id']),
            ))
            ->when(isset($validated['search']), function (Builder $query) use ($validated): void {
                $query->where(function (Builder $query) use ($validated): void {
                    $query->where('description', 'like', '%'.$validated['search'].'%')
                        ->orWhere('merchant', 'like', '%'.$validated['search'].'%');
                });
            })
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->paginate(20);

        return response()->json(['data' => $transactions]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'budget_id' => ['nullable', 'integer'],
            'amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:9999999999999.99'],
            'description' => ['nullable', 'string', 'max:2000'],
            'date' => ['required', 'date_format:Y-m-d'],
            'merchant' => ['nullable', 'string', 'max:255'],
            'payment_method' => ['nullable', 'string', 'max:100'],
            'source' => ['sometimes', 'in:manual,ocr'],
        ]);

        $this->ensureOwnedBudget($request, $validated['budget_id'] ?? null, $validated['date']);

        $transaction = $request->user()->transactions()->create($validated + [
            'source' => 'manual',
            'status' => 'completed',
        ]);
        app(NotificationService::class)->syncBudgetAlertsForPeriod(
            $request->user(),
            (int) substr($validated['date'], 0, 4),
            (int) substr($validated['date'], 5, 2),
        );

        return response()->json([
            'message' => 'Transaksi berhasil dicatat.',
            'data' => $transaction->load('budget.category'),
        ], 201);
    }

    public function show(Request $request, Transaction $transaction): JsonResponse
    {
        $transaction = $request->user()
            ->transactions()
            ->with('budget.category')
            ->findOrFail($transaction->id);

        return response()->json(['data' => $transaction]);
    }

    public function update(Request $request, Transaction $transaction): JsonResponse
    {
        $transaction = $request->user()->transactions()->findOrFail($transaction->id);
        $previousDate = $transaction->date->toDateString();
        $validated = $request->validate([
            'budget_id' => ['sometimes', 'nullable', 'integer'],
            'amount' => ['sometimes', 'required', 'numeric', 'decimal:0,2', 'gt:0', 'max:9999999999999.99'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'date' => ['sometimes', 'required', 'date_format:Y-m-d'],
            'merchant' => ['sometimes', 'nullable', 'string', 'max:255'],
            'payment_method' => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);

        $budgetId = array_key_exists('budget_id', $validated) ? $validated['budget_id'] : $transaction->budget_id;
        $date = $validated['date'] ?? $transaction->date->toDateString();
        $this->ensureOwnedBudget($request, $budgetId, $date);

        $transaction->update($validated);
        $notificationService = app(NotificationService::class);
        $notificationService->syncBudgetAlertsForPeriod(
            $request->user(),
            (int) substr($previousDate, 0, 4),
            (int) substr($previousDate, 5, 2),
        );
        $notificationService->syncBudgetAlertsForPeriod(
            $request->user(),
            (int) substr($date, 0, 4),
            (int) substr($date, 5, 2),
        );

        return response()->json([
            'message' => 'Transaksi berhasil diperbarui.',
            'data' => $transaction->load('budget.category'),
        ]);
    }

    public function destroy(Request $request, Transaction $transaction): JsonResponse
    {
        $transaction = $request->user()->transactions()->findOrFail($transaction->id);
        $date = $transaction->date->toDateString();
        $transaction->delete();
        app(NotificationService::class)->syncBudgetAlertsForPeriod(
            $request->user(),
            (int) substr($date, 0, 4),
            (int) substr($date, 5, 2),
        );

        return response()->json(['message' => 'Transaksi berhasil dihapus.']);
    }

    private function ensureOwnedBudget(Request $request, ?int $budgetId, ?string $date): void
    {
        if ($budgetId === null) {
            return;
        }

        $budget = Budget::query()
            ->whereKey($budgetId)
            ->whereHas('monthlyPlan', fn (Builder $query) => $query->where('user_id', $request->user()->id))
            ->with('monthlyPlan')
            ->first();

        if ($budget === null) {
            throw ValidationException::withMessages([
                'budget_id' => ['Budget yang dipilih tidak ditemukan.'],
            ]);
        }

        if ($date !== null && ($budget->monthlyPlan->year !== (int) substr($date, 0, 4) || $budget->monthlyPlan->month !== (int) substr($date, 5, 2))) {
            throw ValidationException::withMessages([
                'date' => ['Tanggal transaksi harus berada pada periode budget yang dipilih.'],
            ]);
        }
    }
}
