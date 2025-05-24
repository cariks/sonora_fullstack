<?php

namespace App\Http\Controllers;

use App\Models\Track;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Response;

class TrackController extends Controller
{
    public function index()
    {
        // Ielādē gan aktīvo versiju, gan tās stems
        $tracks = Track::with('activeVersion.stems')->get();

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

    public function streamStem($version_id, $filename)
    {
        $folder = "track_" . intval($version_id);
        $path = storage_path("app/public/stems/{$folder}/{$filename}");

        if (!file_exists($path)) {
            abort(404, 'Stems file not found.');
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
