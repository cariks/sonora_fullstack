<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        \Illuminate\Support\Facades\Schema::table('tracks', function (\Illuminate\Database\Schema\Blueprint $table) {
            $table->unsignedBigInteger('artist_id')->nullable()->change();
            $table->foreign('artist_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down()
    {
        \Illuminate\Support\Facades\Schema::table('tracks', function (\Illuminate\Database\Schema\Blueprint $table) {
            $table->dropForeign(['artist_id']);
        });
    }
};
