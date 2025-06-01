<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PlaybackStatus extends Model
{
    protected $fillable = [
        'user_id', 'track_id', 'current_time', 'is_playing', 'play_mode'
    ];

    public function track()
    {
        return $this->belongsTo(Track::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
