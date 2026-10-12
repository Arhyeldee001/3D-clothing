<?php

namespace App\Models;

use App\Services\GlbInspector;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class ModelAsset extends Model
{
    protected $guarded = [];

    protected static function booted(): void
    {
        // Every time a new or changed file is saved, check it automatically.
        static::saving(function (ModelAsset $asset) {
            if ($asset->file_path && (! $asset->exists || $asset->isDirty('file_path'))) {
                $report = GlbInspector::inspect(Storage::disk('public')->path($asset->file_path));

                $asset->file_size_bytes = $report['bytes'];
                $asset->triangle_count = $report['triangles'];
                $asset->status = $report['status'];
                $asset->notes = implode("\n", $report['notes']);
            }
        });
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
