<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index(Request $request)
    {
        $categories = $request->user()->categories()
            ->withCount('budgets')
            ->orderBy('name')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $categories,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('categories', 'name')->where('user_id', $request->user()->id)],
            'icon' => ['sometimes', 'string', 'max:24'],
            'color' => ['sometimes', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        $category = $request->user()->categories()->create($validated + [
            'icon' => 'tag',
            'color' => '#4f46e5',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Kategori berhasil ditambahkan',
            'data' => $category,
        ], 201);
    }

    public function show(Request $request, Category $category)
    {
        $category = $this->ownedCategory($request, $category);

        return response()->json([
            'status' => 'success',
            'data' => $category,
        ]);
    }

    public function update(Request $request, Category $category)
    {
        $category = $this->ownedCategory($request, $category);

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('categories', 'name')
                    ->where('user_id', $request->user()->id)
                    ->ignore($category->id),
            ],
            'icon' => ['sometimes', 'string', 'max:24'],
            'color' => ['sometimes', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        $category->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Kategori berhasil diperbarui',
            'data' => $category,
        ]);
    }

    public function destroy(Request $request, Category $category)
    {
        $category = $this->ownedCategory($request, $category);

        if ($category->budgets()->exists()) {
            return response()->json([
                'message' => 'Kategori masih digunakan oleh budget. Hapus alokasi budget terlebih dahulu.',
            ], 409);
        }

        $category->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Kategori berhasil dihapus',
        ]);
    }

    private function ownedCategory(Request $request, Category $category): Category
    {
        return $request->user()->categories()->findOrFail($category->id);
    }
}
