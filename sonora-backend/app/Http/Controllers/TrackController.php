<?php

namespace App\Http\Controllers;

use App\Models\Track;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Response;

class TrackController extends Controller
{
    public function index()
    {
        $tracks = \App\Models\Track::with('activeVersion')->get();

        return response()->json($tracks->map(function ($track) {
            return [
                'id' => $track->id,
                'title' => $track->title,
//                'artist_name' => $track->user->display_name ?? $track->user->username,
                'cover_image' => $track->cover_image ? asset('storage/' . $track->cover_image) : null,
                'audio_file' => $track->activeVersion?->audio_file
                    ? url('api/stream/track/' . basename($track->activeVersion->audio_file))
                    : null,
            ];
        }));
    }

    public function streamFile($type, $filename)
    {
        $basePath = match ($type) {
            'track' => storage_path('app/public/tracks/'),
            'stem' => storage_path('app/public/stems/'),
            default => abort(404),
        };

        $path = $basePath . $filename;

        if (!file_exists($path)) {
            abort(404);
        }

        return response()->stream(function () use ($path) {
            $stream = fopen($path, 'rb');
            fpassthru($stream);
            fclose($stream);
        }, 200, [
            'Content-Type' => 'audio/mpeg',
            'Content-Length' => filesize($path),
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'no-cache',
        ]);
    }
}
