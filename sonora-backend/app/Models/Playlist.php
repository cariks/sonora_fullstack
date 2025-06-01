<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Playlist extends Model
{
    use HasFactory;

    protected $primaryKey = 'playlist_id';

    protected $fillable = [
        'user_id',
        'name',
        'description',
        'cover_image',
        'is_public',
        'type',
        'genre_id',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function tracks()
    {
        return $this->belongsToMany(Track::class, 'playlist_tracks')
            ->withPivot('position')
            ->withTimestamps();
    }

    public function genre()
    {
        return $this->belongsTo(Genre::class);
    }

    public static function createDefaultPlaylists(User $user): void
    {
        $defaultPlaylists = [
            'liked' => [
                'name' => 'Iemīļotas dziesmas',
                'description' => 'Tavas iecienītākās dziesmas vienuviet',
            ],
            'popular' => [
                'name' => 'Populāri',
                'description' => 'Šobrīd populārākās dziesmas platformā',
            ],
            'fresh' => [
                'name' => 'Jaunumi',
                'description' => 'Jaunākās dziesmas, ko noteikti ir vērts paklausīties',
            ],
        ];

        foreach ($defaultPlaylists as $type => $data) {
            self::firstOrCreate([
                'user_id' => $user->id,
                'type' => $type,
            ], [
                'name' => $data['name'],
                'description' => $data['description'],
                'is_public' => false,
                'cover_image' => null,
                'genre_id' => null,
            ]);
        }

        // Genre playlist par katru lietotфja izveleto zanru
        if ($user->favoriteGenres()->exists()) {
            foreach ($user->favoriteGenres as $genre) {
                self::firstOrCreate([
                    'user_id' => $user->id,
                    'type' => 'genre',
                    'genre_id' => $genre->id,
                ], [
                    'name' => $genre->name . ' izlase',
                    'description' => 'Dziesmas no žanra "' . $genre->name . '".',
                    'is_public' => false,
                    'cover_image' => null,
                ]);
            }
        }
    }


}
