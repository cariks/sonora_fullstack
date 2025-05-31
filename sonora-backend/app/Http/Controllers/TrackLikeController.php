<?php

namespace App\Http\Controllers;

use App\Models\TrackLike;
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

        $like = TrackLike::updateOrCreate(
            ['user_id' => $user->id, 'track_id' => $trackId],
            ['like_status' => $status]
        );

        return response()->json(['message' => "Track $status recorded", 'like' => $like]);
    }

    public function remove($trackId)
    {
        $user = Auth::user();

        TrackLike::where('user_id', $user->id)
            ->where('track_id', $trackId)
            ->delete();

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
