
export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  partyName: string; // Customer or Supplier name
}

export interface Sale extends Transaction {
  status: 'completed' | 'pending';
}

export interface DailyClosing {
  id: string;
  date: string;
  createdAt: string;
  
  // Actual Counts (Jard)
  cashActual: number;
  cardActual: number;
  totalActual: number;
  
  // System Totals (POS Z-Report)
  cashSystem: number;
  cardSystem: number;
  totalSystem: number;
  
  // Variance
  variance: number;
  
  // Financials
  netSales: number;
  vatAmount: number;
  discountAmount: number;
  grossSales: number;
  tips: number;

  // Details
  details: {
    cashDenominations: Record<string, number>;
    cardReconcile: Record<string, number>;
    posInputs: Record<string, number>;
    terminalDetails?: Record<string, Record<string, number>>;
  };
}

export interface InvoiceItem {
  id: string;
  code?: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Purchase extends Transaction {
  invoiceNumber?: string;
  status: 'received' | 'ordered';
  items?: InvoiceItem[];
  currency?: string;
  taxNumber?: string;
  paymentMethod?: 'cash' | 'credit' | 'transfer';
  skipInventory?: boolean;
  isTaxExempt?: boolean;
  discountAmount?: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  cost: number;
  category: string;
  createdAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  balance: number;
  taxNumber?: string;
  code?: string;
}

export interface Employee {
  id: string;
  code?: string;
  name: string;
  role: string;
  phone?: string;
  salary: number;
  joinDate?: string;
}

export type SalaryTransactionType = 'loan' | 'deduction' | 'meal' | 'shortage' | 'bonus' | 'salary_payment';

export interface SalaryTransaction {
  id: string;
  employeeId: string;
  date: string;
  amount: number;
  type: SalaryTransactionType;
  notes?: string;
}

export interface Custody {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  dateGiven: string;
  status: 'active' | 'closed';
  expenses?: number;
  returnAmount?: number;
  notes?: string;
}

export interface GeneralExpense {
  id: string;
  date: string;
  category: 'rent' | 'electricity' | 'maintenance' | 'marketing' | 'gov_fees' | 'flight_tickets' | 'other';
  description: string;
  amount: number;
  taxAmount?: number;
  paymentMethod: 'cash' | 'transfer';
  notes?: string;
  createdAt?: string;
}

// Fix: Define PaperExpense interface to resolve import error in PaperExpenses.tsx
export interface PaperExpense {
  id: string;
  date: string;
  description: string;
  amount: number;
  notes?: string;
  createdAt?: string;
}

// Authentication Types - Updated Roles
// Fix: Add 'chef' to UserRole to resolve type overlap errors in Dashboard.tsx comparisons
export type UserRole = 'it' | 'owner' | 'admin' | 'accountant' | 'cashier' | 'chef';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  avatar?: string;
  email?: string;
}

// Audit Log Type
export interface AuditLogEntry {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action: 'create' | 'update' | 'delete' | 'login';
  resource: string;
  details: string;
  timestamp: string;
}
