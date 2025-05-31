<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class TempPhotoController extends Controller
{
    public function upload(Request $request)
    {
        if (!$request->hasFile('photo') || !$request->file('photo')->isValid()) {
            return response()->json(['error' => 'Nav derīga attēla faila.'], 422);
        }

        $photo = $request->file('photo');
        $path = $photo->store('temp_photos', 'public'); // storage/app/public/temp_photos/xxx.jpg

        Log::info('⏳ TEMP PHOTO SAVED', ['path' => $path]);

        return response('storage/' . $path, 200)
            ->header('Content-Type', 'text/plain');
    }
}
