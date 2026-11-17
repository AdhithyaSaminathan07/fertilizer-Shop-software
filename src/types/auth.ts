export type UserRole = "OWNER" | "EMPLOYEE";

export type UserStatus = "ACTIVE" | "INACTIVE";

export const PERMISSIONS = [
  "inventory:read",
  "inventory:write",
  "inventory:delete",
  "inventory:view",
  "inventory:manage",
  "inventory:adjust",
  "inventory:approve",
  "billing:create",
  "billing:view",
  "billing:manage",
  "farmers:view",
  "farmers:manage",
  "suppliers:view",
  "suppliers:manage",
  "ledger:view",
  "ledger:manage",
  "expenses:view",
  "expenses:manage",
  "cashbook:view",
  "cashbook:manage",
  "returns:view",
  "returns:create",
  "returns:manage",
  "returns:approve",
  "reports:view",
  "employees:manage",
  "settings:view",
  "settings:manage",
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
      { key: "inventory:adjust", label: "Stock Adjustments & Write-offs", description: "Can record stock corrections, damaged goods, and write-offs" },
      { key: "inventory:approve", label: "Approve Stock Reconciliation", description: "Can approve physical stock counts and valuation adjustments" },
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
    name: "Daily Expenses & Operations",
    permissions: [
      { key: "expenses:view", label: "View Expenses", description: "Can view business expenses and categories" },
      { key: "expenses:manage", label: "Manage Expenses", description: "Can record, edit, and reverse expenses" },
    ],
  },
  {
    name: "Business Cashbook",
    permissions: [
      { key: "cashbook:view", label: "View Cashbook", description: "Can view cashbook entries and reports" },
      { key: "cashbook:manage", label: "Manage Cashbook", description: "Can configure opening balances and adjust accounts" },
    ],
  },
  {
    name: "Sales & Purchase Returns",
    permissions: [
      { key: "returns:view", label: "View Returns", description: "Can view customer sales and supplier purchase returns" },
      { key: "returns:create", label: "Create Returns", description: "Can initiate customer sales returns and supplier purchase returns" },
      { key: "returns:manage", label: "Manage & Edit Returns", description: "Can edit draft returns and cancel return requests" },
      { key: "returns:approve", label: "Approve Returns", description: "Can authorize and approve or reject sales and purchase returns" },
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
  {
    name: "Settings & Shop Profile",
    permissions: [
      { key: "settings:view", label: "View Shop Settings", description: "Can view shop profile and application preferences" },
      { key: "settings:manage", label: "Manage Shop Settings", description: "Can update business profile, tax registration, and preferences" },
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
  | "OWNER_BOOTSTRAP"
  | "SETTINGS_UPDATED"
  | "BUSINESS_PROFILE_UPDATED"
  | "PREFERENCES_UPDATED"
  | "LOGO_UPDATED"
  | "SUPPLIER_PAYMENT_RECORDED"
  | "SUPPLIER_PAYMENT_REVERSED"
  | "SALE_CREATED"
  | "SALE_CANCELLED"
  | "CUSTOMER_CREATED"
  | "CUSTOMER_UPDATED"
  | "CUSTOMER_PAYMENT_RECORDED"
  | "CUSTOMER_PAYMENT_REVERSED"
  | "EXPENSE_CREATED"
  | "EXPENSE_UPDATED"
  | "EXPENSE_REVERSED"
  | "EXPENSE_CATEGORY_CREATED"
  | "EXPENSE_CATEGORY_UPDATED"
  | "CASHBOOK_OPENING_BALANCE_CONFIGURED"
  | "STOCK_ADJUSTMENT_CREATED"
  | "STOCK_ADJUSTMENT_APPROVED"
  | "STOCK_ADJUSTMENT_REJECTED"
  | "STOCK_COUNT_SESSION_CREATED"
  | "STOCK_COUNT_SESSION_SUBMITTED"
  | "STOCK_COUNT_SESSION_APPROVED"
  | "REORDER_SETTINGS_UPDATED"
  | "SALES_RETURN_CREATED"
  | "SALES_RETURN_UPDATED"
  | "SALES_RETURN_APPROVED"
  | "SALES_RETURN_REJECTED"
  | "SALES_RETURN_CANCELLED"
  | "PURCHASE_RETURN_CREATED"
  | "PURCHASE_RETURN_UPDATED"
  | "PURCHASE_RETURN_APPROVED"
  | "PURCHASE_RETURN_REJECTED"
  | "PURCHASE_RETURN_CANCELLED";

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

