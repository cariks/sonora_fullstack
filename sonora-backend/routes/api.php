<?php

use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\PlaybackController;
use App\Http\Controllers\TempPhotoController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\TrackController;
use App\Http\Controllers\UserStemsMixerController;
use App\Http\Controllers\ArtistGenreController;
use App\Models\Photo;
use App\Http\Controllers\TrackLikeController;
use App\Http\Controllers\PlaylistController;
use App\Http\Controllers\PlaylistTrackController;
use App\Http\Controllers\EqualizerController;


/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Autorizācijas maršruti
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout']);

Route::post('/upload-temp-photo', [TempPhotoController::class, 'upload']);
Route::post('/register', [RegisterController::class, 'register']);

Route::get('/check-email', [RegisterController::class, 'checkEmail']);
Route::get('/check-username', [RegisterController::class, 'checkUsername']);

Route::get('/genres', [\App\Http\Controllers\GenreController::class, 'index']);
Route::post('/suggested-artists', [ArtistGenreController::class, 'getSuggestedArtists']);


// Lietotāja dati (ar tokenu)
Route::middleware('auth:sanctum')->get('/user', [AuthController::class, 'me']);

// Publiskie maršruti
Route::get('/users/{username}', [UserController::class, 'showByUsername']);

// Dziesmas un straumēšana
Route::get('/tracks', [TrackController::class, 'index']);
Route::get('/stream/{type}/{filename}', [TrackController::class, 'streamFile']);

Route::get('/stream/stems/track_{version_id}/{filename}', [TrackController::class, 'streamStem']);

Route::middleware('auth:sanctum')->group(function () { // Like dislike
    Route::post('/tracks/{trackId}/like', [TrackLikeController::class, 'like']);
    Route::post('/tracks/{trackId}/dislike', [TrackLikeController::class, 'dislike']);
    Route::delete('/tracks/{trackId}/like', [TrackLikeController::class, 'remove']);
});
Route::get('/tracks/{trackId}/like-status', [TrackLikeController::class, 'getStatus']);

Route::get('/users/{username}/public-tracks', [UserController::class, 'publicTracks']);



// Playlisti
Route::middleware('auth:sanctum')->post('/playlists/init-default', [PlaylistController::class, 'createDefaultPlaylists']);
Route::middleware('auth:sanctum')->get('/playlists', [PlaylistController::class, 'index']);

//Route::middleware('auth:sanctum')->post('/playlist-track', [PlaylistTrackController::class, 'addTrackToPlaylist']);
Route::middleware('auth:sanctum')->get('/playlists/{identifier}/tracks', [PlaylistController::class, 'getPlaylistTracks']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/playlist-tracks/add', [PlaylistTrackController::class, 'addToPlaylist']);
    Route::post('/playlist-tracks/remove', [PlaylistTrackController::class, 'removeFromPlaylist']);
});

Route::get('/playlists/{identifier}/tracks', [PlaylistController::class, 'getTracksByPlaylist']);
Route::get('/tracks/{id}', [TrackController::class, 'show']);


Route::middleware('auth:sanctum')->post('/playlists/create', [PlaylistController::class, 'store']);
// pievienot dziesmu plejlistam
Route::middleware('auth:sanctum')->get('/playlist-tracks/track/{trackId}', [PlaylistTrackController::class, 'getPlaylistsForTrack']);
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/playlist-tracks/add', [PlaylistTrackController::class, 'addToPlaylist']);
    Route::post('/playlist-tracks/remove', [PlaylistTrackController::class, 'removeFromPlaylist']);
});

// dzest sarakstu
Route::delete('/playlists/{id}', [PlaylistController::class, 'destroy']);


Route::get('/users/{username}/public-playlists', [UserController::class, 'publicPlaylists']);




// Queue - rinda
Route::get('/playback/queue', [PlaybackController::class, 'getQueue']);
Route::post('/playback/queue', [PlaybackController::class, 'updateQueue']);
Route::delete('/playback/queue', [PlaybackController::class, 'clearQueue']);

Route::get('/playback/status', [PlaybackController::class, 'getStatus']);
Route::post('/playback/status', [PlaybackController::class, 'updateStatus']);
Route::middleware('auth:sanctum')->get('/playlists/{identifier}', [PlaylistController::class, 'getTracksByPlaylist']);



// Žanri, artisti utt
Route::get('/artist/{artistId}/genres', [ArtistGenreController::class, 'getGenres']);


// Preseti, ekvalaizera iestatijumu utt
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/equalizer/presets', [EqualizerController::class, 'getPresets']);
    Route::post('/equalizer/presets', [EqualizerController::class, 'createPreset']);
    Route::put('/equalizer/presets/{id}', [EqualizerController::class, 'updatePreset']);
    Route::delete('/equalizer/presets/{id}', [EqualizerController::class, 'deletePreset']);

    Route::get('/equalizer/settings', [EqualizerController::class, 'getSettings']);
    Route::put('/equalizer/settings', [EqualizerController::class, 'updateSettings']);
});

// Tikai autorizētiem lietotājiem
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user/stems-mixer', [UserStemsMixerController::class, 'show']);
    Route::patch('/user/stems-mixer', [UserStemsMixerController::class, 'update']);
});

