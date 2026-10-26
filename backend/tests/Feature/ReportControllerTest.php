<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReportControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_report_returns_monthly_category_and_daily_spending_for_the_user(): void
    {
        $user = User::factory()->create();
        $category = $user->categories()->create(['name' => 'Makan']);
        $plan = $user->monthlyPlans()->create([
            'month' => 10,
            'year' => 2026,
            'total_budget' => 500000,
        ]);
        $budget = $plan->budgets()->create(['category_id' => $category->id, 'amount' => 400000]);
        $user->transactions()->create([
            'budget_id' => $budget->id,
            'amount' => 120000,
            'date' => '2026-10-15',
            'status' => 'completed',
        ]);
        $user->transactions()->create([
            'amount' => 30000,
            'date' => '2026-10-15',
            'status' => 'completed',
        ]);
        $user->transactions()->create([
            'amount' => 90000,
            'date' => '2026-10-16',
            'status' => 'pending',
        ]);
        Sanctum::actingAs($user);

        $this->getJson('/api/reports?year=2026&month=10')->assertOk()
            ->assertJsonPath('data.summary.year_total', 150000)
            ->assertJsonPath('data.summary.selected_month_total', 150000)
            ->assertJsonPath('data.summary.selected_month_budget', 500000)
            ->assertJsonPath('data.summary.budget_variance', 350000)
            ->assertJsonCount(12, 'data.monthly_spending')
            ->assertJsonPath('data.category_spending.0.category', 'Makan')
            ->assertJsonPath('data.category_spending.1.category', 'Tanpa kategori')
            ->assertJsonCount(1, 'data.daily_spending');
    }

    public function test_report_data_is_isolated_between_users(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        $owner->transactions()->create([
            'amount' => 100000,
            'date' => '2026-10-15',
            'status' => 'completed',
        ]);
        Sanctum::actingAs($otherUser);

        $this->getJson('/api/reports?year=2026&month=10')->assertOk()
            ->assertJsonPath('data.summary.year_total', 0)
            ->assertJsonPath('data.summary.selected_month_total', 0);
    }

    public function test_report_rejects_invalid_month_and_year(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/reports?year=1999&month=13')->assertUnprocessable()
            ->assertJsonValidationErrors(['year', 'month']);
    }
}
