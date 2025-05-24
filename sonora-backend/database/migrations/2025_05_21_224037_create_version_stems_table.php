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
        Schema::create('version_stems', function (Blueprint $table) {
            $table->id(); // Primārā atslēga

            $table->foreignId('version_id')->constrained('track_versions')->onDelete('cascade'); // Saite ar versiju

            $table->enum('stem_type', ['vocals', 'bass', 'drums', 'melody']); // Datu tips
            $table->string('audio_file'); // Ceļš uz audio failu

            $table->timestamps(); // Laika lauki
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('version_stems');
    }
};
