<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\StoreController;
use App\Http\Controllers\CurrencyController;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/api/sections', [StoreController::class, 'sections']);
Route::get('/api/models/{asset}', [StoreController::class, 'model']);
Route::get('/api/currencies', [CurrencyController::class, 'index']);
