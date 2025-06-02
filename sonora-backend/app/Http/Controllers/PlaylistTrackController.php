<?php

namespace App\Http\Controllers;

use App\Models\Playlist;
use App\Models\PlaylistTrack;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PlaylistTrackController extends Controller
{
    public function addToPlaylist(Request $request)
    {
        $user = $request->user();
        $trackId = $request->input('track_id');
        $playlistId = $request->input('playlist_id');

        $playlist = Playlist::where('user_id', $user->id)
            ->where('playlist_id', $playlistId)
            ->firstOrFail();

        $exists = PlaylistTrack::where('playlist_id', $playlistId)
            ->where('track_id', $trackId)
            ->exists();

        if (!$exists) {
            $maxPosition = PlaylistTrack::where('playlist_id', $playlistId)->max('position') ?? 0;

            PlaylistTrack::create([
                'playlist_id' => $playlistId,
                'track_id' => $trackId,
                'position' => $maxPosition + 1,
            ]);


            if ($playlist->type === 'liked') {
                \App\Models\TrackLike::updateOrCreate(
                    ['user_id' => $user->id, 'track_id' => $trackId],
                    ['like_status' => 'like']
                );
            }
        }

        return response()->json(['message' => 'Track added']);
    }


    public function removeFromPlaylist(Request $request)
    {
        $user = $request->user();
        $trackId = $request->input('track_id');
        $playlistId = $request->input('playlist_id');

        $playlist = Playlist::where('user_id', $user->id)
            ->where('playlist_id', $playlistId)
            ->firstOrFail();

        PlaylistTrack::where('playlist_id', $playlistId)
            ->where('track_id', $trackId)
            ->delete();

        if ($playlist->type === 'liked') {
            \App\Models\TrackLike::where('user_id', $user->id)
                ->where('track_id', $trackId)
                ->delete();
        }

        return response()->json(['message' => 'Track removed']);
    }


    public function getTracksByPlaylist(Request $request, $identifier)
    {
        $user = $request->user();

        $playlist = Playlist::where('user_id', $user->id)
            ->where(function ($q) use ($identifier) {
                $q->where('type', $identifier)
                    ->orWhere('playlist_id', $identifier);
            })
            ->firstOrFail();

        $playlistTracks = PlaylistTrack::with(['track.activeVersion.stems', 'track.user', 'track.artist', 'track.activeVersion'])
            ->where('playlist_id', $playlist->playlist_id)
            ->orderBy('position')
            ->get();

        $tracks = $playlistTracks->map(function ($pt) {
            $track = $pt->track;
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
            'tracks' => $tracks,
        ]);
    }

    public function getPlaylistsForTrack(Request $request, $trackId)
    {
        $user = $request->user();

        $playlistIds = \App\Models\PlaylistTrack::whereHas('playlist', function ($query) use ($user) {
            $query->where('user_id', $user->id);
        })
            ->where('track_id', $trackId)
            ->pluck('playlist_id');

        return response()->json($playlistIds);
    }

    public function addTrackToPlaylist($playlistId, $trackId)
    {
        $user = auth()->user();

        $playlist = \App\Models\Playlist::where('user_id', $user->id)->where('playlist_id', $playlistId)->firstOrFail();

        $alreadyExists = \App\Models\PlaylistTrack::where('playlist_id', $playlistId)
            ->where('track_id', $trackId)
            ->exists();

        if (!$alreadyExists) {
            $maxPosition = \App\Models\PlaylistTrack::where('playlist_id', $playlistId)->max('position') ?? 0;

            \App\Models\PlaylistTrack::create([
                'playlist_id' => $playlistId,
                'track_id' => $trackId,
                'position' => $maxPosition + 1,
            ]);

            if ($playlist->type === 'liked') {
                // arī uzlikt like status
                \App\Models\TrackLike::updateOrCreate(
                    ['user_id' => $user->id, 'track_id' => $trackId],
                    ['like_status' => 'like']
                );
            }
        }

        return response()->json(['message' => 'Track added']);
    }

    public function removeTrackFromPlaylist($playlistId, $trackId)
    {
        $user = auth()->user();

        $playlist = \App\Models\Playlist::where('user_id', $user->id)->where('playlist_id', $playlistId)->firstOrFail();

        \App\Models\PlaylistTrack::where('playlist_id', $playlistId)
            ->where('track_id', $trackId)
            ->delete();

        if ($playlist->type === 'liked') {
            \App\Models\TrackLike::where('user_id', $user->id)
                ->where('track_id', $trackId)
                ->delete();
        }

        return response()->json(['message' => 'Track removed']);
    }


}
