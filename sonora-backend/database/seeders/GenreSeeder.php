<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class GenreSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $genres = [
            ['name' => 'Pop', 'description' => 'Popular music', 'weight' => 1],
            ['name' => 'Rock', 'description' => 'Rock and roll', 'weight' => 2],
            ['name' => 'Hip-Hop', 'description' => 'Hip-Hop and Rap', 'weight' => 3],
            ['name' => 'Jazz', 'description' => 'Smooth and classic jazz', 'weight' => 4],
            ['name' => 'Electronic', 'description' => 'EDM and electronic beats', 'weight' => 5],
            ['name' => 'Classical', 'description' => 'Orchestral music', 'weight' => 6],
            ['name' => 'Metal', 'description' => 'Heavy metal', 'weight' => 7],
        ];

        foreach ($genres as $genre) {
            DB::table('genres')->insert([
                'name' => $genre['name'],
                'description' => $genre['description'],
                'weight' => $genre['weight'],
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ]);
        }
    }
}
