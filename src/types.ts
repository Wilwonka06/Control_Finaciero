export type TransactionType = 'income' | 'expense';

export interface Contribution {
  id: string;
  amount: number;
  date: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  contributions: Contribution[];
  deadline?: string;
  createdAt: string;
}

export interface Currency {
  code: string;
  name: string;
}
