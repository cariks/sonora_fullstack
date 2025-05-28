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
        // žanri
        Schema::create('genres', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->unsignedInteger('weight')->default(0);
            $table->timestamps();
        });

        // lietotāja žanri
        Schema::create('user_favorite_genres', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('genre_id')->constrained()->onDelete('cascade');
            $table->unsignedInteger('weight')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'genre_id']);
        });

        // lietotāja miļakie artisti
        Schema::create('user_favorite_artists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('artist_id')->constrained('users')->onDelete('cascade');
            $table->unsignedInteger('weight')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'artist_id']);
        });

        // artista žanri
        Schema::create('artist_genres', function (Blueprint $table) {
            $table->id();
            $table->foreignId('artist_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('genre_id')->constrained()->onDelete('cascade');
            $table->timestamps();

            $table->unique(['artist_id', 'genre_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('artist_genres');
        Schema::dropIfExists('user_favorite_artists');
        Schema::dropIfExists('user_favorite_genres');
        Schema::dropIfExists('genres');
    }
};
