<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_audio_settings', function (Blueprint $table) {
            $table->id('setting_id');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');

            $table->boolean('eq_enabled')->default(false);
            $table->json('eq_settings')->nullable();
            $table->foreignId('selected_preset_id')->nullable()->constrained('equalizer_presets')->onDelete('set null');

            $table->boolean('stereo_expansion_enabled')->default(false);
            $table->float('stereo_expansion_level')->default(0.5); // no 0 lidz 1

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_audio_settings');
    }
};