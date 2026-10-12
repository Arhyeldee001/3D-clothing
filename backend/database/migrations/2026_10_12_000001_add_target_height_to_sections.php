<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sections', function (Blueprint $table) {
            // How tall products in this section appear in the 3D scene.
            // Shirts look right at about 1.1, shoes at about 0.5, small bags at about 0.6.
            $table->decimal('target_height', 4, 2)->default(1.10)->after('display_style');
        });
    }

    public function down(): void
    {
        Schema::table('sections', function (Blueprint $table) {
            $table->dropColumn('target_height');
        });
    }
};
