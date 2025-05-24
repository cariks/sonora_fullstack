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
        Schema::create('user_stems_mixer', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')->constrained('users')->onDelete('cascade'); // Saite ar lietotāju

            $table->boolean('is_stems_mode')->default(false); // Vai ir ieslegts

            // Katras skaņas ceļa skaļums no 0.0 līdz 1.0
            $table->float('bass_level')->default(1.0);
            $table->float('drums_level')->default(1.0);
            $table->float('melody_level')->default(1.0);
            $table->float('vocals_level')->default(1.0);

            $table->timestamps(); // Izveides/laika lauki
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_stems_mixer');
    }
};
