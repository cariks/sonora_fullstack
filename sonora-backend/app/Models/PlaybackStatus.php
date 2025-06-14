<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PlaybackStatus extends Model
{
    protected $table = 'playback_status';

    protected $fillable = [
        'user_id',
        'track_id',
        'current_time',
        'play_mode',
        'source_type',
        'source_id',
        'source_name',
    ];

    protected $casts = [
        'current_time' => 'float',
        'source_id' => 'integer'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function track()
    {
        return $this->belongsTo(Track::class);
    }
}
