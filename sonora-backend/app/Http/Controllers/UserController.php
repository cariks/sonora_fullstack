<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;

class UserController extends Controller
{
    public function showByUsername($username)
    {
        $user = User::with('primaryPhoto')->where('username', $username)->firstOrFail();

        return response()->json([
            'username' => $user->username,
            'display_name' => $user->display_name ?? $user->username,
            'name' => $user->name,
            'surname' => $user->surname,
            'role' => $user->role,
            'bio' => $user->bio,
            'subscribers_count' => 0,
            'photo' => $user->primaryPhoto?->photo_url
                ? asset($user->primaryPhoto->photo_url)
                : null,
        ]);
    }

}
