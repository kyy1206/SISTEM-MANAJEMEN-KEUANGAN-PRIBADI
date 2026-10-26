<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SubscriptionControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_subscription_is_created_and_monthly_summary_is_calculated(): void
    {
        $this->travelTo('2026-10-17 10:00:00');
        $user = User::factory()->create();
        $user->monthlyPlans()->create([
            'month' => 10,
            'year' => 2026,
            'total_budget' => 1000000,
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/subscriptions', [
            'name' => 'Netflix Standard',
            'category' => 'Hiburan',
            'amount' => 186000,
            'billing_cycle' => 'monthly',
            'due_date' => '2026-10-20',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'active');

        $this->postJson('/api/subscriptions', [
            'name' => 'Cloud Storage',
            'category' => 'Produktivitas',
            'amount' => 120000,
            'billing_cycle' => 'yearly',
            'due_date' => '2026-10-24',
        ])->assertCreated();

        $this->getJson('/api/subscriptions')->assertOk()
            ->assertJsonPath('summary.monthly_total', 196000)
            ->assertJsonPath('summary.active_count', 2)
            ->assertJsonPath('summary.monthly_budget_share', 19.6)
            ->assertJsonPath('summary.next_due.name', 'Netflix Standard')
            ->assertJsonCount(2, 'summary.due_soon')
            ->assertJsonPath('summary.category_breakdown.0.category', 'Hiburan');

        $this->assertDatabaseHas('subscriptions', [
            'user_id' => $user->id,
            'name' => 'Netflix Standard',
            'category' => 'Hiburan',
            'status' => 'active',
        ]);
    }

    public function test_subscription_filter_does_not_change_the_summary_totals(): void
    {
        $this->travelTo('2026-10-17 10:00:00');
        $user = User::factory()->create();
        $user->subscriptions()->create([
            'name' => 'Netflix',
            'category' => 'Hiburan',
            'amount' => 100000,
            'billing_cycle' => 'monthly',
            'due_date' => '2026-10-20',
            'status' => 'active',
        ]);
        $user->subscriptions()->create([
            'name' => 'Spotify',
            'category' => 'Hiburan',
            'amount' => 50000,
            'billing_cycle' => 'monthly',
            'due_date' => '2026-10-22',
            'status' => 'active',
        ]);
        Sanctum::actingAs($user);

        $this->getJson('/api/subscriptions?search=Netflix')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('summary.monthly_total', 150000)
            ->assertJsonPath('summary.active_count', 2);
    }

    public function test_subscription_can_be_updated_paused_and_deleted(): void
    {
        $user = User::factory()->create();
        $subscription = $user->subscriptions()->create([
            'name' => 'Music',
            'category' => 'Hiburan',
            'amount' => 50000,
            'billing_cycle' => 'monthly',
            'due_date' => '2026-10-25',
            'status' => 'active',
        ]);
        Sanctum::actingAs($user);

        $this->putJson("/api/subscriptions/{$subscription->id}", [
            'amount' => 60000,
            'status' => 'inactive',
        ])->assertOk()
            ->assertJsonPath('data.amount', '60000.00')
            ->assertJsonPath('data.status', 'inactive');

        $this->deleteJson("/api/subscriptions/{$subscription->id}")->assertOk();

        $this->assertDatabaseMissing('subscriptions', ['id' => $subscription->id]);
    }

    public function test_user_cannot_view_or_edit_another_users_subscription(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        $subscription = $owner->subscriptions()->create([
            'name' => 'Private plan',
            'category' => 'Hiburan',
            'amount' => 50000,
            'billing_cycle' => 'monthly',
            'due_date' => '2026-10-25',
            'status' => 'active',
        ]);
        Sanctum::actingAs($otherUser);

        $this->getJson("/api/subscriptions/{$subscription->id}")->assertNotFound();
        $this->putJson("/api/subscriptions/{$subscription->id}", ['name' => 'Hijacked'])->assertNotFound();

        $this->assertDatabaseHas('subscriptions', [
            'id' => $subscription->id,
            'user_id' => $owner->id,
            'name' => 'Private plan',
        ]);
    }

    public function test_subscription_rejects_invalid_amount_cycle_and_date(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/subscriptions', [
            'name' => 'Invalid plan',
            'category' => 'Hiburan',
            'amount' => 10.001,
            'billing_cycle' => 'weekly',
            'due_date' => '17-10-2026',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['amount', 'billing_cycle', 'due_date']);

        $this->assertDatabaseCount('subscriptions', 0);
    }

    public function test_unauthenticated_subscription_requests_receive_401(): void
    {
        $this->getJson('/api/subscriptions')->assertUnauthorized();
    }
}
