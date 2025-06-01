<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('playlists', function (Blueprint $table) {
            $table->id('playlist_id');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('cover_image')->nullable();
            $table->boolean('is_public')->default(false);
            $table->enum('type', ['manual', 'liked', 'popular', 'fresh', 'genre'])->default('manual');
            $table->foreignId('genre_id')->nullable()->constrained('genres')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('playlists');
    }
};
