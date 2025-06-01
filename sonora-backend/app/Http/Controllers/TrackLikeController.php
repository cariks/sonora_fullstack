<?php

namespace App\Http\Controllers;

use App\Models\TrackLike;
use App\Models\Playlist;
use App\Models\PlaylistTrack;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TrackLikeController extends Controller
{
    public function like($trackId)
    {
        return $this->setLikeStatus($trackId, 'like');
    }

    public function dislike($trackId)
    {
        return $this->setLikeStatus($trackId, 'dislike');
    }

    private function setLikeStatus($trackId, $status)
    {
        $user = Auth::user();

        // atjaunojam vai pievienojam like
        $like = TrackLike::updateOrCreate(
            ['user_id' => $user->id, 'track_id' => $trackId],
            ['like_status' => $status]
        );

        // sanemam like plajlist
        $playlist = Playlist::where('user_id', $user->id)
            ->where('type', 'liked')
            ->first();

        if ($playlist) {
            if ($status === 'like') {
                // pievienojam dziesmu playlist_tracks, ja vina tur nav
                $exists = PlaylistTrack::where('playlist_id', $playlist->playlist_id)
                    ->where('track_id', $trackId)
                    ->exists();

                if (!$exists) {
                    $lastPosition = PlaylistTrack::where('playlist_id', $playlist->playlist_id)
                        ->max('position') ?? 0;

                    PlaylistTrack::create([
                        'playlist_id' => $playlist->playlist_id,
                        'track_id' => $trackId,
                        'position' => $lastPosition + 1,
                    ]);
                }
            } else {
                // dzesam nost no playlist_tracks ja ir dislike
                PlaylistTrack::where('playlist_id', $playlist->playlist_id)
                    ->where('track_id', $trackId)
                    ->delete();
            }
        }

        return response()->json(['message' => "Track $status recorded", 'like' => $like]);
    }

    public function remove($trackId)
    {
        $user = Auth::user();

        // nonemam like/dislike
        TrackLike::where('user_id', $user->id)
            ->where('track_id', $trackId)
            ->delete();

        // dzesam no playlist_tracks
        $playlist = Playlist::where('user_id', $user->id)
            ->where('type', 'liked')
            ->first();

        if ($playlist) {
            PlaylistTrack::where('playlist_id', $playlist->playlist_id)
                ->where('track_id', $trackId)
                ->delete();
        }

        return response()->json(['message' => 'Like/dislike removed']);
    }

    public function getStatus($trackId)
    {
        $user = Auth::user();

        $like = TrackLike::where('user_id', $user->id)
            ->where('track_id', $trackId)
            ->first();

        return response()->json([
            'like_status' => $like?->like_status // like/dislike vai null
        ], 200);
    }
}
