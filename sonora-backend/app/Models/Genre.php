<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Genre extends Model
{
    protected $fillable = ['name', 'description', 'weight'];

    public function users()
    {
        return $this->belongsToMany(User::class, 'user_favorite_genres', 'genre_id', 'user_id')
            ->withPivot('weight')
            ->withTimestamps();
    }

    public function artists()
    {
        return $this->belongsToMany(User::class, 'artist_genres', 'genre_id', 'artist_id')
            ->withTimestamps();
    }
}
