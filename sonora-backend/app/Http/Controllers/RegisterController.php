<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Photo;
use App\Models\UserFavoriteGenre;
use App\Models\UserFavoriteArtist;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class RegisterController extends Controller
{
    public function register(Request $request)
    {
        Log::info('REGISTER REQUEST', [
            'method' => $request->method(),
            'has_token' => $request->hasHeader('X-XSRF-TOKEN'),
            'csrf' => $request->header('X-XSRF-TOKEN'),
            'cookie' => $request->cookie('XSRF-TOKEN'),
            'all' => $request->all(),
        ]);

        $validator = Validator::make($request->all(), [
            'username' => 'required|string|max:255|unique:users',
            'email' => 'required|email|unique:users',
            'password' => 'required|string|min:8',
            'favorite_genres' => 'required|array|min:3',
            'favorite_genres.*' => 'exists:genres,id',
            'favorite_artists' => 'nullable|array',
            'favorite_artists.*' => 'exists:users,id',
        ]);

        if ($validator->fails()) {
            Log::error('VALIDATION FAILED', [
                'errors' => $validator->errors()->toArray(),
                'input' => $request->all()
            ]);
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if ($request->hasFile('photo')) {
            $photo = $request->file('photo');
            if (!$photo->isValid()) {
                return response()->json(['errors' => ['photo' => ['Neizdevās augšupielādēt attēlu.']]], 422);
            }
        }

        $validated = $validator->validated();

        $user = User::create([
            'username' => $validated['username'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => 'user',
        ]);

        Log::info('PHOTO FILE DEBUG', [
            'request->file(photo)' => $request->file('photo'),
            'all files' => $request->allFiles(),
        ]);

        if ($request->hasFile('photo')) {
            $photo = $request->file('photo');

            Log::info('PHOTO DETAILS', [
                'original_name' => $photo->getClientOriginalName(),
                'mime_type' => $photo->getMimeType(),
                'is_valid' => $photo->isValid(),
                'size' => $photo->getSize(),
                'temp_path' => $photo->getPathname(),
            ]);

            $photoPath = $photo->store('photos', 'public');

            Log::info('PHOTO STORED', ['path' => $photoPath]);

            Photo::create([
                'user_id' => $user->id,
                'photo_url' => 'storage/' . $photoPath,
                'position' => 0,
                'is_primary' => true,
            ]);

            $photoRecord = Photo::create([
                'user_id' => $user->id,
                'photo_url' => 'storage/' . $photoPath,
                'position' => 0,
                'is_primary' => true,
            ]);

            Log::info('PHOTO RECORD CREATED', ['photo' => $photoRecord]);
        }




        foreach ($validated['favorite_genres'] as $index => $genreId) {
            UserFavoriteGenre::create([
                'user_id' => $user->id,
                'genre_id' => $genreId,
                'weight' => $index + 1,
            ]);
        }

        if (!empty($validated['favorite_artists'])) {
            foreach ($validated['favorite_artists'] as $index => $artistId) {
                UserFavoriteArtist::create([
                    'user_id' => $user->id,
                    'artist_id' => $artistId,
                    'weight' => $index + 1,
                ]);
            }
        }

        return response()->json(['message' => 'Lietotājs veiksmīgi reģistrēts'], 201);
    }
}
