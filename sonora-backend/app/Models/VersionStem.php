<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VersionStem extends Model
{
    use HasFactory;

    protected $table = 'version_stems';

    protected $fillable = [
        'version_id',
        'stem_type',
        'audio_file',
    ];

    // Stems pieder kādai versijai
    public function version()
    {
        return $this->belongsTo(TrackVersion::class, 'version_id');
    }
}
