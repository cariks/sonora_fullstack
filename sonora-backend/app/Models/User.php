<?php

namespace App\Models;
use App\Models\Photo;
// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Relations\HasOne;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'username',
        'email',
        'password',
        'display_name',
        'date_of_birth',
        'bio',
        'role',
        'verified',
        'last_online',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    public function primaryPhoto(): HasOne
    {
        return $this->hasOne(\App\Models\Photo::class)->where('is_primary', true);
    }

    public function favoriteGenres()
    {
        return $this->belongsToMany(Genre::class, 'user_favorite_genres', 'user_id', 'genre_id')
            ->withPivot('weight')
            ->withTimestamps();
    }

    public function favoriteArtists()
    {
        return $this->belongsToMany(User::class, 'user_favorite_artists', 'user_id', 'artist_id')
            ->withPivot('weight')
            ->withTimestamps();
    }

    public function artistGenres()
    {
        return $this->belongsToMany(Genre::class, 'artist_genres', 'artist_id', 'genre_id')
            ->withTimestamps();
    }

    //  QUEUE!
    public function playbackQueue()
    {
        return $this->hasMany(\App\Models\UserPlaybackQueue::class)->orderBy('position');
    }

    public function playbackStatus()
    {
        return $this->hasOne(\App\Models\PlaybackStatus::class);
    }
}
