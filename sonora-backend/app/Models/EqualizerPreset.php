<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EqualizerPreset extends Model
{
    protected $primaryKey = 'eq_preset_id';

    protected $fillable = [
        'user_id',
        'name',
        'icon',
        'eq_setting',
        'position'
    ];

    protected $casts = [
        'eq_setting' => 'array'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}