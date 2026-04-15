"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, Lock, Eye, EyeOff } from "lucide-react";

function getErrorMessage(error: unknown): string {
    if (typeof error === "string") return error;

    if (
        error &&
        typeof error === "object" &&
        "formErrors" in error &&
        Array.isArray((error as { formErrors?: unknown[] }).formErrors)
    ) {
        const formErrors = (error as { formErrors?: string[] }).formErrors;
        if (formErrors && formErrors.length > 0) return formErrors[0];
    }

    if (
        error &&
        typeof error === "object" &&
        "fieldErrors" in error &&
        typeof (error as { fieldErrors?: unknown }).fieldErrors === "object"
    ) {
        const fieldErrors = (error as { fieldErrors?: Record<string, string[]> }).fieldErrors;
        if (fieldErrors) {
            for (const value of Object.values(fieldErrors)) {
                if (Array.isArray(value) && value.length > 0) return value[0];
            }
        }
    }

    return "Something went wrong.";
}

export function ResetPassword() {
    const searchParams = useSearchParams();

    const email = searchParams.get("email") || "";
    const key = searchParams.get("key") || "";

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setMessage("");

        if (!email || !key) {
            setError("Invalid or expired reset link.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }

        try {
            setLoading(true);

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/reset-password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email,
                        key,
                        password,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setError(getErrorMessage(data?.error) || "There was a problem resetting your password.");
                return;
            }

            setMessage("Your password has been successfully reset.");
            setPassword("");
            setConfirmPassword("");
        } catch (err) {
            setError("There was a problem resetting your password.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-6">
            <div className="w-full max-w-md mx-auto">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                            <CreditCard className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">BudgetTracker</h1>
                            <p className="text-sm text-gray-600">Student Edition</p>
                        </div>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h2>
                        <p className="text-gray-600">
                            Enter and confirm your new password below.
                        </p>
                    </div>

                    {error ? (
                        <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700">
                            {error}
                        </div>
                    ) : null}

                    {message ? (
                        <div className="space-y-4">
                            <div className="p-3 rounded-lg border border-green-200 bg-green-50 text-green-700">
                                {message}
                            </div>

                            <div className="text-center">
                                <a
                                    href="/login"
                                    className="text-indigo-600 hover:text-indigo-700 font-medium"
                                >
                                    Return to login
                                </a>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    New Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoComplete="new-password"
                                        placeholder="Enter your new password"
                                        className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="w-5 h-5" />
                                        ) : (
                                            <Eye className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="confirmPassword"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        autoComplete="new-password"
                                        placeholder="Confirm your new password"
                                        className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff className="w-5 h-5" />
                                        ) : (
                                            <Eye className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                            >
                                {loading ? "Resetting..." : "Reset Password"}
                            </button>
                        </form>
                    )}

                    {!message && (
                        <div className="mt-6 text-center">
                            <p className="text-sm text-gray-600">
                                Back to{" "}
                                <a
                                    href="/login"
                                    className="text-indigo-600 hover:text-indigo-700 font-medium"
                                >
                                    login
                                </a>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
