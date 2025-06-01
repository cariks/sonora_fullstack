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
        $playlistType = $request->input('playlist_type'); // piemeram liked

        $playlist = Playlist::where('user_id', $user->id)
            ->where('type', $playlistType)
            ->firstOrFail();

        // parbaude vai dziesma jau ir pievienota
        $exists = PlaylistTrack::where('playlist_id', $playlist->playlist_id)
            ->where('track_id', $trackId)
            ->exists();

        if (!$exists) {
            $maxPosition = PlaylistTrack::where('playlist_id', $playlist->playlist_id)->max('position') ?? 0;

            PlaylistTrack::create([
                'playlist_id' => $playlist->playlist_id,
                'track_id' => $trackId,
                'position' => $maxPosition + 1,
            ]);
        }

        return response()->json(['message' => 'Track added to playlist']);
    }

    public function removeFromPlaylist(Request $request)
    {
        $user = $request->user();
        $trackId = $request->input('track_id');
        $playlistType = $request->input('playlist_type');

        $playlist = Playlist::where('user_id', $user->id)
            ->where('type', $playlistType)
            ->first();

        if ($playlist) {
            PlaylistTrack::where('playlist_id', $playlist->playlist_id)
                ->where('track_id', $trackId)
                ->delete();
        }

        return response()->json(['message' => 'Track removed from playlist']);
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
}
