/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, FormEvent, ErrorInfo, ReactNode } from 'react';
import { 
  PlusCircle, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PieChart as PieChartIcon, 
  History, 
  Target, 
  Trash2,
  ChevronRight,
  Plus,
  X,
  Settings,
  Calendar,
  ArrowUpRight,
  Coins,
  Mail,
  Linkedin,
  Github,
  Instagram,
  LogOut,
  LogIn
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, Goal, TransactionType, Currency, Contribution } from './types';
import { cn, formatCurrency } from './lib/utils';

// Firebase Imports
import { auth, db, googleProvider } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  setDoc, 
  query, 
  orderBy,
  getDoc,
  getDocFromServer
} from 'firebase/firestore';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <X size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Algo salió mal</h2>
            <p className="text-slate-500">Hubo un error al cargar tus datos. Por favor, intenta recargar la página.</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all"
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

function Dashboard() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Record<TransactionType, string[]>>({
    income: ['Sueldo', 'Venta', 'Inversión', 'Regalo', 'Otros'],
    expense: ['Comida', 'Transporte', 'Vivienda', 'Entretenimiento', 'Salud', 'Educación', 'Otros']
  });
  const [selectedCurrency, setSelectedCurrency] = useState('COP');
  
  const [currencies, setCurrencies] = useState<Currency[]>([
    { code: 'COP', name: 'Peso Colombiano' },
    { code: 'USD', name: 'Dólar Estadounidense' },
    { code: 'EUR', name: 'Euro' },
    { code: 'MXN', name: 'Peso Mexicano' },
    { code: 'ARS', name: 'Peso Argentino' },
    { code: 'CLP', name: 'Peso Chileno' },
    { code: 'BRL', name: 'Real Brasileño' }
  ]);
  const [viewMode, setViewMode] = useState<'general' | 'monthly'>('general');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showContributionModal, setShowContributionModal] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Form states
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');

  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionDate, setContributionDate] = useState(new Date().toISOString().slice(0, 10));

  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TransactionType>('expense');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });

    // Connection Test
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error: any) {
        if (error.message?.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, []);

  // Firestore Listeners
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setGoals([]);
      return;
    }

    // Transactions Listener
    const qTransactions = query(
      collection(db, 'users', user.uid, 'transactions'),
      orderBy('date', 'desc')
    );
    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(list);
    }, (error) => handleFirestoreError(error, 'list', `users/${user.uid}/transactions`));

    // Goals Listener
    const qGoals = collection(db, 'users', user.uid, 'goals');
    const unsubGoals = onSnapshot(qGoals, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        contributions: (doc.data() as any).contributions || []
      } as Goal));
      setGoals(list);
    }, (error) => handleFirestoreError(error, 'list', `users/${user.uid}/goals`));

    // Settings Listener
    const docSettings = doc(db, 'users', user.uid, 'settings', 'main');
    const unsubSettings = onSnapshot(docSettings, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.categories) setCategories(data.categories);
        if (data.currency) setSelectedCurrency(data.currency);
      }
    }, (error) => handleFirestoreError(error, 'get', `users/${user.uid}/settings/main`));

    return () => {
      unsubTransactions();
      unsubGoals();
      unsubSettings();
    };
  }, [user]);

  // Error Handler
  const handleFirestoreError = (error: any, operationType: string, path: string) => {
    const errInfo = {
      error: error.message,
      operationType,
      path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified
      }
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
  };

  // Auth Handlers
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login Error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout Error:', error);
    }
  };

  // Fetch Currencies
  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const res = await fetch('https://api.frankfurter.app/currencies');
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        const list = Object.entries(data).map(([code, name]) => ({ code, name: name as string }));
        // Merge with defaults to ensure we have the most common ones even if API differs
        setCurrencies(prev => {
          const codes = new Set(list.map(c => c.code));
          const filteredPrev = prev.filter(c => !codes.has(c.code));
          return [...list, ...filteredPrev].sort((a, b) => a.code.localeCompare(b.code));
        });
      } catch (err) {
        console.warn('Using fallback currencies due to fetch error:', err);
      }
    };
    fetchCurrencies();
  }, []);

  // Filtering
  const filteredTransactions = useMemo(() => {
    if (viewMode === 'general') return transactions;
    return transactions.filter(t => t.date.startsWith(selectedMonth));
  }, [transactions, viewMode, selectedMonth]);

  // Calculations
  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      income,
      expenses,
      balance: income - expenses
    };
  }, [filteredTransactions]);

  const chartData = useMemo(() => {
    return [
      { name: 'Ingresos', value: totals.income, color: '#10b981' },
      { name: 'Gastos', value: totals.expenses, color: '#ef4444' }
    ];
  }, [totals]);

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
      cats[t.category] = (cats[t.category] || 0) + t.amount;
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [filteredTransactions]);

  // Handlers
  const handleAddTransaction = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !desc || !amount || !category) return;

    const newTransaction = {
      description: desc,
      amount: parseFloat(amount),
      type,
      category,
      date: date
    };

    try {
      await addDoc(collection(db, 'users', user.uid, 'transactions'), newTransaction);
      setDesc('');
      setAmount('');
      setDate(new Date().toISOString().slice(0, 10));
      setShowAddModal(false);
    } catch (error) {
      handleFirestoreError(error, 'create', `users/${user.uid}/transactions`);
    }
  };

  const handleAddGoal = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !goalName || !goalTarget) return;

    const newGoal = {
      name: goalName,
      targetAmount: parseFloat(goalTarget),
      contributions: [],
      deadline: goalDeadline || null,
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'users', user.uid, 'goals'), newGoal);
      setGoalName('');
      setGoalTarget('');
      setGoalDeadline('');
      setShowGoalModal(false);
    } catch (error) {
      handleFirestoreError(error, 'create', `users/${user.uid}/goals`);
    }
  };

  const handleAddContribution = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !showContributionModal || !contributionAmount) return;

    const amount = parseFloat(contributionAmount);
    if (amount > totals.balance) {
      alert('No tienes suficiente balance para esta contribución.');
      return;
    }

    const goal = goals.find(g => g.id === showContributionModal);
    if (!goal) return;

    const newContribution: Contribution = {
      id: crypto.randomUUID(),
      amount: amount,
      date: contributionDate
    };

    try {
      // Update Goal
      const goalRef = doc(db, 'users', user.uid, 'goals', goal.id);
      await setDoc(goalRef, {
        ...goal,
        contributions: [...(goal.contributions || []), newContribution]
      });

      // Add Transaction
      const savingTransaction = {
        description: `Ahorro: ${goal.name}`,
        amount: amount,
        type: 'expense',
        category: 'Ahorro',
        date: contributionDate
      };
      await addDoc(collection(db, 'users', user.uid, 'transactions'), savingTransaction);

      setContributionAmount('');
      setContributionDate(new Date().toISOString().slice(0, 10));
      setShowContributionModal(null);
    } catch (error) {
      handleFirestoreError(error, 'write', `users/${user.uid}/goals/${goal.id}`);
    }
  };

  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !newCatName) return;
    if (categories[newCatType].includes(newCatName)) return;

    const updatedCategories = {
      ...categories,
      [newCatType]: [...categories[newCatType], newCatName]
    };

    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'main'), {
        categories: updatedCategories,
        currency: selectedCurrency
      }, { merge: true });
      setNewCatName('');
    } catch (error) {
      handleFirestoreError(error, 'write', `users/${user.uid}/settings/main`);
    }
  };

  const deleteCategory = async (type: TransactionType, cat: string) => {
    if (!user) return;
    const updatedCategories = {
      ...categories,
      [type]: categories[type].filter(c => c !== cat)
    };

    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'main'), {
        categories: updatedCategories
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, 'write', `users/${user.uid}/settings/main`);
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, 'delete', `users/${user.uid}/transactions/${id}`);
    }
  };

  const deleteGoal = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'goals', id));
    } catch (error) {
      handleFirestoreError(error, 'delete', `users/${user.uid}/goals/${id}`);
    }
  };

  const updateCurrency = async (currency: string) => {
    if (!user) return;
    setSelectedCurrency(currency);
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'main'), {
        currency
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, 'write', `users/${user.uid}/settings/main`);
    }
  };

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#64748b'];

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl border border-slate-100 max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-4">
            <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-slate-900/20">
              <Wallet size={40} className="text-white" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Finanzas Pro</h1>
            <p className="text-slate-500 text-lg">Toma el control total de tu dinero en cualquier dispositivo.</p>
          </div>

          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-4 bg-white border-2 border-slate-100 py-4 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-200 transition-all shadow-sm active:scale-[0.98]"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
            Continuar con Google
          </button>

          <p className="text-xs text-slate-400">
            Al continuar, aceptas que tus datos financieros se guarden de forma segura en la nube.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Finanzas Pro</h1>
            <p className="text-slate-500">Hola, {user.displayName?.split(' ')[0] || 'Usuario'}</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleLogout}
              className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm active:scale-95"
              title="Cerrar Sesión"
            >
              <LogOut size={20} />
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-95"
              title="Configuración"
            >
              <Settings size={20} className="text-slate-600" />
            </button>
            <button 
              onClick={() => { setType('expense'); setCategory(categories.expense[0]); setShowAddModal(true); }}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition-all shadow-sm active:scale-95"
            >
              <PlusCircle size={18} />
              Nuevo Movimiento
            </button>
            <button 
              onClick={() => setShowGoalModal(true)}
              className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-95"
            >
              <Target size={18} />
              Nueva Meta
            </button>
          </div>
        </header>

        {/* View Mode & Month Selector */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button 
              onClick={() => setViewMode('general')}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-lg transition-all",
                viewMode === 'general' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              )}
            >
              General
            </button>
            <button 
              onClick={() => setViewMode('monthly')}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-lg transition-all",
                viewMode === 'monthly' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              )}
            >
              Mensual
            </button>
          </div>

          {viewMode === 'monthly' && (
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-slate-400" />
              <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 cursor-pointer"
              />
            </div>
          )}

          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Coins size={18} className="text-slate-400" />
            <select 
              value={selectedCurrency}
              onChange={(e) => updateCurrency(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 cursor-pointer p-0"
            >
              {currencies.map(c => (
                <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4"
          >
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Balance {viewMode === 'monthly' ? 'del Mes' : 'Total'}</p>
              <p className="text-2xl font-bold">{formatCurrency(totals.balance, selectedCurrency)}</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4"
          >
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Ingresos {viewMode === 'monthly' ? 'del Mes' : 'Totales'}</p>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.income, selectedCurrency)}</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4"
          >
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
              <TrendingDown size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Gastos {viewMode === 'monthly' ? 'del Mes' : 'Totales'}</p>
              <p className="text-2xl font-bold text-rose-600">{formatCurrency(totals.expenses, selectedCurrency)}</p>
            </div>
          </motion.div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Charts & Goals */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-6">
                  <PieChartIcon size={18} className="text-slate-400" />
                  <h2 className="font-semibold">Resumen General</h2>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        cursor={{ fill: '#f8fafc' }}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-6">
                  <PieChartIcon size={18} className="text-slate-400" />
                  <h2 className="font-semibold">Gastos por Categoría</h2>
                </div>
                <div className="h-64">
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                      Sin datos de gastos
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Goals Section */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Target size={18} className="text-slate-400" />
                  <h2 className="font-semibold">Metas de Ahorro</h2>
                </div>
                <button 
                  onClick={() => setShowGoalModal(true)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                >
                  <Plus size={16} /> Ver todas
                </button>
              </div>
              
              <div className="space-y-6">
                {goals.length > 0 ? (
                  goals.map(goal => {
                    const goalTotal = (goal.contributions || []).reduce((sum, c) => sum + c.amount, 0);
                    const progress = Math.min((goalTotal / goal.targetAmount) * 100, 100);
                    return (
                      <div key={goal.id} className="space-y-2 p-4 rounded-2xl border border-slate-50 hover:bg-slate-50 transition-colors group">
                        <div className="flex justify-between text-sm">
                          <div>
                            <span className="font-medium">{goal.name}</span>
                            {goal.deadline && (
                              <p className="text-xs text-slate-400">Plazo: {new Date(goal.deadline).toLocaleDateString()}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 block">{formatCurrency(goalTotal, selectedCurrency)} / {formatCurrency(goal.targetAmount, selectedCurrency)}</span>
                          </div>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className={cn(
                              "h-full rounded-full",
                              progress >= 100 ? "bg-emerald-500" : "bg-blue-500"
                            )}
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-slate-400">
                            {progress >= 100 ? "¡Meta alcanzada!" : `${progress.toFixed(1)}% completado`}
                          </p>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setShowContributionModal(goal.id)}
                              className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                            >
                              Aportar
                            </button>
                            <button 
                              onClick={() => deleteGoal(goal.id)}
                              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <p className="text-sm">No tienes metas activas</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: History */}
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-full">
              <div className="flex items-center gap-2 mb-6">
                <History size={18} className="text-slate-400" />
                <h2 className="font-semibold">Historial Reciente</h2>
              </div>
              
              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {transactions.length > 0 ? (
                    transactions.slice(0, 10).map(t => (
                      <motion.div 
                        key={t.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="group flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-xl",
                            t.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                          )}>
                            {t.type === 'income' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{t.description}</p>
                            <p className="text-xs text-slate-400">{t.category} • {new Date(t.date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "text-sm font-bold",
                            t.type === 'income' ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, selectedCurrency)}
                          </span>
                          <button 
                            onClick={() => {
                              alert('Los montos de los movimientos no son editables por seguridad.');
                            }}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-500 transition-all"
                          >
                            <Settings size={14} />
                          </button>
                          <button 
                            onClick={() => deleteTransaction(t.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <p className="text-sm">No hay movimientos registrados</p>
                    </div>
                  )}
                </AnimatePresence>
                {transactions.length > 10 && (
                  <button className="w-full py-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
                    Ver todo el historial
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 py-12 bg-slate-900 text-white rounded-t-[3rem] -mx-4 md:-mx-8 px-4 md:px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-xl font-bold">Finanzas Pro</h3>
            <p className="text-slate-400 text-sm">Gestiona tu futuro financiero hoy.</p>
            <p className="text-slate-500 text-xs mt-4">© 2026 by Wilson Rojas</p>
          </div>

          <div className="flex flex-col items-center md:items-end gap-4">
            <p className="text-sm font-medium text-slate-400 uppercase tracking-widest">Conéctate</p>
            <div className="flex gap-4">
              <a 
                href="mailto:rojaswil336@gmail.com" 
                className="p-3 bg-slate-800 rounded-2xl hover:bg-blue-600 transition-all hover:scale-110 active:scale-95"
                title="Correo"
              >
                <Mail size={20} />
              </a>
              <a 
                href="https://www.linkedin.com/in/wilson-rojas-palacios-5a831431b/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-3 bg-slate-800 rounded-2xl hover:bg-[#0077b5] transition-all hover:scale-110 active:scale-95"
                title="LinkedIn"
              >
                <Linkedin size={20} />
              </a>
              <a 
                href="https://github.com/Wilwonka06" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-3 bg-slate-800 rounded-2xl hover:bg-[#333] transition-all hover:scale-110 active:scale-95"
                title="GitHub"
              >
                <Github size={20} />
              </a>
              <a 
                href="https://www.instagram.com/rp__wilson?igsh=MTg3NTM1eXZ3OHVhMg==" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-3 bg-slate-800 rounded-2xl hover:bg-[#e4405f] transition-all hover:scale-110 active:scale-95"
                title="Instagram"
              >
                <Instagram size={20} />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Nuevo Movimiento</h2>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="space-y-4">
                <div className="flex p-1 bg-slate-100 rounded-xl">
                  <button 
                    type="button"
                    onClick={() => { setType('expense'); setCategory(categories.expense[0]); }}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                      type === 'expense' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500"
                    )}
                  >
                    Gasto
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setType('income'); setCategory(categories.income[0]); }}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                      type === 'income' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500"
                    )}
                  >
                    Ingreso
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Fecha</label>
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Monto</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">{selectedCurrency}</span>
                      <input 
                        type="number" 
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Descripción</label>
                  <input 
                    type="text" 
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="Ej. Compra semanal"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Categoría</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none bg-white"
                    required
                  >
                    {categories[type].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 active:scale-[0.98]"
                >
                  Guardar Movimiento
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Goal Modal */}
      <AnimatePresence>
        {showGoalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGoalModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Nueva Meta de Ahorro</h2>
                <button onClick={() => setShowGoalModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddGoal} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Nombre de la meta</label>
                  <input 
                    type="text" 
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    placeholder="Ej. Fondo de emergencia"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Monto Objetivo</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">{selectedCurrency}</span>
                      <input 
                        type="number" 
                        step="0.01"
                        value={goalTarget}
                        onChange={(e) => setGoalTarget(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Fecha Límite (Opcional)</label>
                    <input 
                      type="date" 
                      value={goalDeadline}
                      onChange={(e) => setGoalDeadline(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/10 active:scale-[0.98]"
                >
                  Crear Meta
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Contribution Modal */}
      <AnimatePresence>
        {showContributionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowContributionModal(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Aportar a: {goals.find(g => g.id === showContributionModal)?.name}</h2>
                <button onClick={() => setShowContributionModal(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddContribution} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Monto a destinar</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">{selectedCurrency}</span>
                    <input 
                      type="number" 
                      step="0.01"
                      value={contributionAmount}
                      onChange={(e) => setContributionAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                      required
                    />
                  </div>
                  <p className="text-xs text-slate-500">Balance disponible: {formatCurrency(totals.balance, selectedCurrency)}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Fecha del aporte</label>
                  <input 
                    type="date" 
                    value={contributionDate}
                    onChange={(e) => setContributionDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    required
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10 active:scale-[0.98]"
                >
                  Confirmar Aporte
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-6 space-y-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Configuración</h2>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              {/* Currency Selection */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-semibold">
                  <Coins size={18} />
                  <h3>Moneda Principal</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select 
                    value={selectedCurrency}
                    onChange={(e) => updateCurrency(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                  >
                    {currencies.map(c => (
                      <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                  <div className="p-4 bg-blue-50 rounded-xl text-blue-700 text-sm">
                    Los tipos de cambio se obtienen de la API de Frankfurter.
                  </div>
                </div>
              </section>

              {/* Category Management */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-semibold">
                  <Settings size={18} />
                  <h3>Gestionar Categorías</h3>
                </div>
                
                <form onSubmit={handleAddCategory} className="flex gap-2">
                  <select 
                    value={newCatType}
                    onChange={(e) => setNewCatType(e.target.value as TransactionType)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
                  >
                    <option value="expense">Gasto</option>
                    <option value="income">Ingreso</option>
                  </select>
                  <input 
                    type="text" 
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Nueva categoría..."
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                  <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold">
                    Añadir
                  </button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gastos</h4>
                    <div className="flex flex-wrap gap-2">
                      {categories.expense.map(cat => (
                        <div key={cat} className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-lg text-sm group">
                          {cat}
                          <button onClick={() => deleteCategory('expense', cat)} className="text-slate-400 hover:text-rose-500">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ingresos</h4>
                    <div className="flex flex-wrap gap-2">
                      {categories.income.map(cat => (
                        <div key={cat} className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-lg text-sm group">
                          {cat}
                          <button onClick={() => deleteCategory('income', cat)} className="text-slate-400 hover:text-rose-500">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}
