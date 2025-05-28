<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserFavoriteGenre extends Model
{
    protected $table = 'user_favorite_genres';
    protected $fillable = ['user_id', 'genre_id', 'weight'];
}
