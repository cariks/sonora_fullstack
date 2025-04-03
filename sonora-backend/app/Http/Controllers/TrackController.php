<?php

namespace App\Http\Controllers;

use App\Models\Track;
use Illuminate\Http\Request;

class TrackController extends Controller
{
    public function index()
    {
        $tracks = \App\Models\Track::with('activeVersion')->get();

        return response()->json($tracks->map(function ($track) {
            return [
                'id' => $track->id,
                'title' => $track->title,
                'cover_image' => $track->cover_image ? asset('storage/' . $track->cover_image) : null,
                'audio_file' => $track->activeVersion?->audio_file
                    ? asset('storage/' . $track->activeVersion->audio_file)
                    : null,
            ];
        }));
    }
}
