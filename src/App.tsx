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
  LogIn,
  Moon,
  Sun,
  User as UserIcon,
  Key,
  Eye,
  EyeOff,
  Menu
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
import { MessageSquare, Bell, FileUp, FileDown, Sparkles, Send, Loader2, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { Transaction, Goal, TransactionType, Currency, Contribution } from './types';
import { cn, formatCurrency } from './lib/utils';
import ReactMarkdown from 'react-markdown';
import { analyzeFinances, parseExcelData, predictFinances } from './services/geminiService';
import * as XLSX from 'xlsx';

// Firebase Imports
import { auth, db, googleProvider } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
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
  getDocFromServer,
  updateDoc
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

const Logo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <div className={cn("bg-slate-900 dark:bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-900/10 transition-colors", className)}>
    <Wallet className="text-white w-1/2 h-1/2" strokeWidth={2.5} />
  </div>
);

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
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [trm, setTrm] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<{ id: string, text: string, type: 'info' | 'success' | 'warning', read: boolean }[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [showGoalDetails, setShowGoalDetails] = useState<string | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

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

  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ COP: 1 });

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

  // Dark Mode Effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

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

  // Fetch Exchange Rates
  useEffect(() => {
    const fetchRates = async () => {
      try {
        // We use COP as the base for our internal data
        const res = await fetch('https://open.er-api.com/v6/latest/COP');
        if (!res.ok) throw new Error('Failed to fetch rates');
        const data = await res.json();
        setExchangeRates(data.rates);
      } catch (err) {
        console.warn('Error fetching exchange rates:', err);
      }
    };
    fetchRates();
  }, []);

  // Auth Handlers
  const handleLogin = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Login Error:', error);
      if (error.code === 'auth/network-request-failed') {
        setAuthError('Error de red: No se pudo conectar con Firebase. Revisa tu conexión a internet o si tienes un bloqueador de anuncios activado.');
      } else if (error.code === 'auth/popup-blocked') {
        setAuthError('El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para iniciar sesión.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        setAuthError('Inicio de sesión cancelado.');
      } else {
        setAuthError('Error al iniciar sesión: ' + (error.message || 'Inténtalo de nuevo.'));
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout Error:', error);
    }
  };

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        await updateProfile(userCredential.user, { displayName: authName });
      } else if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else if (authMode === 'reset') {
        await sendPasswordResetEmail(auth, authEmail);
        alert('Se ha enviado un correo para restablecer tu contraseña.');
        setAuthMode('login');
      }
    } catch (error: any) {
      console.error('Auth Error:', error);
      if (error.code === 'auth/invalid-credential') {
        setAuthError('Correo o contraseña incorrectos. Si no tienes cuenta, asegúrate de registrarte primero.');
      } else if (error.code === 'auth/operation-not-allowed') {
        setAuthError('El inicio de sesión por correo no está habilitado. Por favor, actívalo en la consola de Firebase.');
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError('Este correo ya está registrado. Intenta iniciar sesión.');
      } else {
        setAuthError(error.message || 'Ocurrió un error en la autenticación.');
      }
    } finally {
      setAuthLoading(false);
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

  // Fetch TRM (Colombia)
  useEffect(() => {
    const fetchTRM = async () => {
      try {
        const res = await fetch('https://trm-colombia.vercel.app/api/trm/current');
        const data = await res.json();
        if (data.valor) setTrm(data.valor);
      } catch (err) {
        console.warn('Error fetching TRM:', err);
      }
    };
    fetchTRM();
  }, []);

  // Goal Notifications Logic
  useEffect(() => {
    if (goals.length === 0) return;
    
    const newNotifications: any[] = [];
    goals.forEach(goal => {
      const current = (goal.contributions || []).reduce((sum, c) => sum + c.amount, 0);
      const progress = (current / goal.targetAmount) * 100;
      
      if (progress >= 100) {
        newNotifications.push({
          id: `goal-complete-${goal.id}`,
          text: `¡Felicidades! Has alcanzado tu meta: ${goal.name}`,
          type: 'success',
          read: false
        });
      } else if (progress >= 80) {
        newNotifications.push({
          id: `goal-near-${goal.id}`,
          text: `Estás muy cerca de tu meta: ${goal.name} (${progress.toFixed(0)}%)`,
          type: 'info',
          read: false
        });
      }
    });

    setNotifications(prev => {
      const existingIds = new Set(prev.map(n => n.id));
      const filteredNew = newNotifications.filter(n => !existingIds.has(n.id));
      return [...prev, ...filteredNew];
    });
  }, [goals]);

  // Chat Handlers
  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isTyping) return;

    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    const response = await analyzeFinances(transactions, goals, userMsg);
    setChatMessages(prev => [...prev, { role: 'ai', text: response }]);
    setIsTyping(false);
  };

  // Excel Import Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const csvText = XLSX.utils.sheet_to_csv(worksheet);

          const importedData = await parseExcelData(csvText);
          
          // Save to Firestore
          const batch = importedData.map(t => 
            addDoc(collection(db, 'users', user.uid, 'transactions'), {
              ...t,
              date: t.date || new Date().toISOString().slice(0, 10)
            })
          );
          await Promise.all(batch);
          
          setNotifications(prev => [
            { id: crypto.randomUUID(), text: `Se importaron ${importedData.length} transacciones correctamente.`, type: 'success', read: false },
            ...prev
          ]);
        } catch (error) {
          console.error("Import Error:", error);
          setNotifications(prev => [
            { id: crypto.randomUUID(), text: "Error al procesar el archivo. Asegúrate de que tenga un formato válido.", type: 'warning', read: false },
            ...prev
          ]);
        } finally {
          setIsImporting(false);
          // Reset file input
          e.target.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('File Read Error:', error);
      setIsImporting(false);
      alert('Error al leer el archivo.');
    }
  };

  const handleExportData = () => {
    const dataToExport = transactions.map(t => ({
      Fecha: t.date,
      Descripción: t.description,
      Monto: t.amount,
      Tipo: t.type === 'income' ? 'Ingreso' : 'Gasto',
      Categoría: t.category
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transacciones");
    XLSX.writeFile(wb, `Finanzas_Pro_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    
    setNotifications(prev => [
      { id: crypto.randomUUID(), text: "Datos exportados correctamente a Excel.", type: 'success', read: false },
      ...prev
    ]);
  };

  // Filtering
  const filteredTransactions = useMemo(() => {
    if (viewMode === 'general') return transactions;
    return transactions.filter(t => t.date.startsWith(selectedMonth));
  }, [transactions, viewMode, selectedMonth]);

  // Calculations
  const totals = useMemo(() => {
    const rate = exchangeRates[selectedCurrency] || 1;
    
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
      
    return {
      income: income * rate,
      expenses: expenses * rate,
      balance: (income - expenses) * rate
    };
  }, [filteredTransactions, selectedCurrency, exchangeRates]);

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

  const handleEditGoal = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !editingGoal || !goalName || !goalTarget) return;

    try {
      const goalRef = doc(db, 'users', user.uid, 'goals', editingGoal.id);
      await updateDoc(goalRef, {
        name: goalName,
        targetAmount: parseFloat(goalTarget),
        deadline: goalDeadline || null
      });
      setEditingGoal(null);
      setGoalName('');
      setGoalTarget('');
      setGoalDeadline('');
      setNotifications(prev => [
        { id: crypto.randomUUID(), text: "Meta actualizada correctamente.", type: 'success', read: false },
        ...prev
      ]);
    } catch (error) {
      handleFirestoreError(error, 'update', `users/${user.uid}/goals/${editingGoal.id}`);
    }
  };

  const handleDeleteContribution = async (goalId: string, contributionId: string) => {
    if (!user) return;
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    try {
      const goalRef = doc(db, 'users', user.uid, 'goals', goalId);
      const updatedContributions = goal.contributions.filter(c => c.id !== contributionId);
      await updateDoc(goalRef, { contributions: updatedContributions });
      setNotifications(prev => [
        { id: crypto.randomUUID(), text: "Aporte eliminado.", type: 'info', read: false },
        ...prev
      ]);
    } catch (error) {
      handleFirestoreError(error, 'update', `users/${user.uid}/goals/${goalId}`);
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800 max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-4">
            <Logo className="w-20 h-20 mx-auto" />
            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Finanzas Pro</h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg">Toma el control total de tu dinero en cualquier dispositivo.</p>
          </div>

          {authMode === 'reset' ? (
            <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Correo Electrónico</label>
                <input 
                  type="email" 
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  placeholder="tu@correo.com"
                  required
                />
              </div>
              {authError && <p className="text-xs text-rose-500">{authError}</p>}
              <button 
                type="submit" 
                disabled={authLoading}
                className="w-full bg-slate-900 dark:bg-blue-600 text-white py-4 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50"
              >
                {authLoading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>
              <button 
                type="button"
                onClick={() => setAuthMode('login')}
                className="w-full text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Volver al inicio de sesión
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
                {authMode === 'register' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre Completo</label>
                    <input 
                      type="text" 
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      placeholder="Juan Pérez"
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Correo Electrónico</label>
                  <input 
                    type="email" 
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    placeholder="tu@correo.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Contraseña</label>
                    {authMode === 'login' && (
                      <button 
                        type="button"
                        onClick={() => setAuthMode('reset')}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      placeholder="••••••••"
                      required
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                {authError && <p className="text-xs text-rose-500">{authError}</p>}
                <button 
                  type="submit" 
                  disabled={authLoading}
                  className="w-full bg-slate-900 dark:bg-blue-600 text-white py-4 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {authLoading ? 'Procesando...' : authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
                </button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100 dark:border-slate-800"></span></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-slate-900 px-2 text-slate-400">O continúa con</span></div>
              </div>

              <button 
                onClick={handleLogin}
                className="w-full flex items-center justify-center gap-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 py-4 rounded-2xl font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-[0.98]"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                Google
              </button>

              <p className="text-sm text-slate-500">
                {authMode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
                <button 
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  className="ml-1 text-blue-600 font-bold hover:underline"
                >
                  {authMode === 'login' ? 'Regístrate' : 'Inicia Sesión'}
                </button>
              </p>
            </div>
          )}

          <p className="text-xs text-slate-400">
            Al continuar, aceptas que tus datos financieros se guarden de forma segura en la nube.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans p-4 md:p-8 transition-colors">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-4">
              <Logo />
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Finanzas Pro</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Hola, {user.displayName?.split(' ')[0] || 'Usuario'}</p>
              </div>
            </div>

            {/* Mobile Actions */}
            <div className="flex md:hidden gap-2">
              <button 
                onClick={handleExportData}
                className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-400"
                title="Exportar"
              >
                <FileDown size={20} />
              </button>
              <button 
                onClick={() => setShowMobileMenu(true)}
                className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-400"
              >
                <Menu size={24} />
              </button>
            </div>
          </div>
          
          <div className="hidden md:flex gap-3">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm flex items-center justify-center"
              title="Cambiar Tema"
            >
              {isDarkMode ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} className="text-slate-600" />}
            </button>

            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm relative flex items-center justify-center"
                title="Notificaciones"
              >
                <Bell size={20} className="text-slate-600 dark:text-slate-400" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900" />
                )}
              </button>
              
              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 dark:text-slate-200">Notificaciones</h3>
                      <button 
                        onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                        className="text-xs text-blue-600 font-medium hover:underline"
                      >
                        Marcar todas
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto p-2 space-y-1">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">Sin notificaciones</div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n.id} 
                            className={cn(
                              "p-3 rounded-xl text-sm transition-colors",
                              !n.read ? "bg-blue-50/50 dark:bg-blue-900/20" : "bg-white dark:bg-slate-900",
                              n.type === 'success' ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"
                            )}
                          >
                            {n.text}
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={handleExportData}
              className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm flex items-center justify-center"
              title="Exportar a Excel"
            >
              <FileDown size={20} className="text-slate-600 dark:text-slate-400" />
            </button>

            <label className="cursor-pointer p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm flex items-center justify-center" title="Importar Excel">
              <FileUp size={20} className="text-slate-600 dark:text-slate-400" />
              <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} disabled={isImporting} />
            </label>

            <button 
              onClick={() => setShowSettings(true)}
              className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm flex items-center justify-center"
              title="Configuración"
            >
              <Settings size={20} className="text-slate-600 dark:text-slate-400" />
            </button>

            <button 
              onClick={handleLogout}
              className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded-2xl hover:bg-rose-100 transition-all flex items-center justify-center"
              title="Cerrar Sesión"
            >
              <LogOut size={20} />
            </button>
          </div>

          {/* Desktop Quick Actions */}
          <div className="hidden md:flex gap-3">
            <button 
              onClick={() => { setType('expense'); setCategory(categories.expense[0]); setShowAddModal(true); }}
              className="flex items-center gap-2 bg-slate-900 dark:bg-blue-600 text-white px-6 py-3 rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-slate-900/10 active:scale-95 text-sm font-bold"
            >
              <PlusCircle size={18} />
              Nuevo Movimiento
            </button>
            <button 
              onClick={() => setShowGoalModal(true)}
              className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-6 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95 text-sm font-bold"
            >
              <Target size={18} />
              Nueva Meta
            </button>
          </div>

          {/* Mobile Quick Actions */}
          <div className="flex md:hidden gap-2">
            <button 
              onClick={() => { setType('expense'); setCategory(categories.expense[0]); setShowAddModal(true); }}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-900 dark:bg-blue-600 text-white px-4 py-3 rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-slate-900/10 active:scale-95 text-sm font-bold"
            >
              <PlusCircle size={18} />
              Movimiento
            </button>
            <button 
              onClick={() => setShowGoalModal(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95 text-sm font-bold"
            >
              <Target size={18} />
              Meta
            </button>
          </div>
        </header>

        {/* View Mode & Month Selector */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button 
              onClick={() => setViewMode('general')}
              className={cn(
                "px-6 py-2 text-sm font-bold rounded-lg transition-all",
                viewMode === 'general' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"
              )}
            >
              General
            </button>
            <button 
              onClick={() => setViewMode('monthly')}
              className={cn(
                "px-6 py-2 text-sm font-bold rounded-lg transition-all",
                viewMode === 'monthly' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"
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

          <div className="flex items-center gap-4">
            {trm && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100">
                <TrendingUp size={12} />
                TRM: {formatCurrency(trm, 'COP')}
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
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4"
          >
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Balance {viewMode === 'monthly' ? 'del Mes' : 'Total'}</p>
              <p className="text-2xl font-bold">{formatCurrency(totals.balance, selectedCurrency)}</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4"
          >
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Ingresos {viewMode === 'monthly' ? 'del Mes' : 'Totales'}</p>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.income, selectedCurrency)}</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4"
          >
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl">
              <TrendingDown size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Gastos {viewMode === 'monthly' ? 'del Mes' : 'Totales'}</p>
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
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-6">
                  <PieChartIcon size={18} className="text-slate-400" />
                  <h2 className="font-semibold">Resumen General</h2>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '12px', 
                          border: 'none', 
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                          color: isDarkMode ? '#f8fafc' : '#0f172a'
                        }}
                        cursor={{ fill: isDarkMode ? '#1e293b' : '#f8fafc' }}
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

              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
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
                          contentStyle={{ 
                            borderRadius: '12px', 
                            border: 'none', 
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                            color: isDarkMode ? '#f8fafc' : '#0f172a'
                          }}
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
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Target size={18} className="text-slate-400" />
                  <h2 className="font-semibold">Metas de Ahorro</h2>
                </div>
                <button 
                  onClick={() => setShowGoalModal(true)}
                  className="text-blue-600 dark:text-blue-400 hover:opacity-80 text-sm font-bold flex items-center gap-1"
                >
                  <Plus size={16} /> Añadir 
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {goals.length > 0 ? (
                  goals.map(goal => {
                    const goalTotal = (goal.contributions || []).reduce((sum, c) => sum + c.amount, 0);
                    const progress = Math.min((goalTotal / goal.targetAmount) * 100, 100);
                    return (
                      <div key={goal.id} className="space-y-3 p-5 rounded-3xl border border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        <div className="flex justify-between text-sm">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{goal.name}</span>
                            {goal.deadline && (
                              <p className="text-xs text-slate-400">Plazo: {new Date(goal.deadline).toLocaleDateString()}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 dark:text-slate-400 block font-mono text-xs">{formatCurrency(goalTotal * (exchangeRates[selectedCurrency] || 1), selectedCurrency)}</span>
                            <span className="text-slate-400 dark:text-slate-500 block text-[10px]">de {formatCurrency(goal.targetAmount * (exchangeRates[selectedCurrency] || 1), selectedCurrency)}</span>
                          </div>
                        </div>
                        <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className={cn(
                              "h-full rounded-full transition-all",
                              progress >= 100 ? "bg-emerald-500" : "bg-blue-500"
                            )}
                          />
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{progress.toFixed(0)}% completado</span>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                setEditingGoal(goal);
                                setGoalName(goal.name);
                                setGoalTarget(goal.targetAmount.toString());
                                setGoalDeadline(goal.deadline || '');
                              }}
                              className="p-1.5 text-slate-400 hover:text-blue-500 transition-all"
                              title="Editar Meta"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => setShowGoalDetails(showGoalDetails === goal.id ? null : goal.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 transition-all"
                            >
                              {showGoalDetails === goal.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <button 
                              onClick={() => setShowContributionModal(goal.id)}
                              className="text-[10px] font-bold bg-slate-900 dark:bg-slate-700 text-white px-3 py-1.5 rounded-lg hover:opacity-80 transition-all"
                            >
                              Aportar
                            </button>
                            <button 
                              onClick={() => deleteGoal(goal.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Goal Details / Contributions */}
                        <AnimatePresence>
                          {showGoalDetails === goal.id && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden pt-4 space-y-3 border-t border-slate-100 dark:border-slate-800 mt-4"
                            >
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Historial de Aportes</h4>
                              <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                {goal.contributions && goal.contributions.length > 0 ? (
                                  goal.contributions.map(c => (
                                    <div key={c.id} className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-50 dark:border-slate-800 text-xs">
                                      <div className="flex flex-col">
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(c.amount * (exchangeRates[selectedCurrency] || 1), selectedCurrency)}</span>
                                        <span className="text-[10px] text-slate-400">{new Date(c.date).toLocaleDateString()}</span>
                                      </div>
                                      <button 
                                        onClick={() => handleDeleteContribution(goal.id, c.id)}
                                        className="text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-all"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-[10px] text-slate-400 italic">No hay aportes aún.</p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-2 py-12 text-center text-slate-400">
                    No tienes metas activas. ¡Crea una para empezar a ahorrar!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: History */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col h-[800px]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <History size={18} className="text-slate-400" />
                <h2 className="font-semibold">Historial Reciente</h2>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              <AnimatePresence initial={false}>
                {transactions.length > 0 ? (
                  transactions.slice(0, 15).map(t => (
                    <motion.div 
                      key={t.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="group flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={cn(
                          "p-2.5 rounded-xl flex-shrink-0",
                          t.type === 'income' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                        )}>
                          {t.type === 'income' ? <ArrowUpRight size={18} /> : <TrendingDown size={18} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate" title={t.description}>{t.description}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{t.category}</span>
                            <span className="text-[10px] text-slate-300 flex-shrink-0">•</span>
                            <span className="text-[10px] text-slate-400 flex-shrink-0">{new Date(t.date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                        <span className={cn(
                          "font-bold text-sm font-mono whitespace-nowrap",
                          t.type === 'income' ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        )}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount * (exchangeRates[selectedCurrency] || 1), selectedCurrency)}
                        </span>
                        <button 
                          onClick={() => setTransactionToDelete(t.id)}
                          className="text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-all p-1 flex-shrink-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center">
                      <History size={32} />
                    </div>
                    <p className="text-sm">No hay movimientos registrados</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 py-12 bg-slate-900 dark:bg-black text-white rounded-t-[3rem] -mx-4 md:-mx-8 px-4 md:px-8">
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
                className="p-3 bg-slate-800 dark:bg-slate-900 rounded-2xl hover:bg-blue-600 transition-all hover:scale-110 active:scale-95"
                title="Correo"
              >
                <Mail size={20} />
              </a>
              <a 
                href="https://www.linkedin.com/in/wilson-rojas-palacios-5a831431b/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-3 bg-slate-800 dark:bg-slate-900 rounded-2xl hover:bg-[#0077b5] transition-all hover:scale-110 active:scale-95"
                title="LinkedIn"
              >
                <Linkedin size={20} />
              </a>
              <a 
                href="https://github.com/Wilwonka06" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-3 bg-slate-800 dark:bg-slate-900 rounded-2xl hover:bg-[#333] transition-all hover:scale-110 active:scale-95"
                title="GitHub"
              >
                <Github size={20} />
              </a>
              <a 
                href="https://www.instagram.com/rp__wilson?igsh=MTg3NTM1eXZ3OHVhMg==" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-3 bg-slate-800 dark:bg-slate-900 rounded-2xl hover:bg-[#e4405f] transition-all hover:scale-110 active:scale-95"
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
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold dark:text-white">Nuevo Movimiento</h2>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="space-y-4">
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button 
                    type="button"
                    onClick={() => { setType('expense'); setCategory(categories.expense[0]); }}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                      type === 'expense' ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm" : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    Gasto
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setType('income'); setCategory(categories.income[0]); }}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                      type === 'income' ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    Ingreso
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha</label>
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Monto (en COP)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">COP</span>
                      <input 
                        type="number" 
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                        required
                      />
                    </div>
                    {amount && !isNaN(parseFloat(amount)) && selectedCurrency !== 'COP' && (
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 px-1">
                        Equivale a: <span className="text-blue-500 dark:text-blue-400">{formatCurrency(parseFloat(amount) * (exchangeRates[selectedCurrency] || 1), selectedCurrency)}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descripción</label>
                  <input 
                    type="text" 
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="Ej. Compra semanal"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Categoría</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                    required
                  >
                    {categories[type].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-slate-900 dark:bg-blue-600 text-white py-4 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg active:scale-[0.98]"
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
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold dark:text-white">Nueva Meta de Ahorro</h2>
                <button onClick={() => setShowGoalModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddGoal} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre de la meta</label>
                  <input 
                    type="text" 
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    placeholder="Ej. Fondo de emergencia"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Monto Objetivo (en COP)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">COP</span>
                      <input 
                        type="number" 
                        step="0.01"
                        value={goalTarget}
                        onChange={(e) => setGoalTarget(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                        required
                      />
                    </div>
                    {goalTarget && !isNaN(parseFloat(goalTarget)) && selectedCurrency !== 'COP' && (
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 px-1">
                        Equivale a: <span className="text-blue-500 dark:text-blue-400">{formatCurrency(parseFloat(goalTarget) * (exchangeRates[selectedCurrency] || 1), selectedCurrency)}</span>
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha Límite (Opcional)</label>
                    <input 
                      type="date" 
                      value={goalDeadline}
                      onChange={(e) => setGoalDeadline(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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

      {/* Edit Goal Modal */}
      <AnimatePresence>
        {editingGoal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingGoal(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold dark:text-white">Editar Meta</h2>
                <button onClick={() => setEditingGoal(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleEditGoal} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre de la meta</label>
                  <input 
                    type="text" 
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Monto Objetivo (en COP)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">COP</span>
                      <input 
                        type="number" 
                        step="0.01"
                        value={goalTarget}
                        onChange={(e) => setGoalTarget(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                        required
                      />
                    </div>
                    {goalTarget && !isNaN(parseFloat(goalTarget)) && selectedCurrency !== 'COP' && (
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 px-1">
                        Equivale a: <span className="text-blue-500 dark:text-blue-400">{formatCurrency(parseFloat(goalTarget) * (exchangeRates[selectedCurrency] || 1), selectedCurrency)}</span>
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha Límite</label>
                    <input 
                      type="date" 
                      value={goalDeadline}
                      onChange={(e) => setGoalDeadline(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/10 active:scale-[0.98]"
                >
                  Guardar Cambios
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
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold dark:text-white">Aportar a: {goals.find(g => g.id === showContributionModal)?.name}</h2>
                <button onClick={() => setShowContributionModal(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddContribution} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Monto a destinar (en COP)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">COP</span>
                    <input 
                      type="number" 
                      step="0.01"
                      value={contributionAmount}
                      onChange={(e) => setContributionAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                      required
                    />
                  </div>
                  {contributionAmount && !isNaN(parseFloat(contributionAmount)) && selectedCurrency !== 'COP' && (
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 px-1">
                      Equivale a: <span className="text-blue-500 dark:text-blue-400">{formatCurrency(parseFloat(contributionAmount) * (exchangeRates[selectedCurrency] || 1), selectedCurrency)}</span>
                    </p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400">Balance disponible: {formatCurrency(totals.balance, selectedCurrency)}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha del aporte</label>
                  <input 
                    type="date" 
                    value={contributionDate}
                    onChange={(e) => setContributionDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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
              className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl p-6 space-y-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold dark:text-white">Configuración</h2>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={20} />
                </button>
              </div>

              {/* Currency Selection */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold">
                  <Coins size={18} />
                  <h3>Moneda Principal</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select 
                    value={selectedCurrency}
                    onChange={(e) => updateCurrency(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  >
                    {currencies.map(c => (
                      <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-700 dark:text-blue-300 text-sm">
                    Los tipos de cambio se obtienen de la API de Frankfurter.
                  </div>
                </div>
              </section>

              {/* Category Management */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold">
                  <Settings size={18} />
                  <h3>Gestionar Categorías</h3>
                </div>
                
                <form onSubmit={handleAddCategory} className="flex gap-2">
                  <select 
                    value={newCatType}
                    onChange={(e) => setNewCatType(e.target.value as TransactionType)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                  >
                    <option value="expense">Gasto</option>
                    <option value="income">Ingreso</option>
                  </select>
                  <input 
                    type="text" 
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Nueva categoría..."
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                  />
                  <button type="submit" className="bg-slate-900 dark:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold">
                    Añadir
                  </button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gastos</h4>
                    <div className="flex flex-wrap gap-2">
                      {categories.expense.map(cat => (
                        <div key={cat} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg text-sm group dark:text-slate-300">
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
                        <div key={cat} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg text-sm group dark:text-slate-300">
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

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {showMobileMenu && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileMenu(false)}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed top-0 left-0 h-full w-full max-w-[300px] bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
                <div className="flex items-center gap-3">
                  <Logo className="w-10 h-10" />
                  <h2 className="font-bold dark:text-white">Menú Principal</h2>
                </div>
                <button onClick={() => setShowMobileMenu(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors dark:text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {/* User Profile Section */}
                <div className="p-4 mb-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-bold text-xl">
                      {user.displayName?.[0] || user.email?.[0].toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{user.displayName || 'Usuario'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => { setIsDarkMode(!isDarkMode); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-700 dark:text-slate-200 group"
                >
                  <div className={cn(
                    "p-2 rounded-xl transition-colors", 
                    isDarkMode ? "bg-amber-500/10 text-amber-500" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                  )}>
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                  </div>
                  <span className="font-medium">Modo {isDarkMode ? 'Claro' : 'Oscuro'}</span>
                </button>

                <button 
                  onClick={() => { setShowNotifications(true); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-700 dark:text-slate-200 group"
                >
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                    <Bell size={20} />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-medium">Notificaciones</span>
                    {notifications.some(n => !n.read) && (
                      <span className="ml-2 inline-block w-2 h-2 bg-rose-500 rounded-full" />
                    )}
                  </div>
                </button>

                <button 
                  onClick={() => { handleExportData(); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-700 dark:text-slate-200 group"
                >
                  <div className="p-2 bg-slate-500/10 text-slate-500 rounded-xl group-hover:bg-slate-500/20 transition-colors">
                    <FileDown size={20} />
                  </div>
                  <span className="font-medium">Exportar a Excel</span>
                </button>

                <label className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-700 dark:text-slate-200 cursor-pointer group">
                  <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                    <FileUp size={20} />
                  </div>
                  <span className="font-medium">Importar Datos</span>
                  <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} disabled={isImporting} />
                </label>

                <button 
                  onClick={() => { setShowSettings(true); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-700 dark:text-slate-200 group"
                >
                  <div className="p-2 bg-slate-500/10 text-slate-500 rounded-xl group-hover:bg-slate-500/20 transition-colors">
                    <Settings size={20} />
                  </div>
                  <span className="font-medium">Configuración</span>
                </button>

                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                  <button 
                    onClick={() => { handleLogout(); setShowMobileMenu(false); }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all text-rose-600 group"
                  >
                    <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl group-hover:bg-rose-500/20 transition-colors">
                      <LogOut size={20} />
                    </div>
                    <span className="font-medium">Cerrar Sesión</span>
                  </button>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest text-center font-bold">Finanzas Pro v1.0</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {transactionToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTransactionToDelete(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center space-y-6"
            >
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold dark:text-white">¿Confirmar eliminación?</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Esta acción no se puede deshacer. El movimiento será borrado permanentemente.</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setTransactionToDelete(null)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => { deleteTransaction(transactionToDelete); setTransactionToDelete(null); }}
                  className="flex-1 bg-rose-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/10"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Chat Button */}
      <button 
        onClick={() => setShowChat(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all active:scale-95 z-40 group"
      >
        <Sparkles size={24} className="group-hover:animate-pulse" />
      </button>

      {/* AI Chat Drawer */}
      <AnimatePresence>
        {showChat && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowChat(false)}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-900 dark:bg-black text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h2 className="font-bold">Asistente Financiero</h2>
                    <p className="text-xs text-slate-400">Impulsado por Gemini AI</p>
                  </div>
                </div>
                <button onClick={() => setShowChat(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50 dark:bg-slate-900/50 custom-scrollbar">
                {chatMessages.length === 0 && (
                  <div className="text-center space-y-4 mt-12">
                    <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex items-center justify-center mx-auto text-slate-400">
                      <MessageSquare size={32} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-bold text-slate-800 dark:text-slate-200">¿En qué puedo ayudarte hoy?</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 px-8">
                        Puedo analizar tus gastos, darte consejos de ahorro o ayudarte a planear tus metas.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 px-4">
                      {['¿Cómo van mis gastos este mes?', '¿Cuánto me falta para mi meta?', 'Dame consejos para ahorrar'].map(q => (
                        <button 
                          key={q}
                          onClick={() => { setChatInput(q); }}
                          className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-full hover:border-slate-900 dark:hover:border-slate-400 transition-colors dark:text-slate-200"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={cn(
                    "flex",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}>
                    <div className={cn(
                      "max-w-[85%] p-4 rounded-2xl text-sm shadow-sm",
                      msg.role === 'user' 
                        ? "bg-slate-900 dark:bg-blue-600 text-white rounded-tr-none" 
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-700"
                    )}>
                      {msg.role === 'user' ? (
                        msg.text
                      ) : (
                        <div className="markdown-body prose dark:prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-700 shadow-sm">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <input 
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Escribe tu pregunta..."
                    className="w-full pl-4 pr-12 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-slate-900/5 transition-all text-sm dark:text-white"
                  />
                  <button 
                    type="submit"
                    disabled={!chatInput.trim() || isTyping}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </form>
            </motion.div>
          </>
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
