<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A section is a part of the store: Shirts, Trousers, Shoes, Bags...
        // New sections are just new rows, so no code change is needed to add one.
        Schema::create('sections', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            // How the website shows this section in 3D: rack, turntable or shelf.
            $table->string('display_style')->default('rack');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // A product is one design, for example "Hooped Polo".
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('section_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // A variant is one buyable item: a size and colour of a product, with its own stock.
        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('sku')->unique();
            $table->string('size')->nullable();
            $table->string('color_name')->nullable();
            $table->string('color_hex', 7)->nullable();
            $table->unsignedInteger('stock')->default(0);
            // Leave empty to use the product price.
            $table->decimal('price_override', 10, 2)->nullable();
            $table->timestamps();
        });

        // A 3D file belonging to a product. Phase 2 adds the upload checks.
        Schema::create('model_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('file_path');
            $table->string('poster_path')->nullable();
            $table->unsignedBigInteger('file_size_bytes')->nullable();
            $table->unsignedInteger('triangle_count')->nullable();
            // pending, approved or rejected
            $table->string('status')->default('pending');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('model_assets');
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('products');
        Schema::dropIfExists('sections');
    }
};
