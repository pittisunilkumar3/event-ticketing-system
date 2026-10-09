import { useState } from 'react';
import api from '../api/client';
import { Alert } from '../components/ui';

export default function Settings() {
  const admin = JSON.parse(localStorage.getItem('admin_user') || '{}');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900">Settings</h1>
      <ProfileCard admin={admin} />
      <PasswordCard />
    </div>
  );
}

function ProfileCard({ admin }) {
  const [form, setForm] = useState({ name: admin.name || '', email: admin.email || '' });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const { data } = await api.patch('/auth/profile', form);
      localStorage.setItem('admin_user', JSON.stringify(data.data.admin));
      setMsg({ type: 'success', text: 'Profile updated ✅' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Update failed' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-bold text-slate-900">Profile</h2>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}

function PasswordCard() {
  const [form, setForm] = useState({ current_password: '', new_password: '' });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api.patch('/auth/password', form);
      setMsg({ type: 'success', text: 'Password changed ✅' });
      setForm({ current_password: '', new_password: '' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Change failed' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-bold text-slate-900">Change password</h2>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Current password</label>
          <input
            type="password"
            required
            value={form.current_password}
            onChange={(e) => setForm({ ...form, current_password: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">New password (min 6)</label>
          <input
            type="password"
            required
            minLength={6}
            value={form.new_password}
            onChange={(e) => setForm({ ...form, new_password: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Update password'}
      </button>
    </form>
  );
}
