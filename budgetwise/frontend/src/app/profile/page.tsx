"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Protected } from "@/components/shared/Protected";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/store/auth";

type User = { id: string; email: string; name: string; createdAt: string };

export default function ProfilePage() {
  const { token, logout, login } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function load() {
    const res = await apiFetch<{ user: User }>("/profile/me", {}, token);
    setUser(res.user);
    setName(res.user.name);
  }

  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  async function saveProfile() {
    setError(null);
    setOkMsg(null);
    try {
      const res = await apiFetch<{ user: User }>("/profile/me", { method: "PUT", body: JSON.stringify({ name }) }, token);
      setUser(res.user);
      // keep auth store user in sync (token unchanged)
      login(token!, { id: res.user.id, email: res.user.email, name: res.user.name });
      setOkMsg("Saved");
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function deleteAccount() {
    if (!confirm("Delete your account and all data?")) return;
    setError(null);
    try {
      await apiFetch("/profile/me", { method: "DELETE" }, token);
      logout();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <Protected>
      <main className="mx-auto max-w-2xl p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Profile</h1>
          <Link href="/dashboard"><Button variant="outline">Back</Button></Link>
        </header>

        {error ? <p className="text-sm text-alert">{error}</p> : null}
        {okMsg ? <p className="text-sm text-slate-700">{okMsg}</p> : null}

        <section className="rounded-md border p-4 space-y-3">
          <h2 className="font-medium">Account</h2>
          <p className="text-sm text-slate-600">Email: {user?.email}</p>
          <div className="space-y-1">
            <label className="text-sm">Name</label>
            <input className="w-full rounded-md border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button onClick={saveProfile}>Save</Button>
        </section>

        <section className="rounded-md border p-4 space-y-3">
          <h2 className="font-medium text-alert">Danger Zone</h2>
          <Button variant="destructive" onClick={deleteAccount}>Delete Account</Button>
        </section>
      </main>
    </Protected>
  );
}
