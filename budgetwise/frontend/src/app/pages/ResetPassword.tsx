"use client";
import { useState } from "react";

export function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    console.log("Password reset successful");

    setMessage("Password successfully reset.");
  };

  return (
    <div style={{ padding: "40px" }}>
      <h2>Reset Password</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <button type="submit">Reset Password</button>
      </form>

      <p>{message}</p>
    </div>
  );
}
