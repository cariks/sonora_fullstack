<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void {
        Schema::create('playback_status', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->onDelete('cascade');
            $table->foreignId('track_id')->nullable()->constrained()->onDelete('set null');
            $table->double('current_time')->default(0);
            $table->enum('play_mode', ['off', 'repeat', 'shuffle'])->default('off');
            $table->enum('source_type', ['playlist', 'album', 'search', 'manual'])->default('manual');
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('source_name')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('playback_status');
    }
};
