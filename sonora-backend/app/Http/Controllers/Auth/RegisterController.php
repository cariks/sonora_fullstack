<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Genre;
use App\Models\UserFavoriteArtist;
use App\Models\UserFavoriteGenre;
use App\Models\Photo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;

class RegisterController extends Controller
{
    public function register(Request $request)
    {
        // Validācija visiem laukiem, tai skaitā profilbildei
        $validated = Validator::make($request->all(), [
            'email' => 'required|email|max:100|unique:users',
            'username' => [
                'required',
                'string',
                'min:3',
                'max:60',
                'unique:users',
                'not_regex:/[%\/\\\\@?]/' // aizliedz simbolus %, /, \, @, ?
            ],
            'password' => [
                'required',
                'string',
                'min:8',
                'max:60',
                'regex:/[A-Z]/',   // vismaz viens lielais burts
                'regex:/[0-9]/'    // vismaz viens cipars
            ],
            'display_name' => 'nullable|string|max:100',
            'date_of_birth' => 'nullable|date',
            'bio' => 'nullable|string|max:5000',
            'favorite_genres' => 'required|array|min:1',
            'favorite_genres.*' => 'exists:genres,id',
            'favorite_artists' => 'nullable|array',
            'favorite_artists.*' => 'exists:users,id',
            'profile_photo' => 'nullable|image|mimes:jpg,jpeg,png|max:10240', // max 10MB
        ]);

        if ($validated->fails()) {
            return response()->json(['errors' => $validated->errors()], 422);
        }

        // Izveidojam lietotāju
        $user = User::create([
            'email' => $request->email,
            'username' => $request->username,
            'password' => Hash::make($request->password),
            'display_name' => $request->display_name,
            'date_of_birth' => $request->date_of_birth,
            'bio' => $request->bio,
        ]);

        // Saglabājam iecienītos žanrus
        if ($request->filled('favorite_genres')) {
            foreach ($request->favorite_genres as $genreId) {
                UserFavoriteGenre::create([
                    'user_id' => $user->id,
                    'genre_id' => $genreId,
                ]);
            }
        }

        // Saglabājam iecienītos māksliniekus
        if ($request->filled('favorite_artists')) {
            foreach ($request->favorite_artists as $artistId) {
                UserFavoriteArtist::create([
                    'user_id' => $user->id,
                    'artist_id' => $artistId,
                ]);
            }
        }

        // Apstrādājam profilbildes augšupielādi (ja tāda ir)
        if ($request->hasFile('profile_photo')) {
            // Saglabājam failu mapē: storage/app/public/user_photos
            $path = $request->file('profile_photo')->store('user_photos', 'public');

            // Ierakstām foto datubāzē
            Photo::create([
                'user_id' => $user->id,
                'photo_url' => 'storage/' . $path, // Pieejamais ceļš no publiskās mapes
                'is_primary' => true,
                'position' => 0,
            ]);
        }

        return response()->json(['message' => 'Lietotājs veiksmīgi reģistrēts'], 201);
    }

    public function checkEmail(Request $request)
    {
        $request->validate([
            'email' => 'required|email|max:100',
        ]);

        $exists = User::where('email', $request->email)->exists();

        return response()->json(['available' => !$exists]);
    }


    public function checkUsername(Request $request)
    {
        $request->validate([
            'username' => [
                'required',
                'string',
                'min:3',
                'max:60',
                'not_regex:/[%\/\\\\@?]/',
            ],
        ]);

        $exists = \App\Models\User::where('username', $request->username)->exists();

        return response()->json(['available' => !$exists]);
    }




}
