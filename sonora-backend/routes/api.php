<?php

use App\Http\Controllers\Auth\RegisterController;
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


// Žanri, artisti utt
Route::get('/artist/{artistId}/genres', [ArtistGenreController::class, 'getGenres']);



// Tikai autorizētiem lietotājiem
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user/stems-mixer', [UserStemsMixerController::class, 'show']);
    Route::patch('/user/stems-mixer', [UserStemsMixerController::class, 'update']);
});

