<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CategoryControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_category_owned_by_another_user_is_not_found_for_read_or_write(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        $category = $owner->categories()->create(['name' => 'Private category']);
        Sanctum::actingAs($otherUser);

        $this->getJson("/api/categories/{$category->id}")->assertNotFound();
        $this->putJson("/api/categories/{$category->id}", ['name' => 'Changed'])->assertNotFound();
        $this->deleteJson("/api/categories/{$category->id}")->assertNotFound();

        $this->assertDatabaseHas('categories', [
            'id' => $category->id,
            'user_id' => $owner->id,
            'name' => 'Private category',
        ]);
    }

    public function test_category_can_be_created_and_updated_with_visual_metadata(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/categories', [
            'name' => 'Transportasi',
            'icon' => 'car',
            'color' => '#0f766e',
            'description' => 'Biaya perjalanan harian',
        ])->assertCreated()
            ->assertJsonPath('data.icon', 'car')
            ->assertJsonPath('data.color', '#0f766e');

        $category = $user->categories()->firstOrFail();
        $this->putJson("/api/categories/{$category->id}", [
            'name' => 'Transport',
            'icon' => 'bus',
            'color' => '#14b8a6',
        ])->assertOk()
            ->assertJsonPath('data.name', 'Transport')
            ->assertJsonPath('data.icon', 'bus');
    }

    public function test_category_name_must_be_unique_per_user(): void
    {
        $user = User::factory()->create();
        $user->categories()->create(['name' => 'Makan']);
        Sanctum::actingAs($user);

        $this->postJson('/api/categories', ['name' => 'Makan'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_category_in_use_by_a_budget_cannot_be_deleted(): void
    {
        $user = User::factory()->create();
        $category = $user->categories()->create(['name' => 'Makan']);
        $plan = $user->monthlyPlans()->create([
            'month' => 10,
            'year' => 2026,
            'total_budget' => 500000,
        ]);
        $plan->budgets()->create(['category_id' => $category->id, 'amount' => 200000]);
        Sanctum::actingAs($user);

        $this->deleteJson("/api/categories/{$category->id}")->assertStatus(409);

        $this->assertDatabaseHas('categories', ['id' => $category->id]);
    }

    public function test_category_rejects_an_invalid_color_value(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/categories', [
            'name' => 'Custom',
            'color' => 'red; background:url(x)',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('color');

        $this->assertDatabaseCount('categories', 0);
    }
}
