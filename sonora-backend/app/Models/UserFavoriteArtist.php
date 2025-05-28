<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserFavoriteArtist extends Model
{
    protected $table = 'user_favorite_artists';
    protected $fillable = ['user_id', 'artist_id', 'weight'];
}
