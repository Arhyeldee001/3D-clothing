<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CustomerAuthController;
use App\Http\Controllers\CustomerDataController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/customer/register', [CustomerAuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/customer/login', [CustomerAuthController::class, 'login'])->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/customer/me', [CustomerAuthController::class, 'me']);
    Route::post('/customer/logout', [CustomerAuthController::class, 'logout']);

    Route::get('/customer/wishlist', [CustomerDataController::class, 'wishlist']);
    Route::post('/customer/wishlist/{product}', [CustomerDataController::class, 'addWishlist']);
    Route::delete('/customer/wishlist/{product}', [CustomerDataController::class, 'removeWishlist']);

    Route::get('/customer/cart', [CustomerDataController::class, 'cart']);
    Route::put('/customer/cart', [CustomerDataController::class, 'saveCart']);
});