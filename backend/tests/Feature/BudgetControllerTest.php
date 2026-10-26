<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BudgetControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_category_budget_is_created_and_persisted(): void
    {
        $user = User::factory()->create();
        $category = $user->categories()->create(['name' => 'Transportasi']);
        $plan = $user->monthlyPlans()->create([
            'month' => 10,
            'year' => 2026,
            'total_budget' => 500000,
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/budgets', [
            'monthly_plan_id' => $plan->id,
            'category_id' => $category->id,
            'amount' => 200000,
        ])->assertCreated()
            ->assertJsonPath('data.amount', '200000.00');

        $this->assertDatabaseHas('budgets', [
            'monthly_plan_id' => $plan->id,
            'category_id' => $category->id,
            'amount' => 200000,
        ]);
    }

    public function test_category_budget_cannot_exceed_the_monthly_plan_total(): void
    {
        $user = User::factory()->create();
        $category = $user->categories()->create(['name' => 'Makan']);
        $plan = $user->monthlyPlans()->create([
            'month' => 10,
            'year' => 2026,
            'total_budget' => 100000,
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/budgets', [
            'monthly_plan_id' => $plan->id,
            'category_id' => $category->id,
            'amount' => 100001,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('amount');

        $this->assertDatabaseCount('budgets', 0);
    }

    public function test_budget_of_another_user_is_not_found_for_update(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        $category = $owner->categories()->create(['name' => 'Makan']);
        $plan = $owner->monthlyPlans()->create([
            'month' => 10,
            'year' => 2026,
            'total_budget' => 100000,
        ]);
        $budget = $plan->budgets()->create(['category_id' => $category->id, 'amount' => 50000]);
        Sanctum::actingAs($otherUser);

        $this->putJson("/api/budgets/{$budget->id}", ['amount' => 40000])->assertNotFound();
    }

    public function test_budget_list_cannot_be_read_from_another_users_plan(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        $plan = $owner->monthlyPlans()->create([
            'month' => 10,
            'year' => 2026,
            'total_budget' => 100000,
        ]);
        Sanctum::actingAs($otherUser);

        $this->getJson("/api/budgets?monthly_plan_id={$plan->id}")->assertNotFound();
    }

    public function test_budget_amount_rejects_more_than_two_decimal_places(): void
    {
        $user = User::factory()->create();
        $category = $user->categories()->create(['name' => 'Makan']);
        $plan = $user->monthlyPlans()->create([
            'month' => 10,
            'year' => 2026,
            'total_budget' => 100000,
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/budgets', [
            'monthly_plan_id' => $plan->id,
            'category_id' => $category->id,
            'amount' => 10.001,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('amount');

        $this->assertDatabaseCount('budgets', 0);
    }
}
