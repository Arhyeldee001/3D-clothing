<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerDataController extends Controller
{
    public function wishlist(Request $request)
    {
        return response()->json([
            'product_ids' => $request->user()->wishlist()->pluck('products.id')->values(),
        ]);
    }

    public function addWishlist(Request $request, Product $product)
    {
        $request->user()->wishlist()->syncWithoutDetaching([$product->id]);

        return response()->json(['ok' => true]);
    }

    public function removeWishlist(Request $request, Product $product)
    {
        $request->user()->wishlist()->detach($product->id);

        return response()->json(['ok' => true]);
    }

    public function cart(Request $request)
    {
        return response()->json([
            'items' => $request->user()->cartItems()->get()->map(fn ($item) => [
                'variant_id' => $item->product_variant_id,
                'qty' => $item->qty,
            ])->values(),
        ]);
    }

    /** Replaces the saved cart with the one the website sends. */
    public function saveCart(Request $request)
    {
        $data = $request->validate([
            'items' => ['present', 'array', 'max:100'],
            'items.*.variant_id' => ['required', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:99'],
        ]);

        // Combine duplicates, and quietly drop variants that no longer exist.
        $wanted = collect($data['items'])
            ->groupBy('variant_id')
            ->map(fn ($group) => min(99, (int) $group->sum('qty')));

        $existing = ProductVariant::whereIn('id', $wanted->keys())->pluck('id');

        DB::transaction(function () use ($request, $wanted, $existing) {
            $customer = $request->user();
            $customer->cartItems()->delete();

            foreach ($existing as $variantId) {
                $customer->cartItems()->create([
                    'product_variant_id' => $variantId,
                    'qty' => $wanted[$variantId],
                ]);
            }
        });

        return response()->json(['ok' => true]);
    }
}
