<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('playlist_tracks', function (Blueprint $table) {
            $table->foreign('playlist_id')->references('playlist_id')->on('playlists')->onDelete('cascade');
            $table->foreign('track_id')->references('id')->on('tracks')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('playlist_tracks', function (Blueprint $table) {
            $table->dropForeign(['playlist_id']);
            $table->dropForeign(['track_id']);
        });
    }
};
