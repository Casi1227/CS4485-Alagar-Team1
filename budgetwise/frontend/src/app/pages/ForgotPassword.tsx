"use client";

import { useState } from "react";
import { CreditCard, Mail, TrendingUp, PieChart, DollarSign } from "lucide-react";

export function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Password reset request:", email);
        setMessage("If this email exists, a reset link has been sent.");
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-6">
            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                {/* Left Side - Branding */}
                <div className="hidden lg:block">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl">
                                <CreditCard className="w-10 h-10 text-white" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold text-gray-900">BudgetTracker</h1>
                                <p className="text-lg text-gray-600">Student Edition</p>
                            </div>
                        </div>

                        <div className="space-y-4 mt-12">
                            <h2 className="text-3xl font-bold text-gray-900">
                                Recover Access to Your Account
                            </h2>
                            <p className="text-lg text-gray-600">
                                Enter your email and we'll send you a reset link so you can securely get back into your account.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 mt-8">
                            <div className="flex items-start gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <PieChart className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Visual Analytics</h3>
                                    <p className="text-sm text-gray-600">See where your money goes with beautiful charts</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                                <div className="p-2 bg-purple-100 rounded-lg">
                                    <TrendingUp className="w-6 h-6 text-purple-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">AI Recommendations</h3>
                                    <p className="text-sm text-gray-600">Get personalized tips to optimize your budget</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <DollarSign className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Smart Budgeting</h3>
                                    <p className="text-sm text-gray-600">Create and manage budgets that work for you</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side - Forgot Password Form */}
                <div className="w-full max-w-md mx-auto">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
                        {/* Mobile Logo */}
                        <div className="lg:hidden flex items-center gap-3 mb-8">
                            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                                <CreditCard className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">BudgetTracker</h1>
                                <p className="text-sm text-gray-600">Student Edition</p>
                            </div>
                        </div>

                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password?</h2>
                            <p className="text-gray-600">
                                Enter your email address and we'll send you a reset link.
                            </p>
                        </div>

                        {message ? (
                            <div className="mb-4 p-3 rounded-lg border border-green-200 bg-green-50 text-green-700">
                                {message}
                            </div>
                        ) : null}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        placeholder="john.student@university.edu"
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
                            >
                                Send Reset Link
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-gray-600">
                                Remembered your password?{" "}
                                <a href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
                                    Back to login
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
