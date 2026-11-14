export type UserRole = "OWNER" | "EMPLOYEE";

export type UserStatus = "ACTIVE" | "INACTIVE";

export const PERMISSIONS = [
  "inventory:read",
  "inventory:write",
  "inventory:delete",
  "inventory:view",
  "inventory:manage",
  "billing:create",
  "billing:view",
  "billing:manage",
  "farmers:view",
  "farmers:manage",
  "suppliers:view",
  "suppliers:manage",
  "ledger:view",
  "ledger:manage",
  "reports:view",
  "employees:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface PermissionGroup {
  name: string;
  permissions: {
    key: Permission;
    label: string;
    description: string;
  }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    name: "Inventory & Stocks",
    permissions: [
      { key: "inventory:read", label: "View Products & Stocks", description: "Can check catalog, stock levels, and prices" },
      { key: "inventory:write", label: "Manage Products & Categories", description: "Can create and edit products, categories, and conversions" },
      { key: "inventory:delete", label: "Archive / Delete Inventory", description: "Can deactivate or archive products and categories" },
    ],
  },
  {
    name: "Billing & Counter PoS",
    permissions: [
      { key: "billing:create", label: "Create Bills", description: "Can issue counter bills and invoices" },
      { key: "billing:view", label: "View Billing History", description: "Can view past invoices" },
      { key: "billing:manage", label: "Cancel & Edit Bills", description: "Can cancel or refund issued bills" },
    ],
  },
  {
    name: "Farmers & Customers",
    permissions: [
      { key: "farmers:view", label: "View Farmers", description: "Can browse farmer profiles and contacts" },
      { key: "farmers:manage", label: "Manage Accounts", description: "Can register or edit farmer accounts" },
    ],
  },
  {
    name: "Suppliers & Purchases",
    permissions: [
      { key: "suppliers:view", label: "View Suppliers", description: "Can view supplier listings" },
      { key: "suppliers:manage", label: "Manage Purchase Orders", description: "Can create and receive supplier POs" },
    ],
  },
  {
    name: "Credit Ledger (Khata)",
    permissions: [
      { key: "ledger:view", label: "View Ledger", description: "Can inspect farmer outstanding balances" },
      { key: "ledger:manage", label: "Record Settlements", description: "Can enter credit payments & receipts" },
    ],
  },
  {
    name: "Reports & GST",
    permissions: [
      { key: "reports:view", label: "View Reports", description: "Can view daily sales, GST, and inventory logs" },
    ],
  },
  {
    name: "User & Employee Admin",
    permissions: [
      { key: "employees:manage", label: "Manage Staff", description: "Can create, edit, and reset employee accounts" },
    ],
  },
];

export interface SafeUser {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
  role: UserRole;
  permissions: Permission[];
  status: UserStatus;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: SafeUser;
  expiresAt: string;
}

export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "EMPLOYEE_CREATED"
  | "EMPLOYEE_UPDATED"
  | "EMPLOYEE_DEACTIVATED"
  | "EMPLOYEE_ACTIVATED"
  | "PASSWORD_RESET"
  | "PERMISSIONS_UPDATED"
  | "OWNER_BOOTSTRAP";

export interface AuditLogEntry {
  id: string;
  userId?: string;
  userName?: string;
  action: AuditAction;
  targetUserId?: string;
  targetUserName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  timestamp: string;
}

