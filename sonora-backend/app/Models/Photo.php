<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Photo extends Model
{
    protected $table = 'user_photos';

    protected $fillable = ['user_id', 'photo_url', 'position', 'is_primary'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
