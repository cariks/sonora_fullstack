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
                return [
                    'id' => $playlist->playlist_id,
                    'name' => $playlist->name,
                    'description' => $playlist->description,
                    'cover_image' => $playlist->cover_image
                        ? url('storage/' . $playlist->cover_image)
                        : null,
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
            'playlist_description' => $playlist->description,
            'cover_image' => $playlist->cover_image ? asset('storage/' . $playlist->cover_image) : null,
            'type' => $playlist->type,
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

    public function store(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'title' => 'required|string|max:60',
            'description' => 'nullable|string|max:1000',
            'is_public' => 'required|boolean',
            'cover' => 'nullable|image|mimes:jpeg,png|max:10240',
        ]);

        $coverPath = null;
        if ($request->hasFile('cover')) {
            $coverPath = $request->file('cover')->store('playlist_covers', 'public');
        }

        $playlist = Playlist::create([
            'user_id' => $user->id,
            'name' => $request->title,
            'description' => $request->description,
            'is_public' => $request->is_public,
            'cover_image' => $coverPath,
        ]);

        return response()->json(['message' => 'Playlist created', 'playlist' => $playlist]);
    }

    public function getPlaylistsForTrack($trackId)
    {
        $user = Auth::user();

        $playlists = Playlist::where('user_id', $user->id)->get();

        $includedPlaylists = PlaylistTrack::where('track_id', $trackId)
            ->pluck('playlist_id')
            ->toArray();

        return response()->json([
            'playlists' => $playlists->map(function ($playlist) use ($includedPlaylists) {
                return [
                    'id' => $playlist->playlist_id,
                    'name' => $playlist->name,
                    'type' => $playlist->type,
                    'cover_image' => $playlist->cover_image ? asset('storage/' . $playlist->cover_image) : null,
                    'included' => in_array($playlist->playlist_id, $includedPlaylists)
                ];
            })
        ]);
    }

    public function destroy($id)
    {
        $user = Auth::user();

        $playlist = Playlist::where('playlist_id', $id)
            ->where('user_id', $user->id)
            ->first();

        if (!$playlist) {
            return response()->json(['message' => 'Playlist not found'], 404);
        }

        PlaylistTrack::where('playlist_id', $id)->delete();

        $playlist->delete();

        return response()->json(['message' => 'Playlist deleted successfully']);
    }



}
