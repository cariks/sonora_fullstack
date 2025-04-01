<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;


class AuthController extends Controller
{
    public function login(Request $request)
    {
        \Log::info('LOGIN METHOD:', ['method' => $request->method()]);

        if ($request->method() !== 'POST') {
            return response()->json(['error' => 'Invalid method: ' . $request->method()], 405);
        }

        $credentials = $request->only('email', 'password');

        if (Auth::attempt($credentials)) {
            $request->session()->regenerate();
            return response()->json(Auth::user());
        }

        return response()->json(['message' => 'Unauthorized'], 401);
    }

    public function me()
    {
        $user = Auth::user();

        return response()->json([
            'id' => $user->id,
            'username' => $user->username,
            'display_name' => $user->display_name ?? $user->username,
            'role' => $user->role,
            'photo' => $user->primaryPhoto?->photo_url
                ? asset('storage/' . $user->primaryPhoto->photo_url)
                : null
        ]);
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return response()->json(['message' => 'Logged out']);
    }
}
