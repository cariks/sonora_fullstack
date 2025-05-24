<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\UserStemsMixer;

class UserStemsMixerController extends Controller
{
    public function show(Request $request)
    {
        $userId = $request->user()->id;

        $mixer = UserStemsMixer::firstOrCreate(
            ['user_id' => $userId],
            [
                'is_stems_mode' => false,
                'bass_level' => 1,
                'drums_level' => 1,
                'melody_level' => 1,
                'vocals_level' => 1,
            ]
        );

        return response()->json($mixer);
    }

    public function update(Request $request)
    {
        $userId = $request->user()->id;

        $mixer = UserStemsMixer::where('user_id', $userId)->firstOrFail();

        $validated = $request->validate([
            'is_stems_mode' => 'boolean',
            'bass_level' => 'numeric|min:0|max:2',
            'drums_level' => 'numeric|min:0|max:2',
            'melody_level' => 'numeric|min:0|max:2',
            'vocals_level' => 'numeric|min:0|max:2',
        ]);

        $mixer->update($validated);

        return response()->json(['message' => 'Stems mixer updated successfully']);
    }
}
