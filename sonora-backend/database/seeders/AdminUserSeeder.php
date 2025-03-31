<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@gmail.com'],
            [
                'username' => 'admin',
                'display_name' => 'Administrator',
                'password' => bcrypt('admin123'),
                'role' => 'admin',
                'verified' => true,
                'date_of_birth' => now()->subYears(19),
                'bio' => 'The boss of the system.',
                'followers_count' => 0,
                'following_count' => 0,
                'listeners_last_month' => 0,
                'last_online' => now(),
            ]
        );
    }
}
