<?php

namespace App\Http\Controllers;

use App\Models\Playlist;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Track;

class UserController extends Controller
{
    public function showByUsername($username)
    {
        $user = User::with('primaryPhoto')->where('username', $username)->firstOrFail();

        return response()->json([
            'username' => $user->username,
            'display_name' => $user->display_name ?? $user->username,
            'name' => $user->name,
            'surname' => $user->surname,
            'role' => $user->role,
            'bio' => $user->bio,
            'subscribers_count' => 0,
            'photo' => $user->primaryPhoto?->photo_url
                ? asset($user->primaryPhoto->photo_url)
                : null,
        ]);
    }

    public function publicPlaylists($username)
    {
        $user = User::where('username', $username)->firstOrFail();
        return Playlist::where('user_id', $user->id)
            ->where('type', 'manual')
            ->where('is_public', true)
            ->get();
    }

    public function publicTracks($username)
    {
        $user = User::where('username', $username)->firstOrFail();

        $tracks = Track::with(['activeVersion.stems', 'activeVersion', 'user', 'artist'])
            ->where('artist_id', $user->id)
            ->where('is_public', true)
            ->get();

        return response()->json($tracks->map(function ($track) {
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
        }));
    }

}
