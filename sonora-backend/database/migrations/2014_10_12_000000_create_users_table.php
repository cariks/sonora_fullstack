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
        Schema::create('users', function (Blueprint $table) {
            $table->id(); // BIGINT UNSIGNED PRIMARY
            $table->string('username', 50)->unique();
            $table->string('display_name', 255)->nullable();
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->rememberToken();

            $table->dateTime('date_of_birth')->nullable();
            $table->text('bio')->nullable();

            $table->enum('role', ['user', 'artist', 'producer', 'moderator', 'admin'])->default('user');
            $table->boolean('verified')->default(false);
            $table->bigInteger('followers_count')->default(0);
            $table->bigInteger('following_count')->default(0);
            $table->bigInteger('listeners_last_month')->default(0);
            $table->timestamp('last_online')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
