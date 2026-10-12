<?php

namespace App\Http\Controllers;

use App\Models\Currency;

class CurrencyController extends Controller
{
    /** The currencies the admin has switched on, for the website's price selector. */
    public function index()
    {
        return response()->json(
            Currency::query()
                ->where('is_active', true)
                ->orderByDesc('is_base')
                ->orderBy('sort_order')
                ->get()
                ->map(fn ($currency) => [
                    'code' => $currency->code,
                    'name' => $currency->name,
                    'rate' => (float) $currency->rate,
                    'is_base' => $currency->is_base,
                    'is_payable' => $currency->is_payable,
                ])
                ->values()
        );
    }
}
