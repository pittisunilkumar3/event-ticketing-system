import { useState } from "react";
import api from "../api/client";
import { session } from "../saas/context";
import Icon from "../components/Icon";
import AccountPackage from '../saas/PackageDetails';
import { Field, Notice, errorText, useUnsaved } from "./studio/StudioUI";
import "./myAccount.css";

function accountDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

export default function MyAccount({ admin, onUpdate }) {
  const role =
    admin.role === "super_admin" ? "Organizer owner" : "Manager";
  const initials = (admin.name || "A")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <div className="studio my-account">
      <section className="account-banner" aria-label="Your profile">
        <div className="account-monogram" aria-hidden="true">
          {initials}
        </div>
        <div className="account-identity">
          <span className="account-kicker">YOUR WORKSPACE PROFILE</span>
          <h2>{admin.name}</h2>
          <p>
            <Icon name="mail" size={16} />
            {admin.email}
          </p>
        </div>
        <span className="account-role">{role}</span>
      </section>
      <div className="account-layout">
        <div className="account-forms">
          <ProfileForm admin={admin} onUpdate={onUpdate} />
          <PasswordForm onUpdate={onUpdate} />
        </div>
        <aside className="account-aside">
          <AccountPackage />
          <section className="studio-panel account-details">
            <div className="studio-panel-title">
              <Icon name="page" size={19} />
              <h2>Account details</h2>
            </div>
            <dl>
              <div>
                <dt>Member since</dt>
                <dd>{accountDate(admin.created_at)}</dd>
              </div>
              <div>
                <dt>Last account update</dt>
                <dd>{accountDate(admin.updated_at)}</dd>
              </div>
              <div>
                <dt>Sign-in method</dt>
                <dd>Email & password</dd>
              </div>
              <div>
                <dt>Workspace role</dt>
                <dd>{role}</dd>
              </div>
            </dl>
            <div className="account-access">
              <Icon name="grid" size={19} />
              <div>
                <h3>Your access</h3>
                <p>
                  {admin.role === "super_admin"
                    ? "Manage events, bookings and check-ins, plus website settings, ticket designs and email delivery."
                    : "Manage events, bookings and guest check-ins. Website configuration is managed by a super administrator."}
                </p>
              </div>
            </div>
          </section>
          <div className="account-note">
            <Icon name="mail" size={20} />
            <div>
              <h3>Your sign-in email</h3>
              <p>
                This email is for your account. Your website’s public contact
                email and outgoing mail settings are managed separately.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProfileForm({ admin, onUpdate }) {
  const [form, setForm] = useState({
    name: admin.name || "",
    email: admin.email || "",
  });
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const dirty = form.name !== admin.name || form.email !== admin.email;
  useUnsaved(dirty);
  async function save(e) {
    e.preventDefault();
    setMessage(null);
    if (!form.name.trim()) {
      setMessage({ text: "Enter your full name." });
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch("/auth/profile", {
        name: form.name.trim(),
        email: form.email.trim(),
      });
      onUpdate(data.data.admin);
      setForm({ name: data.data.admin.name, email: data.data.admin.email });
      try {
        session.setItem("admin_user", JSON.stringify(data.data.admin));
      } catch {
        /* Profile is already saved. */
      }
      window.dispatchEvent(new Event("admin-profile-updated"));
      setMessage({ type: "success", text: "Your profile has been updated." });
    } catch (err) {
      setMessage({ text: errorText(err) });
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="studio-panel" onSubmit={save}>
      <div className="studio-panel-title">
        <span className="account-section-number" aria-hidden="true">
          01
        </span>
        <h2>Personal information</h2>
      </div>
      <fieldset disabled={saving} className="studio-form-body account-fieldset">
        <p className="account-section-copy">
          How you appear in your workspace and where you sign in.
        </p>
        <Notice message={message} />
        <div className="studio-two-col">
          <Field
            label="Full name"
            autoComplete="name"
            required
            maxLength={100}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Field
            label="Email address"
            autoComplete="email"
            type="email"
            required
            maxLength={150}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <p className="account-field-hint">
          If you change your email, use the new address the next time you sign
          in.
        </p>
        <div className="account-actions">
          <button className="studio-button primary" disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save profile"}
            <Icon name="arrow" size={16} />
          </button>
          {dirty && (
            <button
              type="button"
              className="account-reset"
              onClick={() => {
                setForm({ name: admin.name, email: admin.email });
                setMessage(null);
              }}
            >
              Discard changes
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}

function PasswordForm({ onUpdate }) {
  const empty = { current: "", next: "", confirm: "" };
  const [form, setForm] = useState(empty);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const mismatch =
    (attempted || Boolean(form.confirm)) && form.next !== form.confirm;
  useUnsaved(Boolean(form.current || form.next || form.confirm));
  async function save(e) {
    e.preventDefault();
    setAttempted(true);
    setMessage(null);
    if (form.next !== form.confirm) {
      setMessage({ text: "The new passwords do not match." });
      return;
    }
    if (form.current === form.next) {
      setMessage({
        text: "Choose a different password from your current one.",
      });
      return;
    }
    setSaving(true);
    try {
      await api.patch("/auth/password", {
        current_password: form.current,
        new_password: form.next,
      });
      setForm(empty);
      setVisible(false);
      setAttempted(false);
      setMessage({ type: "success", text: "Your password has been updated." });
      api
        .get("/auth/me")
        .then(({ data }) => onUpdate(data.data.admin))
        .catch(() => {});
    } catch (err) {
      setMessage({ text: errorText(err) });
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="studio-panel" onSubmit={save}>
      <div className="studio-panel-title">
        <span className="account-section-number" aria-hidden="true">
          02
        </span>
        <h2>Change password</h2>
      </div>
      <fieldset disabled={saving} className="studio-form-body account-fieldset">
        <div className="account-password-intro">
          <p className="account-section-copy">
            Choose a unique password you don’t use elsewhere.
          </p>
          <button
            type="button"
            className="account-visibility"
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            <Icon name="eye" size={17} />
            {visible ? "Hide passwords" : "Show passwords"}
          </button>
        </div>
        <Notice message={message} />
        <Field
          label="Current password"
          type={visible ? "text" : "password"}
          autoComplete="current-password"
          required
          value={form.current}
          onChange={(e) => setForm({ ...form, current: e.target.value })}
        />
        <div className="studio-two-col">
          <Field
            label="New password"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={6}
            value={form.next}
            aria-describedby="account-password-help"
            onChange={(e) => setForm({ ...form, next: e.target.value })}
          />
          <Field
            label="Confirm new password"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={6}
            aria-invalid={mismatch}
            aria-describedby={
              mismatch ? "account-password-mismatch" : undefined
            }
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </div>
        {mismatch && (
          <p
            id="account-password-mismatch"
            className="account-field-error"
            role="status"
          >
            Passwords do not match yet.
          </p>
        )}
        <p id="account-password-help" className="account-field-hint">
          At least 6 characters. A longer phrase is easier to remember and
          harder to guess.
        </p>
        <div className="account-actions">
          <button
            className="studio-button secondary"
            disabled={saving || !form.current || !form.next || !form.confirm}
          >
            {saving ? "Updating…" : "Update password"}
            <Icon name="arrow" size={16} />
          </button>
        </div>
      </fieldset>
    </form>
  );
}
