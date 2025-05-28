<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\ArtistGenre;
use Illuminate\Http\Request;

class ArtistGenreController extends Controller
{
    public function getGenres($artistId)
    {
        $artist = User::where('id', $artistId)
            ->where('role', 'artist')
            ->with('artistGenres')
            ->first();

        if (!$artist) {
            return response()->json(['error' => 'Artista nav atrasts'], 404);
        }

        return response()->json($artist->artistGenres);
    }

    public function getSuggestedArtists(Request $request)
    {
        $validated = $request->validate([
            'genre_ids' => 'required|array',
            'genre_ids.*' => 'exists:genres,id',
        ]);

        $genreIds = $validated['genre_ids'];

        $artistIds = ArtistGenre::whereIn('genre_id', $genreIds)
            ->pluck('user_id')
            ->unique();

        $artists = User::whereIn('id', $artistIds)
            ->where('role', 'artist')
            ->select('id', 'username', 'display_name')
            ->with('primaryPhoto') // lai radit ari fotografiju
            ->get();

        return response()->json($artists);
    }
}

