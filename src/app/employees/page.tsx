"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Users,
  UserPlus,
  Shield,
  Key,
  Power,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  History,
  MoreVertical,
  Check,
  Edit,
  Eye,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Dropdown } from "@/components/ui/dropdown";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PERMISSION_GROUPS, type Permission, type SafeUser, type AuditLogEntry } from "@/types/auth";

export default function EmployeesPage() {
  const [employees, setEmployees] = React.useState<SafeUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Dialog States
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [resetModalOpen, setResetModalOpen] = React.useState(false);
  const [activityModalOpen, setActivityModalOpen] = React.useState(false);

  // Selected Employee for Actions
  const [selectedEmployee, setSelectedEmployee] = React.useState<SafeUser | null>(null);
  const [activityLogs, setActivityLogs] = React.useState<AuditLogEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = React.useState(false);

  // Form States for Add Employee
  const [newName, setNewName] = React.useState("");
  const [newUsername, setNewUsername] = React.useState("");
  const [newEmail, setNewEmail] = React.useState("");
  const [newPhone, setNewPhone] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [newRole, setNewRole] = React.useState<"EMPLOYEE" | "OWNER">("EMPLOYEE");
  const [newPermissions, setNewPermissions] = React.useState<Permission[]>([]);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Form States for Edit Employee
  const [editName, setEditName] = React.useState("");
  const [editPhone, setEditPhone] = React.useState("");
  const [editStatus, setEditStatus] = React.useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [editPermissions, setEditPermissions] = React.useState<Permission[]>([]);

  // Form State for Password Reset
  const [resetPassword, setResetPassword] = React.useState("");

  const [refreshIndex, setRefreshIndex] = React.useState(0);

  React.useEffect(() => {
    fetch("/api/employees")
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.data?.employees) {
          setEmployees(data.data.employees);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  }, [refreshIndex]);

  const triggerRefresh = () => {
    setLoading(true);
    setRefreshIndex((prev) => prev + 1);
  };

  const handleOpenEdit = (emp: SafeUser) => {
    setSelectedEmployee(emp);
    setEditName(emp.name);
    setEditPhone(emp.phone || "");
    setEditStatus(emp.status);
    setEditPermissions(emp.permissions || []);
    setFormError(null);
    setEditModalOpen(true);
  };

  const handleOpenReset = (emp: SafeUser) => {
    setSelectedEmployee(emp);
    setResetPassword("");
    setFormError(null);
    setResetModalOpen(true);
  };

  const handleOpenActivity = async (emp: SafeUser) => {
    setSelectedEmployee(emp);
    setActivityModalOpen(true);
    setLoadingActivity(true);
    try {
      const res = await fetch(`/api/employees/${emp.id}/activity`);
      const data = await res.json();
      if (data.success && data.data?.logs) {
        setActivityLogs(data.data.logs);
      }
    } catch {
      setActivityLogs([]);
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleTogglePermission = (
    perm: Permission,
    currentList: Permission[],
    setList: React.Dispatch<React.SetStateAction<Permission[]>>
  ) => {
    if (currentList.includes(perm)) {
      setList(currentList.filter((p) => p !== perm));
    } else {
      setList([...currentList, perm]);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          username: newUsername,
          email: newEmail,
          phone: newPhone || undefined,
          password: newPassword,
          role: newRole,
          permissions: newRole === "OWNER" ? [] : newPermissions,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.error || "Failed to create employee");
        setSubmitting(false);
        return;
      }

      setAddModalOpen(false);
      // Reset form
      setNewName("");
      setNewUsername("");
      setNewEmail("");
      setNewPhone("");
      setNewPassword("");
      setNewPermissions([]);
      triggerRefresh();
    } catch {
      setFormError("Network error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/employees/${selectedEmployee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          phone: editPhone || undefined,
          status: editStatus,
          permissions: editPermissions,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.error || "Failed to update employee");
        setSubmitting(false);
        return;
      }

      setEditModalOpen(false);
      triggerRefresh();
    } catch {
      setFormError("Network error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/employees/${selectedEmployee.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: resetPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.error || "Failed to reset password");
        setSubmitting(false);
        return;
      }

      setResetModalOpen(false);
    } catch {
      setFormError("Network error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (emp: SafeUser) => {
    if (emp.role === "OWNER") return;
    const nextStatus = emp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        triggerRefresh();
      }
    } catch {
      // Handled gracefully
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.username.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q)
    );
  });

  const activeCount = employees.filter((e) => e.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Employee Management & Access Control
            </h1>
            <Badge variant="agri" size="sm">
              RBAC Enabled
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Configure staff accounts, role-based granular permissions, and security audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={triggerRefresh}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setFormError(null);
              setAddModalOpen(true);
            }}
            leftIcon={<UserPlus className="h-4 w-4" />}
          >
            Add New Staff
          </Button>
        </div>
      </div>

      {/* KPI Stats summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Staff Accounts</span>
            <Users className="h-4 w-4 text-[#176B3A]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{employees.length}</div>
          <div className="mt-1 text-[11px] text-slate-500">Proprietor & Operator accounts</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Operators</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{activeCount}</div>
          <div className="mt-1 text-[11px] text-slate-500">Authorized to sign in</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Security Architecture</span>
            <Shield className="h-4 w-4 text-sky-600" />
          </div>
          <div className="mt-2 text-base font-bold text-slate-900">Argon2id + HTTP Cookies</div>
          <div className="mt-1 text-[11px] text-slate-500">Zero-credential leakage design</div>
        </Card>
      </div>

      {/* Employee Table Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <CardTitle>Staff Directory</CardTitle>
            <CardDescription>
              All registered operators, roles, and assigned module privileges
            </CardDescription>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search name or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#176B3A] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#176B3A]"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Users className="h-6 w-6 text-[#176B3A]" />}
                title="No staff accounts found"
                description={
                  searchQuery
                    ? "No staff member matches your current search query."
                    : "Get started by adding your first operator or counter assistant."
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sign In</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{emp.name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                        <span>@{emp.username}</span> • <span>{emp.email}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {emp.role === "OWNER" ? (
                        <Badge variant="agri" size="sm" className="font-bold">
                          Proprietor (Owner)
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          Staff Operator
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      {emp.role === "OWNER" ? (
                        <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> Full System Access
                        </span>
                      ) : emp.permissions.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">No modules granted</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {emp.permissions.slice(0, 3).map((p) => (
                            <span
                              key={p}
                              className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700 font-mono"
                            >
                              {p.split(":")[0]}
                            </span>
                          ))}
                          {emp.permissions.length > 3 && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                              +{emp.permissions.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={emp.status === "ACTIVE" ? "success" : "danger"}
                        size="sm"
                        dot
                      >
                        {emp.status}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-slate-500">
                        {emp.lastLoginAt
                          ? new Date(emp.lastLoginAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Never"}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <Dropdown
                        trigger={
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            aria-label="Staff options"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        }
                        items={[
                          {
                            id: "edit",
                            label: "Edit Profile & Permissions",
                            icon: <Edit className="h-3.5 w-3.5" />,
                            onClick: () => handleOpenEdit(emp),
                          },
                          {
                            id: "reset",
                            label: "Reset Password",
                            icon: <Key className="h-3.5 w-3.5" />,
                            onClick: () => handleOpenReset(emp),
                          },
                          {
                            id: "activity",
                            label: "View Activity Logs",
                            icon: <History className="h-3.5 w-3.5" />,
                            onClick: () => handleOpenActivity(emp),
                          },
                          "divider",
                          {
                            id: "toggle-status",
                            label: emp.status === "ACTIVE" ? "Deactivate Account" : "Activate Account",
                            icon: <Power className="h-3.5 w-3.5" />,
                            destructive: emp.status === "ACTIVE",
                            disabled: emp.role === "OWNER",
                            onClick: () => handleToggleStatus(emp),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ----------------- DIALOG: ADD EMPLOYEE ----------------- */}
      <Dialog
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        title="Register New Staff Operator"
        description="Create credentials and assign granular permissions for store counter or warehouse staff."
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={submitting} onClick={handleAddEmployee}>
              Save & Register Staff
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddEmployee} className="space-y-4 pt-2">
          {formError && (
            <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Name"
              placeholder="e.g. K. Murugan"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <Input
              label="Username"
              placeholder="e.g. murugan_kasi"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Email Address"
              type="email"
              placeholder="e.g. murugan@kasiagri.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
            <Input
              label="Mobile Number"
              type="tel"
              placeholder="e.g. 9842100000"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Initial Password"
              type="password"
              placeholder="Min. 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              helperText="Must contain at least 1 uppercase or number"
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">Account Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "EMPLOYEE" | "OWNER")}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#176B3A] focus:outline-none focus:ring-1 focus:ring-[#176B3A]"
              >
                <option value="EMPLOYEE">Staff Operator (Configurable Permissions)</option>
                <option value="OWNER">Proprietor (Full Unrestricted Access)</option>
              </select>
            </div>
          </div>

          {/* Granular Permissions Matrix */}
          {newRole === "EMPLOYEE" && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-800">
                Module Permission Grants
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                {PERMISSION_GROUPS.map((group) => (
                  <div
                    key={group.name}
                    className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 text-xs space-y-1.5"
                  >
                    <div className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider text-[#176B3A]">
                      {group.name}
                    </div>
                    {group.permissions.map((p) => {
                      const checked = newPermissions.includes(p.key);
                      return (
                        <label
                          key={p.key}
                          className="flex items-start gap-2 cursor-pointer hover:text-slate-900 select-none text-[11px]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              handleTogglePermission(p.key, newPermissions, setNewPermissions)
                            }
                            className="mt-0.5 rounded border-slate-300 text-[#176B3A] focus:ring-[#176B3A]"
                          />
                          <div>
                            <span className="font-medium text-slate-800">{p.label}</span>
                            <p className="text-[10px] text-slate-500">{p.description}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      </Dialog>

      {/* ----------------- DIALOG: EDIT EMPLOYEE & PERMISSIONS ----------------- */}
      <Dialog
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        title={`Edit Staff Profile: ${selectedEmployee?.name}`}
        description="Update profile details, active status, and security permissions."
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={submitting} onClick={handleUpdateEmployee}>
              Save Changes
            </Button>
          </>
        }
      >
        <form onSubmit={handleUpdateEmployee} className="space-y-4 pt-2">
          {formError && (
            <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <Input
              label="Phone Number"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">Account Status</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="editStatus"
                  value="ACTIVE"
                  checked={editStatus === "ACTIVE"}
                  onChange={() => setEditStatus("ACTIVE")}
                  className="accent-[#176B3A]"
                />
                <span className="font-medium text-emerald-700">Active</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="editStatus"
                  value="INACTIVE"
                  disabled={selectedEmployee?.role === "OWNER"}
                  checked={editStatus === "INACTIVE"}
                  onChange={() => setEditStatus("INACTIVE")}
                  className="accent-rose-600"
                />
                <span className="font-medium text-rose-700">Inactive (Revokes all sessions)</span>
              </label>
            </div>
          </div>

          {/* Granular Permissions Matrix */}
          {selectedEmployee?.role !== "OWNER" ? (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-800">
                Assigned Permissions
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                {PERMISSION_GROUPS.map((group) => (
                  <div
                    key={group.name}
                    className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 text-xs space-y-1.5"
                  >
                    <div className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider text-[#176B3A]">
                      {group.name}
                    </div>
                    {group.permissions.map((p) => {
                      const checked = editPermissions.includes(p.key);
                      return (
                        <label
                          key={p.key}
                          className="flex items-start gap-2 cursor-pointer hover:text-slate-900 select-none text-[11px]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              handleTogglePermission(p.key, editPermissions, setEditPermissions)
                            }
                            className="mt-0.5 rounded border-slate-300 text-[#176B3A] focus:ring-[#176B3A]"
                          />
                          <div>
                            <span className="font-medium text-slate-800">{p.label}</span>
                            <p className="text-[10px] text-slate-500">{p.description}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
              This is the Proprietor account. It maintains full, unrestricted access to all modules automatically.
            </div>
          )}
        </form>
      </Dialog>

      {/* ----------------- DIALOG: RESET PASSWORD ----------------- */}
      <Dialog
        open={resetModalOpen}
        onOpenChange={setResetModalOpen}
        title={`Reset Password for ${selectedEmployee?.name}`}
        description="Set a new secure password. This will immediately revoke all current active sessions across all devices."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setResetModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={submitting} onClick={handleResetPassword}>
              Update & Revoke Sessions
            </Button>
          </>
        }
      >
        <form onSubmit={handleResetPassword} className="space-y-4 pt-2">
          {formError && (
            <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
              {formError}
            </div>
          )}

          <Input
            label="New Password"
            type="password"
            placeholder="Min. 8 characters with uppercase or number"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            required
            helperText="Requires at least 8 characters with 1 uppercase letter or number"
          />
        </form>
      </Dialog>

      {/* ----------------- DIALOG: ACTIVITY AUDIT LOGS ----------------- */}
      <Dialog
        open={activityModalOpen}
        onOpenChange={setActivityModalOpen}
        title={`Security Audit Trail: ${selectedEmployee?.name}`}
        description="Immutable record of authentication and sensitive administrative actions."
        maxWidth="lg"
        footer={
          <Button variant="outline" size="sm" onClick={() => setActivityModalOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-3 pt-2">
          {loadingActivity ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : activityLogs.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No audit log entries recorded for this account yet.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-slate-200/70 bg-slate-50/60 p-2.5 text-xs flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 font-mono text-[11px]">
                        {log.action}
                      </span>
                      {log.action === "LOGIN_SUCCESS" ? (
                        <Badge variant="success" size="sm">OK</Badge>
                      ) : log.action === "LOGIN_FAILED" ? (
                        <Badge variant="danger" size="sm">Failed</Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">Admin</Badge>
                      )}
                    </div>
                    {log.ipAddress && (
                      <p className="text-[10px] text-slate-400">IP: {log.ipAddress}</p>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      {new Date(log.timestamp).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
