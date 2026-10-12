<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Currency extends Model
{
    protected $guarded = [];

    protected $casts = [
        'rate' => 'decimal:8',
        'is_base' => 'boolean',
        'is_active' => 'boolean',
        'is_payable' => 'boolean',
    ];

    protected static function booted(): void
    {
        // Currency codes are always stored in capitals: usd -> USD.
        static::saving(function (Currency $currency) {
            $currency->code = strtoupper(trim($currency->code));
        });
    }
}
