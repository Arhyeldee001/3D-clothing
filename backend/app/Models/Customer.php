<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class Customer extends Authenticatable
{
    use HasApiTokens;

    protected $guarded = [];

    protected $hidden = ['password'];

    protected $casts = [
        'password' => 'hashed',
    ];

    public function wishlist(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'wishlist_items')->withTimestamps();
    }

    public function cartItems(): HasMany
    {
        return $this->hasMany(CartItem::class);
    }
}