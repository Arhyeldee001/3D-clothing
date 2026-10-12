<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('currencies', function (Blueprint $table) {
            $table->id();
            $table->string('code', 3)->unique();      // NGN, USD, GHS...
            $table->string('name');                   // Nigerian Naira
            // How many units of this currency equal 1 unit of the base currency.
            // Example: if the base is NGN and 1 USD = 1,500 NGN, the USD rate is 0.00066667.
            $table->decimal('rate', 18, 8)->default(1);
            $table->boolean('is_base')->default(false);   // product prices are entered in this currency
            $table->boolean('is_active')->default(true);  // shown to customers
            $table->boolean('is_payable')->default(false); // can be charged at checkout (must be enabled on Paystack)
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        // Nigerian Naira is the starting base currency.
        DB::table('currencies')->insert([
            'code' => 'NGN',
            'name' => 'Nigerian Naira',
            'rate' => 1,
            'is_base' => true,
            'is_active' => true,
            'is_payable' => true,
            'sort_order' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('currencies');
    }
};
