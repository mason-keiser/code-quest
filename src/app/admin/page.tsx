"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useProfile } from "@/components/useProfile";
import type { Profile, Role } from "@/lib/types";

export default function AdminPage() {
  const me = useProfile();
  const [users, setUsers] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ users: Profile[] }>(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then((d) => setUsers(d.users))
      .catch((e) => setError(e.message));
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setError(null);
    try {
      await api(`/api/admin/users/${id}`, { method: "PATCH", body });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (u: Profile) => {
    if (!confirm(`Permanently delete @${u.username}? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (me && me.role !== "admin") return <p className="text-rose-300">Admins only.</p>;

  const counts = users.reduce<Record<string, number>>((acc, u) => ({ ...acc, [u.role]: (acc[u.role] ?? 0) + 1 }), {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="heading text-3xl">🛡️ Admin</h1>
        <span className="badge">{counts.student ?? 0} students</span>
        <span className="badge">{counts.instructor ?? 0} instructors</span>
        <span className="badge">{counts.admin ?? 0} admins</span>
        <input className="input ml-auto max-w-xs" placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="rounded-xl bg-rose-500/20 px-4 py-2 text-rose-200">{error}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr><th className="py-2">User</th><th>Role</th><th>Points</th><th>Joined</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-2">
                  {u.avatar} <span className="font-semibold">{u.display_name}</span>{" "}
                  <span className="text-slate-400">@{u.username}</span>
                </td>
                <td>
                  <select
                    className="input w-auto py-1"
                    value={u.role}
                    disabled={u.id === me?.id}
                    onChange={(e) => patch(u.id, { role: e.target.value as Role })}
                  >
                    <option value="student">Student</option>
                    <option value="instructor">Instructor</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="font-mono">{u.total_points.toLocaleString()}</td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="space-x-2 text-right">
                  <button
                    className="btn-secondary px-2 py-1 text-xs"
                    onClick={() => confirm(`Reset @${u.username}'s points to 0?`) && patch(u.id, { reset_points: true })}
                  >
                    Reset points
                  </button>
                  <button className="btn-danger px-2 py-1 text-xs" disabled={u.id === me?.id} onClick={() => remove(u)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
