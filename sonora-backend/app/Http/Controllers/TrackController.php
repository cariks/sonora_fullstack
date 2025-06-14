<?php

namespace App\Http\Controllers;

use App\Models\Track;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Response;

class TrackController extends Controller
{
    public function index()
    {
        $tracks = Track::with(['activeVersion' => function($query) {
                $query->select('id', 'track_id', 'audio_file', 'key', 'bpm', 'lyrics', 'lyrics_visible');
            }, 'activeVersion.stems' => function($query) {
                $query->select('id', 'version_id', 'stem_type', 'audio_file');
            }, 'user' => function($query) {
                $query->select('id', 'username');
            }, 'artist' => function($query) {
                $query->select('id', 'username');
            }])
            ->select('id', 'title', 'cover_image', 'user_id', 'artist_id')
            ->paginate(20);

        // pilns links uz cover image
        $tracks->getCollection()->transform(function ($track) {
            $track->cover_image = $track->cover_image
                ? asset('storage/' . $track->cover_image)
                : null;
            return $track;
        });

        return response()->json($tracks);
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

    public function show($id)
    {
        $track = Track::with([
            'activeVersion' => function ($q) {
                $q->select('id', 'track_id', 'audio_file', 'key', 'bpm', 'lyrics', 'lyrics_visible');
            },
            'activeVersion.stems' => function ($q) {
                $q->select('id', 'version_id', 'stem_type', 'audio_file');
            },
            'user:id,username',
            'artist:id,username'
        ])->findOrFail($id);

        $track->cover_image = $track->cover_image
            ? asset('storage/' . $track->cover_image)
            : null;

        \Log::info('Track data for ID ' . $id . ':', [
            'track_id' => $track->id,
            'title' => $track->title,
            'artist_name' => $track->artist->username ?? null,
            'artist_id' => $track->artist_id,
            'raw_track' => $track->toArray()
        ]);

        return response()->json($track);
    }


}
