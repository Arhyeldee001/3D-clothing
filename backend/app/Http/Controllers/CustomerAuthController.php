<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class CustomerAuthController extends Controller
{
    public function register(Request $request)
    {
        $this->cleanEmail($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:customers,email'],
            'password' => ['required', 'string', 'min:8', 'max:100'],
        ]);

        $customer = Customer::create($data);

        return response()->json([
            'customer' => $this->present($customer),
            'token' => $customer->createToken('web')->plainTextToken,
        ], 201);
    }

    public function login(Request $request)
    {
        $this->cleanEmail($request);

        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $customer = Customer::where('email', $data['email'])->first();

        if (! $customer || ! Hash::check($data['password'], $customer->password)) {
            throw ValidationException::withMessages([
                'email' => ['Wrong email or password.'],
            ]);
        }

        return response()->json([
            'customer' => $this->present($customer),
            'token' => $customer->createToken('web')->plainTextToken,
        ]);
    }

    public function me(Request $request)
    {
        return response()->json(['customer' => $this->present($request->user())]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['ok' => true]);
    }

    private function cleanEmail(Request $request): void
    {
        $request->merge(['email' => strtolower(trim((string) $request->input('email', '')))]);
    }

    private function present(Customer $customer): array
    {
        return [
            'id' => $customer->id,
            'name' => $customer->name,
            'email' => $customer->email,
        ];
    }
}
