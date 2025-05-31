<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Photo;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class ProfilePhotoController extends Controller
{
    public function save(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'photo_path' => 'required|string'
        ]);

        if ($validator->fails()) {
            Log::error('PHOTO SAVE VALIDATION FAILED', [
                'errors' => $validator->errors()->toArray(),
            ]);
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $validated = $validator->validated();

        $photo = Photo::create([
            'user_id' => $validated['user_id'],
            'photo_url' => $validated['photo_path'],
            'position' => 0,
            'is_primary' => true
        ]);

        Log::info('✅ Profile photo saved', ['photo_id' => $photo->id]);

        return response()->json(['message' => 'Photo saved successfully']);
    }
}
