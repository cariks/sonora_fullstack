<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\TrackController;
use App\Http\Controllers\UserStemsMixerController;



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

// Lietotāja dati (ar tokenu)
Route::middleware('auth:sanctum')->get('/user', [AuthController::class, 'me']);

// Publiskie maršruti
Route::get('/users/{username}', [UserController::class, 'showByUsername']);

// Dziesmas un straumēšana
Route::get('/tracks', [TrackController::class, 'index']);
Route::get('/stream/{type}/{filename}', [TrackController::class, 'streamFile']);

Route::get('/stream/stems/track_{version_id}/{filename}', [TrackController::class, 'streamStem']);


// Tikai autorizētiem lietotājiem
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user/stems-mixer', [UserStemsMixerController::class, 'show']);
    Route::patch('/user/stems-mixer', [UserStemsMixerController::class, 'update']);
});

