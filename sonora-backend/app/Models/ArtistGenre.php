<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Pivot;


class ArtistGenre extends Pivot
{
    protected $table = 'artist_genres';

    protected $fillable = ['artist_id', 'genre_id'];

    public $timestamps = true;
}
