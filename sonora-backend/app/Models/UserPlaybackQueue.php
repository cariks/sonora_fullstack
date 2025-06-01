<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserPlaybackQueue extends Model
{
    protected $table = 'user_playback_queue';

    protected $fillable = ['user_id', 'track_id', 'position'];

    public function track()
    {
        return $this->belongsTo(Track::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
