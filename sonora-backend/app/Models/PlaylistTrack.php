<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;


class PlaylistTrack extends Model
{
    protected $table = 'playlist_tracks';

    protected $fillable = [
        'playlist_id',
        'track_id',
        'position',
    ];

    public function playlist()
    {
        return $this->belongsTo(Playlist::class);
    }

    public function track()
    {
        return $this->belongsTo(Track::class);
    }
}
