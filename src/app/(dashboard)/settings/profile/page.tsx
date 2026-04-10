"use client";

import { useEffect, useState } from "react";
import { User, Mail, Phone, Shield, Save, Lock } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { getAdminUser, setAdminAuth, getAdminToken } from "@/lib/auth";

interface ProfileData {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
}

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await apiFetch<ProfileData>("/auth/profile");
        setProfile(data);
        setEditName(data.name);
        setEditPhone(data.phone || "");
      } catch {
        const localUser = getAdminUser();
        if (localUser) {
          setProfile({ id: localUser.id, name: localUser.name, email: localUser.email, phone: "", role: localUser.role });
          setEditName(localUser.name);
        }
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleUpdateProfile = async () => {
    setSaving(true);
    try {
      const updated = await apiFetch<ProfileData>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: editName, phone: editPhone }),
      });
      setProfile(updated);
      const token = getAdminToken();
      if (token) {
        setAdminAuth(token, { id: updated.id, name: updated.name, email: updated.email, role: updated.role, branchId: null });
      }
      alert("Profile updated successfully");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      alert("New password and confirm password do not match");
      return;
    }
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }
    setChangingPassword(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      alert("Password changed successfully");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Admin Profile" />
        <div className="bg-white rounded-xl border border-border p-8 text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const roleLabel = profile?.role === "SUPER_ADMIN" ? "Super Admin" : profile?.role === "ADMIN" ? "Admin" : profile?.role || "Staff";

  return (
    <div>
      <PageHeader title="Admin Profile" description="View and manage your account" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-border p-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-primary-light flex items-center justify-center mb-4">
              <User size={36} className="text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground">{profile?.name}</h2>
            <span className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 bg-primary-light text-primary rounded-full text-xs font-semibold">
              <Shield size={12} /> {roleLabel}
            </span>
          </div>
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail size={16} className="text-muted-foreground" />
              <span className="text-foreground">{profile?.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone size={16} className="text-muted-foreground" />
              <span className="text-foreground">{profile?.phone || "Not set"}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-border p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Edit Profile</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Name</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Phone</label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Phone number" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
                <Input value={profile?.email || ""} disabled className="bg-muted/50" />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleUpdateProfile} disabled={saving || !editName}>
                  <Save size={16} className="mr-1.5" /> {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border p-6">
            <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <Lock size={18} /> Change Password
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Current Password</label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">New Password</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Confirm Password</label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleChangePassword} disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}>
                  {changingPassword ? "Changing..." : "Change Password"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
