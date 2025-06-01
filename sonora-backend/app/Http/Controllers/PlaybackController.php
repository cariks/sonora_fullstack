<?php

namespace App\Http\Controllers;

use App\Models\PlaybackStatus;
use App\Models\UserPlaybackQueue;
use Illuminate\Http\Request;

class PlaybackController extends Controller
{
    public function getQueue(Request $request)
    {
        $queue = UserPlaybackQueue::with('track')
            ->where('user_id', $request->user()->id)
            ->orderBy('position')
            ->get()
            ->pluck('track');

        return response()->json($queue);
    }

    public function updateQueue(Request $request)
    {
        $request->validate(['track_ids' => 'required|array']);

        $userId = $request->user()->id;

        UserPlaybackQueue::where('user_id', $userId)->delete();

        foreach ($request->track_ids as $index => $trackId) {
            UserPlaybackQueue::create([
                'user_id' => $userId,
                'track_id' => $trackId,
                'position' => $index,
            ]);
        }

        return response()->json(['message' => 'Queue updated']);
    }

    public function clearQueue(Request $request)
    {
        UserPlaybackQueue::where('user_id', $request->user()->id)->delete();
        return response()->json(['message' => 'Queue cleared']);
    }

    public function getStatus(Request $request)
    {
        $status = PlaybackStatus::with('track')->where('user_id', $request->user()->id)->first();
        return response()->json($status);
    }

    public function updateStatus(Request $request)
    {
        $validated = $request->validate([
            'track_id' => 'nullable|exists:tracks,id',
            'current_time' => 'required|numeric|min:0',
            'is_playing' => 'required|boolean',
            'play_mode' => 'required|in:off,repeat,shuffle',
        ]);

        $status = PlaybackStatus::updateOrCreate(
            ['user_id' => $request->user()->id],
            $validated
        );

        return response()->json($status);
    }
}
