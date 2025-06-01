<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Track extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';

    protected $fillable = [
        'user_id',
        'artist_id',
        'title',
        'description',
        'cover_image',
        'is_public',
        'album_id',
        'release_date',
        'active_version',
        'likes_count',
        'total_streams',
        'is_reported',
        'uploaded_at',
    ];

    public function activeVersion()
    {
        return $this->belongsTo(TrackVersion::class, 'active_version');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function artist()
    {
        return $this->belongsTo(User::class, 'artist_id');
    }

    public function likes()
    {
        return $this->hasMany(\App\Models\TrackLike::class);
    }
}
