<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username', 50)->unique()->after('id');
            $table->string('display_name', 255)->nullable()->after('username');
            $table->dateTime('date_of_birth')->nullable()->after('display_name');
            $table->text('bio')->nullable()->after('date_of_birth');
            $table->enum('role', ['user', 'artist', 'producer', 'moderator', 'admin'])->default('user')->after('bio');
            $table->boolean('verified')->default(false)->after('role');
            $table->bigInteger('followers_count')->default(0)->after('verified');
            $table->bigInteger('following_count')->default(0)->after('followers_count');
            $table->bigInteger('listeners_last_month')->default(0)->after('following_count');
            $table->timestamp('last_online')->nullable()->after('listeners_last_month');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'username',
                'display_name',
                'date_of_birth',
                'bio',
                'role',
                'verified',
                'followers_count',
                'following_count',
                'listeners_last_month',
                'last_online',
            ]);
        });
    }
};
