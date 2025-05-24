<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserStemsMixer extends Model
{
    use HasFactory;

    protected $table = 'user_stems_mixer';

    protected $fillable = [
        'user_id',
        'is_stems_mode',
        'bass_level',
        'drums_level',
        'melody_level',
        'vocals_level',
    ];

    public $timestamps = false;

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
