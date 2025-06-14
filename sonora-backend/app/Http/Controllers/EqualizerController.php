<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\EqualizerPreset;
use App\Models\UserAudioSetting;

class EqualizerController extends Controller
{
    // sanemt presetus
    public function getPresets(Request $request)
    {
        return EqualizerPreset::where('user_id', $request->user()->id)
            ->orderBy('position')
            ->get();
    }

    // izveidot presetu
    public function createPreset(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'icon' => 'required|string|max:50',
            'eq_setting' => 'required|array',
            'position' => 'nullable|integer'
        ]);

        $preset = EqualizerPreset::create([
            'user_id' => $request->user()->id,
            'name' => $data['name'],
            'icon' => $data['icon'],
            'eq_setting' => json_encode($data['eq_setting']),
            'position' => $data['position'] ?? 0
        ]);

        return response()->json($preset, 201);
    }

    // atjaunot presetu
    public function updatePreset(Request $request, $id)
    {
        $preset = EqualizerPreset::where('user_id', $request->user()->id)->findOrFail($id);

        $data = $request->validate([
            'name' => 'nullable|string|max:255',
            'icon' => 'nullable|string|max:50'
        ]);

        $preset->update($data);

        return response()->json(['message' => 'Preset updated']);
    }

    // dzest presetu
    public function deletePreset(Request $request, $id)
    {
        $preset = EqualizerPreset::where('user_id', $request->user()->id)->findOrFail($id);
        $preset->delete();

        return response()->json(['message' => 'Preset deleted']);
    }

    // sanemt lietotaja iestatijumus
    public function getSettings(Request $request)
    {
        $settings = UserAudioSetting::firstOrCreate(
            ['user_id' => $request->user()->id],
            [
                'eq_enabled' => false,
                'eq_settings' => json_encode([]),
                'selected_preset_id' => null,
                'stereo_expansion_enabled' => false,
                'stereo_expansion_level' => 1.0
            ]
        );

        return response()->json($settings);
    }

    // atjaunot iestatijumus
    public function updateSettings(Request $request)
    {
        $settings = UserAudioSetting::where('user_id', $request->user()->id)->firstOrFail();

        $data = $request->validate([
            'eq_enabled' => 'boolean',
            'eq_settings' => 'array',
            'selected_preset_id' => 'nullable|integer|exists:equalizer_presets,id',
            'stereo_expansion_enabled' => 'boolean',
            'stereo_expansion_level' => 'numeric|min:0|max:2'
        ]);

        if (isset($data['eq_settings'])) {
            $data['eq_settings'] = json_encode($data['eq_settings']);
        }

        $settings->update($data);

        return response()->json(['message' => 'Settings updated']);
    }
}