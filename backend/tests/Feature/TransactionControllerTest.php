<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TransactionControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_transaction_is_created_for_the_authenticated_user(): void
    {
        $user = User::factory()->create();
        $category = $user->categories()->create(['name' => 'Makan']);
        $plan = $user->monthlyPlans()->create([
            'month' => 10,
            'year' => 2026,
            'total_budget' => 100000,
        ]);
        $budget = $plan->budgets()->create(['category_id' => $category->id, 'amount' => 100000]);
        Sanctum::actingAs($user);

        $this->postJson('/api/transactions', [
            'budget_id' => $budget->id,
            'amount' => 25000,
            'description' => 'Makan siang',
            'date' => '2026-10-16',
            'merchant' => 'Warteg',
            'payment_method' => 'Cash',
        ])->assertCreated()
            ->assertJsonPath('data.amount', '25000.00')
            ->assertJsonPath('data.status', 'completed');

        $this->assertDatabaseHas('transactions', [
            'user_id' => $user->id,
            'budget_id' => $budget->id,
            'amount' => 25000,
            'description' => 'Makan siang',
            'source' => 'manual',
            'status' => 'completed',
        ]);
    }

    public function test_ocr_transactions_keep_their_recording_source(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/transactions', [
            'amount' => 28000,
            'date' => '2026-10-17',
            'source' => 'ocr',
        ])->assertCreated()
            ->assertJsonPath('data.source', 'ocr');

        $this->assertDatabaseHas('transactions', [
            'user_id' => $user->id,
            'source' => 'ocr',
        ]);
    }

    public function test_transaction_cannot_use_another_users_budget(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        $category = $owner->categories()->create(['name' => 'Makan']);
        $plan = $owner->monthlyPlans()->create([
            'month' => 10,
            'year' => 2026,
            'total_budget' => 100000,
        ]);
        $budget = $plan->budgets()->create(['category_id' => $category->id, 'amount' => 100000]);
        Sanctum::actingAs($otherUser);

        $this->postJson('/api/transactions', [
            'budget_id' => $budget->id,
            'amount' => 25000,
            'date' => '2026-10-16',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('budget_id');

        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_transaction_date_must_match_the_selected_budget_period(): void
    {
        $user = User::factory()->create();
        $category = $user->categories()->create(['name' => 'Makan']);
        $plan = $user->monthlyPlans()->create([
            'month' => 10,
            'year' => 2026,
            'total_budget' => 100000,
        ]);
        $budget = $plan->budgets()->create(['category_id' => $category->id, 'amount' => 100000]);
        Sanctum::actingAs($user);

        $this->postJson('/api/transactions', [
            'budget_id' => $budget->id,
            'amount' => 25000,
            'date' => '2026-09-30',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('date');

        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_transaction_from_another_user_is_not_returned(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        $transaction = $owner->transactions()->create([
            'amount' => 25000,
            'date' => '2026-10-16',
            'description' => 'Private transaction',
            'status' => 'completed',
        ]);
        Sanctum::actingAs($otherUser);

        $this->getJson("/api/transactions/{$transaction->id}")->assertNotFound();
        $this->getJson('/api/transactions')->assertOk()
            ->assertJsonPath('data.total', 0);
    }

    public function test_unauthenticated_transaction_requests_receive_401(): void
    {
        $this->postJson('/api/transactions', [])->assertUnauthorized();
    }

    public function test_transaction_list_filters_by_category_and_allows_a_date_to_only_filter(): void
    {
        $user = User::factory()->create();
        $food = $user->categories()->create(['name' => 'Makan']);
        $transport = $user->categories()->create(['name' => 'Transportasi']);
        $plan = $user->monthlyPlans()->create([
            'month' => 10,
            'year' => 2026,
            'total_budget' => 200000,
        ]);
        $foodBudget = $plan->budgets()->create(['category_id' => $food->id, 'amount' => 100000]);
        $transportBudget = $plan->budgets()->create(['category_id' => $transport->id, 'amount' => 100000]);
        $user->transactions()->create([
            'budget_id' => $foodBudget->id,
            'amount' => 25000,
            'date' => '2026-10-15',
            'description' => 'Lunch',
            'status' => 'completed',
        ]);
        $user->transactions()->create([
            'budget_id' => $transportBudget->id,
            'amount' => 15000,
            'date' => '2026-10-16',
            'description' => 'Bus',
            'status' => 'completed',
        ]);
        Sanctum::actingAs($user);

        $this->getJson("/api/transactions?category_id={$food->id}&date_to=2026-10-15")
            ->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.budget.category.name', 'Makan');
    }

    public function test_transaction_amount_rejects_more_than_two_decimal_places(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/transactions', [
            'amount' => 10.001,
            'date' => '2026-10-16',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('amount');

        $this->assertDatabaseCount('transactions', 0);
    }
}
