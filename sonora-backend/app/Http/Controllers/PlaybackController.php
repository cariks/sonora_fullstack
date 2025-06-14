<?php

namespace App\Http\Controllers;

use App\Models\PlaybackStatus;
use App\Models\UserPlaybackQueue;
use Illuminate\Http\Request;

class PlaybackController extends Controller
{
    public function getQueue(Request $request)
    {
        $queue = UserPlaybackQueue::with(['track' => function($query) {
                $query->select('tracks.id', 'tracks.title', 'tracks.cover_image')
                    ->join('users', 'tracks.artist_id', '=', 'users.id')
                    ->addSelect('users.username as artist_name');
            }])
            ->where('user_id', $request->user()->id)
            ->orderBy('position')
            ->get()
            ->map(function($item) {
                $track = $item->track;

                if ($track) {
                    $track->cover_image = $track->cover_image
                        ? asset('storage/' . $track->cover_image)
                        : null;
                }

                \Log::info('Queue track data:', [
                    'track_id' => $track->id ?? null,
                    'title' => $track->title ?? null,
                    'artist_name' => $track->artist_name ?? null,
                    'raw_track' => $track
                ]);

                return $track;
            });

        \Log::info('Full queue response:', ['queue' => $queue->toArray()]);
        return response()->json($queue);
    }


    public function updateQueue(Request $request)
    {
        $request->validate([
            'track_ids' => 'required|array',
            'start_track_id' => 'nullable|exists:tracks,id',
            'source_type' => 'nullable|in:playlist,album,search,manual',
            'source_id' => 'nullable|integer',
            'source_name' => 'nullable|string|max:255'
        ]);

        $userId = $request->user()->id;
        
        // Lielu masīvu sadalīšanas izmantošana
        $trackIds = $request->track_ids;
        $chunkSize = 50; // Samazināts gabalu lielums, lai uzlabotu atmiņas pārvaldību
        
        try {
            // Notīrīt esošo rindu
            UserPlaybackQueue::where('user_id', $userId)->delete();
            
            // Ievietot pa daļām
            foreach (array_chunk($trackIds, $chunkSize) as $chunk) {
                $queueItems = [];
                foreach ($chunk as $index => $trackId) {
                    $queueItems[] = [
                        'user_id' => $userId,
                        'track_id' => $trackId,
                        'position' => $index,
                        'is_current' => $trackId == $request->start_track_id
                    ];
                }
                UserPlaybackQueue::insert($queueItems);
            }

            // Update PlaybackStatus
            PlaybackStatus::updateOrCreate(
                ['user_id' => $userId],
                [
                    'track_id' => $request->start_track_id,
                    'current_time' => 0,
                    'play_mode' => 'off',
                    'source_type' => $request->input('source_type'),
                    'source_id' => $request->input('source_id'),
                    'source_name' => $request->input('source_name'),
                ]
            );

            return response()->json(['message' => 'Queue updated']);
        } catch (\Exception $e) {
            \Log::error('Error updating queue: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to update queue'], 500);
        }
    }

    public function clearQueue(Request $request)
    {
        UserPlaybackQueue::where('user_id', $request->user()->id)->delete();
        return response()->json(['message' => 'Queue cleared']);
    }

    public function getStatus(Request $request)
    {
        $status = PlaybackStatus::with('track')
            ->where('user_id', $request->user()->id)
            ->first();
            
        \Log::info('Playback status being sent:', [
            'status' => $status ? $status->toArray() : null
        ]);
            
        return response()->json($status);
    }

    public function updateStatus(Request $request)
    {
        try {
            $validated = $request->validate([
                'track_id' => 'nullable|exists:tracks,id',
                'current_time' => 'required|numeric|min:0',
                'is_playing' => 'required|boolean',
                'play_mode' => 'required|in:off,repeat,shuffle',
                'source_type' => 'nullable|in:playlist,album,search,manual',
                'source_name' => 'nullable|string|max:255',
            ]);

            \Log::info('Updating playback status:', $validated);

            $status = PlaybackStatus::updateOrCreate(
                ['user_id' => $request->user()->id],
                $validated
            );

            return response()->json($status);
        } catch (\Exception $e) {
            \Log::error('Error updating playback status: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to update playback status'], 500);
        }
    }
}
