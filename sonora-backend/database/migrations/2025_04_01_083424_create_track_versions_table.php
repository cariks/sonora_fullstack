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
        Schema::create('track_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('track_id')->constrained('tracks')->onDelete('cascade');
            $table->string('version_name')->nullable(); // e.g. "Remaster 2015"
            $table->string('audio_file');
            $table->string('key')->nullable(); // musical key
            $table->integer('bpm')->nullable();
            $table->text('lyrics')->nullable();
            $table->boolean('lyrics_visible')->default(true);
            $table->string('status')->default('active'); // active / draft / removed
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('updated_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('track_versions');
    }
};
