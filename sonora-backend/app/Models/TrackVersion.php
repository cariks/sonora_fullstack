<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TrackVersion extends Model
{
    use HasFactory;

    protected $table = 'track_versions'; // drošiba

    protected $fillable = [
        'track_id',
        'version_name',
        'audio_file',
        'key',
        'bpm',
        'lyrics',
        'lyrics_visible',
        'status',
        'uploaded_by',
        'created_by',
        'updated_by',
    ];

    // Versijai ir daudzi stems
    public function stems()
    {
        return $this->hasMany(VersionStem::class, 'version_id');
    }

    // Versija pieder kādam trackam
    public function track()
    {
        return $this->belongsTo(Track::class, 'track_id');
    }
}
