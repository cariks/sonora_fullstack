<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserAudioSetting extends Model
{
    protected $primaryKey = 'setting_id';

    protected $fillable = [
        'user_id',
        'eq_enabled',
        'eq_settings',
        'selected_preset_id',
        'stereo_expansion_enabled',
        'stereo_expansion_level'
    ];

    protected $casts = [
        'eq_settings' => 'array',
        'eq_enabled' => 'boolean',
        'stereo_expansion_enabled' => 'boolean',
        'stereo_expansion_level' => 'float'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function selectedPreset()
    {
        return $this->belongsTo(EqualizerPreset::class, 'selected_preset_id');
    }
}