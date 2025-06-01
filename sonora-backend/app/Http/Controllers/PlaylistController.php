<?php

namespace App\Http\Controllers;

use App\Models\Playlist;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Track;
use App\Models\PlaylistTrack;
use Illuminate\Support\Str;


class PlaylistController extends Controller
{
    public function createDefaultPlaylists(Request $request)
    {
        $user = $request->user();

        $defaultPlaylists = [
            'liked' => 'Iemīļotas dziesmas',
            'popular' => 'Populāri',
            'fresh' => 'Jaunumi',
            'genre' => 'Žanrs'
        ];

        foreach ($defaultPlaylists as $type => $name) {
            $exists = Playlist::where('user_id', $user->id)->where('type', $type)->exists();

            if (!$exists) {
                Playlist::create([
                    'user_id' => $user->id,
                    'name' => $name,
                    'description' => '',
                    'cover_image' => null,
                    'is_public' => false,
                    'type' => $type,
                    'genre_id' => null,
                ]);
            }
        }

        return response()->json(['message' => 'Default playlists created']);
    }


    public function index(Request $request)
    {
        $user = $request->user();

        $playlists = Playlist::with('genre')
            ->where('user_id', $user->id)
            ->get()
            ->map(function ($playlist) {
                $cover = null;

                if ($playlist->type !== 'none') {
                    $cover = asset('storage/auto_playlist_photos/' . $playlist->type . '-playlist-cover.png');
                } elseif ($playlist->cover_image) {
                    $cover = asset('storage/' . $playlist->cover_image);
                }

                return [
                    'id' => $playlist->playlist_id,
                    'name' => $playlist->name,
                    'description' => $playlist->description,
                    'cover_image' => $cover,
                    'is_public' => $playlist->is_public,
                    'type' => $playlist->type,
                    'genre_id' => $playlist->genre_id,
                    'genre' => $playlist->genre?->name,
                    'identifier' => $playlist->type === 'genre' && $playlist->genre
                        ? 'genre-' . \Str::slug($playlist->genre->name) . '-' . $playlist->playlist_id
                        : $playlist->type,
                ];
            });

        return response()->json($playlists);
    }


    public function likedTracks()
    {
        $user = Auth::user();

        $tracks = Track::with(['activeVersion.stems', 'user', 'artist', 'activeVersion'])
            ->whereHas('likes', function ($q) use ($user) {
                $q->where('user_id', $user->id)
                    ->where('like_status', 'like'); // tikai kur ir like
            })
            ->get();

        $formattedTracks = $tracks->map(function ($track) {
            $version = $track->activeVersion;

            return [
                'id' => $track->id,
                'title' => $track->title,
                'cover_image' => $track->cover_image ? asset('storage/' . $track->cover_image) : null,
                'audio_file' => $version?->audio_file
                    ? url('api/stream/track/' . basename($version->audio_file))
                    : null,
                'stems' => $version?->stems?->map(function ($stem) use ($version) {
                        return [
                            'type' => $stem->stem_type,
                            'url' => url('api/stream/stems/track_' . $version->id . '/' . basename($stem->audio_file)),
                        ];
                    })->values() ?? [],
                'artist_name' => $track->artist?->username ?? $track->user?->username ?? 'Nezināms',
                'key' => $version?->key,
                'bpm' => $version?->bpm,
                'lyrics' => $version?->lyrics_visible ? $version->lyrics : null,
            ];
        });

        return response()->json([
            'playlist_name' => 'Tavs Like saraksts',
            'tracks' => $formattedTracks
        ]);
    }


    public function getTracksByPlaylist($identifier)
    {
        $user = Auth::user();

        $playlist = Playlist::where('user_id', $user->id)
            ->where(function ($q) use ($identifier) {
                if (Str::startsWith($identifier, 'genre-')) {
                    $id = (int) substr($identifier, strrpos($identifier, '-') + 1);
                    $q->where('playlist_id', $id);
                } else {
                    $q->where('playlist_id', $identifier)
                        ->orWhere('type', $identifier);
                }
            })
            ->first();

        if (!$playlist) {
            return response()->json(['message' => 'Playlist not found'], 404);
        }

        // sanemam dziesmas pec pozicijas
        $tracks = $playlist->tracks()->with(['activeVersion.stems', 'user', 'artist', 'activeVersion'])
            ->orderBy('playlist_tracks.position')
            ->get();

        $formattedTracks = $tracks->map(function ($track) {
            $version = $track->activeVersion;

            return [
                'id' => $track->id,
                'title' => $track->title,
                'cover_image' => $track->cover_image ? asset('storage/' . $track->cover_image) : null,
                'audio_file' => $version?->audio_file
                    ? url('api/stream/track/' . basename($version->audio_file))
                    : null,
                'stems' => $version?->stems?->map(function ($stem) use ($version) {
                        return [
                            'type' => $stem->stem_type,
                            'url' => url('api/stream/stems/track_' . $version->id . '/' . basename($stem->audio_file)),
                        ];
                    })->values() ?? [],
                'artist_name' => $track->artist?->username ?? $track->user?->username ?? 'Nezināms',
                'key' => $version?->key,
                'bpm' => $version?->bpm,
                'lyrics' => $version?->lyrics_visible ? $version->lyrics : null,
            ];
        });

        return response()->json([
            'playlist_name' => $playlist->name,
            'tracks' => $formattedTracks
        ]);
    }


    // lai izveidot sarakstu (queue)
    public function getByIdentifier($identifier)
    {
        $user = auth()->user();

        $playlist = \App\Models\Playlist::where('user_id', $user->id)
            ->where('identifier', $identifier)
            ->first();

        if (!$playlist) {
            return response()->json(['message' => 'Playlist not found'], 404);
        }

        return response()->json($playlist);
    }

}
