<?php

namespace App\Http\Controllers;

use App\Models\ModelAsset;
use App\Models\Section;
use Illuminate\Support\Facades\Storage;

class StoreController extends Controller
{
    /**
     * Everything the website needs to draw the store:
     * active sections, their active products, sizes/colours, and 3D file links.
     */
    public function sections()
    {
        $sections = Section::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->with(['products' => function ($products) {
                $products->where('is_active', true)
                    ->with([
                        'variants',
                        'modelAssets' => fn ($assets) => $assets->where('status', 'approved'),
                    ]);
            }])
            ->get();

        return response()->json($sections->map(function ($section) {
            return [
                'id' => $section->id,
                'name' => $section->name,
                'slug' => $section->slug,
                'display_style' => $section->display_style,
                'target_height' => (float) ($section->target_height ?? 1.1),
                'products' => $section->products->map(function ($product) {
                    $asset = $product->modelAssets->first();

                    return [
                        'id' => $product->id,
                        'name' => $product->name,
                        'slug' => $product->slug,
                        'description' => $product->description,
                        'price' => (float) $product->price,
                        'model_url' => $asset ? url("/api/models/{$asset->id}") : null,
                        'poster_url' => ($asset && $asset->poster_path)
                            ? url(Storage::url($asset->poster_path))
                            : null,
                        'variants' => $product->variants->map(fn ($variant) => [
                            'id' => $variant->id,
                            'sku' => $variant->sku,
                            'size' => $variant->size,
                            'color_name' => $variant->color_name,
                            'color_hex' => $variant->color_hex,
                            'stock' => $variant->stock,
                            'price' => (float) ($variant->price_override ?? $product->price),
                        ])->values(),
                    ];
                })->values(),
            ];
        })->values());
    }

    /**
     * Sends an approved 3D file to the website. Going through this route
     * (instead of the raw storage link) lets the browser load it from the
     * React site without cross-origin errors.
     */
    public function model(ModelAsset $asset)
    {
        abort_unless($asset->status === 'approved', 404);

        $path = Storage::disk('public')->path($asset->file_path);
        abort_unless(is_file($path), 404);

        return response()->file($path, [
            'Content-Type' => 'model/gltf-binary',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}