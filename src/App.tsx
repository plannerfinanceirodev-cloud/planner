import React, { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase/client';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Heart,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Target,
  Plus,
  Trash2,
  Edit2,
  Save,
  Tag,
  X,
  AlertTriangle,
  Bell,
  CheckCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

// --- INTERFACES ---
interface Transaction {
  id: number;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: 'despesa' | 'receita';
  tipoMovimentacaoId: number;
  categoriaFinanceiraId: number;
}

interface BudgetItem {
  id: string;
  description: string;
  category: string;
  estimatedAmount: number;
  type:
    | 'despesa-fixa'
    | 'despesa-variável'
    | 'receita-fixa'
    | 'receita-variável';
  dueDate?: string;
  isPaid?: boolean;
  installments?: {
    total: number;
    current: number;
    parentId?: string;
  };
}

interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  priority: 'baixa' | 'média' | 'alta';
}

interface CustomCategory {
  id: string;
  name: string;
  type: 'despesa' | 'receita';
}

interface TipoMovimentacaoOption {
  id: number;
  descricao: string;
  tipo: 'despesa' | 'receita';
}

interface CategoriaFinanceiraOption {
  id: number;
  descricao: string | null;
  tipo: 'despesa' | 'receita';
}

// --- COMPONENTE PRINCIPAL ---
const CoupleFinancialPlanner: React.FC = () => {
  // --- ESTADOS GERAIS ---
  const [plannerName, setPlannerName] = useState<string>(
    'Nosso Planner Financeiro'
  );
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'transactions' | 'budget' | 'goals' | 'alerts'
  >('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}`;
  });

  // --- ESTADOS DE AUTENTICAÇÃO ---
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordVisible, setAuthPasswordVisible] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // --- ESTADOS DE DADOS (COM LOCALSTORAGE) ---
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(
    () => {
      const saved = localStorage.getItem('customCategories');
      return saved ? JSON.parse(saved) : [];
    }
  );

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(() => {
    const saved = localStorage.getItem('budgetItems');
    return saved ? JSON.parse(saved) : [];
  });

  const [goals, setGoals] = useState<Goal[]>(() => {
    const saved = localStorage.getItem('goals');
    return saved ? JSON.parse(saved) : [];
  });

  // --- ESTADOS DE FORMULÁRIOS ---
  // Transações
  const [newTransaction, setNewTransaction] = useState({
    date: '',
    description: '',
    amount: '',
    tipoMovimentacaoId: '',
    categoriaFinanceiraId: '',
  });

  // Orçamento
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [newBudgetItem, setNewBudgetItem] = useState({
    description: '',
    category: '',
    estimatedAmount: '',
    type: 'despesa-fixa' as const,
    dueDate: '',
    installments: '',
  });

  // Nova Categoria
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'despesa' | 'receita'>(
    'despesa'
  );

  // Metas
  const [newGoal, setNewGoal] = useState({
    name: '',
    target: '',
    current: '',
    deadline: '',
    priority: 'média' as const,
  });
  const [updateAmounts, setUpdateAmounts] = useState<Record<string, string>>(
    {}
  );

  // Categorias Padrão
  const predefinedCategories: Record<string, string[]> = {
    despesa: [
      'Moradia',
      'Alimentação',
      'Transporte',
      'Saúde',
      'Educação',
      'Lazer',
      'Vestuário',
      'Contas Fixas',
      'Outros',
    ],
    receita: ['Salário', 'Freelance', 'Investimentos', 'Presentes', 'Outros'],
  };

  // --- EFEITOS (SALVAR) ---
  useEffect(() => {
    localStorage.setItem('budgetItems', JSON.stringify(budgetItems));
    localStorage.setItem('goals', JSON.stringify(goals));
    localStorage.setItem('customCategories', JSON.stringify(customCategories));
  }, [budgetItems, goals, customCategories]);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (isMounted) {
        if (error) {
          setAuthError('Não foi possível verificar a sessão.');
        }
        setSession(data.session);
        setAuthLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession);
        setAuthLoading(false);
      }
    });

    loadSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const [tipoMovimentacoes, setTipoMovimentacoes] = useState<
    TipoMovimentacaoOption[]
  >([]);
  const [categoriasFinanceiras, setCategoriasFinanceiras] = useState<
    CategoriaFinanceiraOption[]
  >([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(
    null
  );

  useEffect(() => {
    const loadTransactionData = async () => {
      if (!session?.user) {
        return;
      }

      setTransactionsLoading(true);
      setTransactionsError(null);

      const [tiposResult, categoriasResult, lancamentosResult] =
        await Promise.all([
          supabase
            .from('tipo_movimentacao')
            .select('id, descricao, tipo')
            .order('descricao', { ascending: true }),
          supabase
            .from('categoria_financeira')
            .select('id, descricao, tipo')
            .order('descricao', { ascending: true }),
          supabase
            .from('lancamentos')
            .select(
              `id,
              data_lancamento,
              descricao,
              valor,
              categoria_financeira:categoria_financeira_id ( id, descricao, tipo ),
              tipo_movimentacao:tipo_movimentacao_id ( id, descricao, tipo )`
            )
            .order('data_lancamento', { ascending: true }),
        ]);

      if (tiposResult.error) {
        setTransactionsError(
          'Não foi possível carregar os tipos de movimentação.'
        );
      } else {
        setTipoMovimentacoes(tiposResult.data ?? []);
      }

      if (categoriasResult.error) {
        setTransactionsError(
          'Não foi possível carregar as categorias financeiras.'
        );
      } else {
        setCategoriasFinanceiras(categoriasResult.data ?? []);
      }

      if (lancamentosResult.error) {
        setTransactionsError('Não foi possível carregar os lançamentos.');
      } else {
        const mapped = (lancamentosResult.data ?? []).map((item) => {
          const categoria = item.categoria_financeira as {
            id: number;
            descricao: string | null;
            tipo: 'despesa' | 'receita';
          } | null;
          const tipoMovimentacao = item.tipo_movimentacao as {
            id: number;
            descricao: string;
            tipo: 'despesa' | 'receita';
          } | null;

          return {
            id: item.id,
            date: item.data_lancamento,
            description: item.descricao ?? '',
            category: categoria?.descricao ?? 'Sem categoria',
            amount: item.valor,
            type: tipoMovimentacao?.tipo ?? 'despesa',
            tipoMovimentacaoId: tipoMovimentacao?.id ?? 0,
            categoriaFinanceiraId: categoria?.id ?? 0,
          };
        });

        setTransactions(mapped);
      }

      setTransactionsLoading(false);
    };

    loadTransactionData();
  }, [session?.user]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthSubmitting(true);
    setAuthError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    });

    if (error) {
      setAuthError('E-mail ou senha inválidos. Verifique e tente novamente.');
    }

    setAuthSubmitting(false);
  };

  // --- FUNÇÕES AUXILIARES ---
  const formatCurrency = (value: number | string): string => {
    return parseFloat(String(value) || '0').toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const parseCurrency = (value: string): number => {
    if (!value) return 0;
    return parseFloat(value.replace(/\./g, '').replace(',', '.'));
  };

  const formatInputCurrency = (value: string): string => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');

    if (!numbers) return '';

    // Converte para número e formata
    const numberValue = parseInt(numbers) / 100;

    return numberValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleCurrencyInput = (
    value: string,
    setter: (val: string) => void
  ) => {
    const formatted = formatInputCurrency(value);
    setter(formatted);
  };

  // --- FUNÇÕES DE NAVEGAÇÃO DE MÊS ---
  const getMonthYear = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      '0'
    )}`;
  };

  const changeMonth = (direction: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + direction, 1);
    setSelectedMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    );
  };

  const getMonthName = (monthString: string) => {
    const [year, month] = monthString.split('-').map(Number);
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const isCurrentMonth = () => {
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}`;
    return selectedMonth === current;
  };

  const getAllCategories = (fullType: string): string[] => {
    const baseType = fullType.split('-')[0];
    const predefined = predefinedCategories[baseType] || [];
    const custom = customCategories
      .filter((c) => c.type === baseType)
      .map((c) => c.name);
    return [...predefined, ...custom];
  };

  // --- CÁLCULOS GERAIS ---
  // Filtrar transações do mês selecionado
  const filteredTransactions = transactions.filter((t) => {
    if (!t.date) return false;
    return getMonthYear(t.date) === selectedMonth;
  });

  // Filtrar orçamento do mês selecionado (apenas parcelas do mês atual)
  const filteredBudgetItems = budgetItems.filter((b) => {
    if (!b.dueDate) return false;
    return getMonthYear(b.dueDate) === selectedMonth;
  });

  // Calcular totais incluindo lançamentos E orçamento não pago
  const totalReceitasLancadas = filteredTransactions
    .filter((t) => t.type.startsWith('receita'))
    .reduce((sum, t) => sum + t.amount, 0);
  const totalDespesasLancadas = filteredTransactions
    .filter((t) => t.type.startsWith('despesa'))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalReceitasOrcamento = filteredBudgetItems
    .filter((b) => b.type.startsWith('receita') && !b.isPaid)
    .reduce((sum, b) => sum + b.estimatedAmount, 0);
  const totalDespesasOrcamento = filteredBudgetItems
    .filter((b) => b.type.startsWith('despesa') && !b.isPaid)
    .reduce((sum, b) => sum + b.estimatedAmount, 0);

  const totalReceitas = totalReceitasLancadas + totalReceitasOrcamento;
  const totalDespesas = totalDespesasLancadas + totalDespesasOrcamento;
  const saldo = totalReceitas - totalDespesas;

  // Gamificação - Percentual de despesas em relação às receitas
  const percentualGasto =
    totalReceitas > 0 ? (totalDespesas / totalReceitas) * 100 : 0;

  const getGamificationMessage = () => {
    if (totalReceitas === 0) {
      return {
        message: '',
        color: '',
        bgColor: '',
        show: false,
      };
    }

    if (percentualGasto <= 80) {
      return {
        message: 'Você está indo muito bem! 🎉',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        show: true,
      };
    } else if (percentualGasto <= 90) {
      return {
        message: 'Atenção! ⚠️',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        show: true,
      };
    } else if (percentualGasto <= 99) {
      return {
        message: 'Tome Cuidado! 😰',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        show: true,
      };
    } else {
      return {
        message: 'Pare de gastar agora! 🚨',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        show: true,
      };
    }
  };

  const gamification = getGamificationMessage();

  // Dados Pizza (Despesas) - incluir tanto lançamentos quanto orçamento não pago
  const expensesByCategory: Record<string, number> = {};

  // Adicionar despesas dos lançamentos
  filteredTransactions
    .filter((t) => t.type.startsWith('despesa'))
    .forEach((t) => {
      expensesByCategory[t.category] =
        (expensesByCategory[t.category] || 0) + t.amount;
    });

  // Adicionar despesas do orçamento (apenas as que não foram pagas)
  filteredBudgetItems
    .filter((b) => b.type.startsWith('despesa') && !b.isPaid)
    .forEach((b) => {
      expensesByCategory[b.category] =
        (expensesByCategory[b.category] || 0) + b.estimatedAmount;
    });

  const pieData = Object.entries(expensesByCategory).map(([name, value]) => ({
    name,
    value,
  }));
  const PIE_COLORS = [
    '#FF6B9D',
    '#C44569',
    '#F97F51',
    '#FEA47F',
    '#786FA6',
    '#778BEB',
    '#63CDDA',
  ];

  // Dados Barras (Metas) - com cores dinâmicas e normalizado em percentual
  const goalsColors = [
    { main: '#10b981', light: '#10b98180' }, // Verde - 50% opacidade
    { main: '#3b82f6', light: '#3b82f680' }, // Azul - 50% opacidade
    { main: '#8b5cf6', light: '#8b5cf680' }, // Roxo - 50% opacidade
    { main: '#ec4899', light: '#ec489980' }, // Rosa - 50% opacidade
    { main: '#f59e0b', light: '#f59e0b80' }, // Laranja - 50% opacidade
    { main: '#06b6d4', light: '#06b6d480' }, // Ciano - 50% opacidade
    { main: '#14b8a6', light: '#14b8a680' }, // Teal - 50% opacidade
  ];

  const goalsChartData = goals.map((g, index) => {
    const percentGuardado = (g.current / g.target) * 100;
    const percentFalta = ((g.target - g.current) / g.target) * 100;

    return {
      name: g.name,
      GuardadoPercent: percentGuardado > 0 ? percentGuardado : 0,
      FaltaPercent: percentFalta > 0 ? percentFalta : 0,
      GuardadoValor: g.current,
      FaltaValor: g.target - g.current > 0 ? g.target - g.current : 0,
      Alvo: g.target,
      colorMain: goalsColors[index % goalsColors.length].main,
      colorLight: goalsColors[index % goalsColors.length].light,
    };
  });

  // Cálculos Orçamento (igual ao resumo do mês: lançamentos + orçamento não pago)
  const budgetRevenue =
    totalReceitasLancadas +
    filteredBudgetItems
      .filter((i) => i.type.startsWith('receita') && !i.isPaid)
      .reduce((acc, i) => acc + i.estimatedAmount, 0);
  const budgetExpense =
    totalDespesasLancadas +
    filteredBudgetItems
      .filter((i) => i.type.startsWith('despesa') && !i.isPaid)
      .reduce((acc, i) => acc + i.estimatedAmount, 0);
  const budgetBalance = budgetRevenue - budgetExpense;

  // --- ACTIONS ---
  const addCustomCategory = () => {
    if (newCategoryName.trim()) {
      setCustomCategories([
        ...customCategories,
        {
          id: Date.now().toString(),
          name: newCategoryName,
          type: newCategoryType,
        },
      ]);
      setNewCategoryName('');
      setShowCategoryForm(false);
    }
  };

  const addTransaction = async () => {
    if (!session?.user) {
      setTransactionsError('Sua sessão expirou. Faça login novamente.');
      return;
    }

    if (
      !newTransaction.description ||
      !newTransaction.amount ||
      !newTransaction.tipoMovimentacaoId ||
      !newTransaction.categoriaFinanceiraId
    ) {
      setTransactionsError('Preencha todos os campos do lançamento.');
      return;
    }

    setTransactionsError(null);

    const transactionDate = newTransaction.date || `${selectedMonth}-01`;
    const tipoMovimentacaoId = Number(newTransaction.tipoMovimentacaoId);
    const categoriaFinanceiraId = Number(newTransaction.categoriaFinanceiraId);

    const { data, error } = await supabase
      .from('lancamentos')
      .insert({
        data_lancamento: transactionDate,
        descricao: newTransaction.description,
        valor: parseCurrency(newTransaction.amount),
        tipo_movimentacao_id: tipoMovimentacaoId,
        categoria_financeira_id: categoriaFinanceiraId,
        user_id: session.user.id,
      })
      .select(
        `id,
        data_lancamento,
        descricao,
        valor,
        categoria_financeira:categoria_financeira_id ( id, descricao, tipo ),
        tipo_movimentacao:tipo_movimentacao_id ( id, descricao, tipo )`
      )
      .single();

    if (error || !data) {
      setTransactionsError('Não foi possível salvar o lançamento.');
      return;
    }

    const categoria = data.categoria_financeira as {
      id: number;
      descricao: string | null;
      tipo: 'despesa' | 'receita';
    } | null;
    const tipoMovimentacao = data.tipo_movimentacao as {
      id: number;
      descricao: string;
      tipo: 'despesa' | 'receita';
    } | null;

    setTransactions([
      ...transactions,
      {
        id: data.id,
        date: data.data_lancamento,
        description: data.descricao ?? '',
        category: categoria?.descricao ?? 'Sem categoria',
        amount: data.valor,
        type: tipoMovimentacao?.tipo ?? 'despesa',
        tipoMovimentacaoId: tipoMovimentacao?.id ?? 0,
        categoriaFinanceiraId: categoria?.id ?? 0,
      },
    ]);

    setNewTransaction({
      date: '',
      description: '',
      amount: '',
      tipoMovimentacaoId: '',
      categoriaFinanceiraId: '',
    });
  };

  const deleteTransaction = async (id: number) => {
    setTransactionsError(null);
    const { error } = await supabase.from('lancamentos').delete().eq('id', id);

    if (error) {
      setTransactionsError('Não foi possível excluir o lançamento.');
      return;
    }

    setTransactions(transactions.filter((t) => t.id !== id));
  };

  const getTipoMovimentacaoBase = (id: string) => {
    const match = tipoMovimentacoes.find((item) => item.id === Number(id));
    return match?.tipo;
  };

  const getCategoriasFinanceiras = (tipo?: 'despesa' | 'receita') => {
    if (!tipo) {
      return categoriasFinanceiras;
    }

    return categoriasFinanceiras.filter((cat) => cat.tipo === tipo);
  };

  const saveBudgetItem = () => {
    if (newBudgetItem.description && newBudgetItem.estimatedAmount) {
      const amount =
        typeof newBudgetItem.estimatedAmount === 'string'
          ? parseCurrency(newBudgetItem.estimatedAmount)
          : newBudgetItem.estimatedAmount;
      const installmentsCount =
        newBudgetItem.installments && newBudgetItem.installments.trim() !== ''
          ? parseInt(newBudgetItem.installments)
          : 0;

      // Se não tem data de vencimento, usar o último dia do mês selecionado
      let defaultDueDate = newBudgetItem.dueDate;
      if (!defaultDueDate) {
        const [year, month] = selectedMonth.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        defaultDueDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
      }

      if (editingBudgetId) {
        setBudgetItems(
          budgetItems.map((item) =>
            item.id === editingBudgetId
              ? { ...item, ...newBudgetItem, estimatedAmount: amount }
              : item
          )
        );
        setEditingBudgetId(null);
      } else {
        // Se tem parcelamento válido (maior que 1) e tem data de vencimento, criar múltiplas entradas
        if (installmentsCount > 1) {
          const newItems: BudgetItem[] = [];
          const parentId = Date.now().toString();
          const installmentAmount = amount / installmentsCount;

          for (let i = 0; i < installmentsCount; i++) {
            const dueDate = new Date(defaultDueDate);
            dueDate.setMonth(dueDate.getMonth() + i);

            newItems.push({
              id: `${parentId}-${i}`,
              description: newBudgetItem.description,
              category: newBudgetItem.category,
              estimatedAmount: installmentAmount,
              type: newBudgetItem.type,
              dueDate: dueDate.toISOString().split('T')[0],
              installments: {
                total: installmentsCount,
                current: i + 1,
                parentId: parentId,
              },
            });
          }

          setBudgetItems([...budgetItems, ...newItems]);
        } else {
          // Sem parcelamento ou parcela única, adicionar normalmente
          const newItem: BudgetItem = {
            id: Date.now().toString(),
            description: newBudgetItem.description,
            category: newBudgetItem.category,
            estimatedAmount: amount,
            type: newBudgetItem.type,
            dueDate: defaultDueDate,
          };
          setBudgetItems([...budgetItems, newItem]);
        }
      }
      setNewBudgetItem({
        description: '',
        category: '',
        estimatedAmount: '',
        type: 'despesa-fixa',
        dueDate: '',
        installments: '',
      });
    }
  };
  const startEditingBudget = (item: BudgetItem) => {
    setNewBudgetItem({
      description: item.description,
      category: item.category,
      estimatedAmount: item.estimatedAmount.toString(),
      type: item.type,
      dueDate: item.dueDate || '',
    });
    setEditingBudgetId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const deleteBudgetItem = (id: string) =>
    setBudgetItems(budgetItems.filter((i) => i.id !== id));

  const toggleBudgetItemPaid = (id: string) => {
    setBudgetItems(
      budgetItems.map((item) =>
        item.id === id ? { ...item, isPaid: !item.isPaid } : item
      )
    );
  };

  const addGoal = () => {
    if (newGoal.name && newGoal.target) {
      setGoals([
        ...goals,
        {
          id: Date.now().toString(),
          ...newGoal,
          target: parseCurrency(newGoal.target),
          current: parseCurrency(newGoal.current || '0'),
        },
      ]);
      setNewGoal({
        name: '',
        target: '',
        current: '',
        deadline: '',
        priority: 'média',
      });
    }
  };

  const updateGoalProgress = (id: string, additionalAmount: number) => {
    setGoals(
      goals.map((g) =>
        g.id === id ? { ...g, current: g.current + additionalAmount } : g
      )
    );
  };

  const deleteGoal = (id: string) => {
    setGoals(goals.filter((g) => g.id !== id));
  };

  // --- FUNÇÕES DE ALERTAS ---
  const getAlertStatus = (date: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(date);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue'; // Vencida
    if (diffDays <= 7) return 'warning'; // Vence em até 7 dias
    return 'ok'; // Mais de 7 dias
  };

  // Pegar todas as despesas com data (tanto de lançamentos quanto de orçamento)
  const getAllBills = () => {
    const bills: Array<{
      id: string;
      description: string;
      amount: number;
      date: string;
      category: string;
      source: 'transaction' | 'budget';
      isPaid?: boolean;
    }> = [];

    // Adicionar despesas de transações (já pagas)
    transactions
      .filter((t) => t.type.startsWith('despesa') && t.date)
      .forEach((t) => {
        bills.push({
          id: t.id,
          description: t.description,
          amount: t.amount,
          date: t.date,
          category: t.category,
          source: 'transaction',
          isPaid: true,
        });
      });

    // Adicionar despesas de orçamento APENAS se forem vencidas ou vencerem nos próximos 7 dias
    budgetItems
      .filter((b) => b.type.startsWith('despesa'))
      .forEach((b) => {
        // Usar a data de vencimento se disponível, caso contrário usar o último dia do mês
        let dueDate: string;
        if (b.dueDate) {
          dueDate = b.dueDate;
        } else {
          const [year, month] = selectedMonth.split('-').map(Number);
          const lastDay = new Date(year, month, 0).getDate();
          dueDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
        }

        // Verificar se a conta está vencida ou vence nos próximos 7 dias
        const status = getAlertStatus(dueDate);
        if (status === 'overdue' || status === 'warning') {
          // Verificar se já foi marcado como pago no orçamento OU se existe transação com mesma descrição/valor
          const alreadyPaid =
            b.isPaid ||
            transactions.some(
              (t) =>
                t.type.startsWith('despesa') &&
                t.description.toLowerCase() === b.description.toLowerCase() &&
                t.amount === b.estimatedAmount &&
                getMonthYear(t.date) === selectedMonth
            );

          bills.push({
            id: b.id,
            description: b.description,
            amount: b.estimatedAmount,
            date: dueDate,
            category: b.category,
            source: 'budget',
            isPaid: alreadyPaid,
          });
        }
      });

    return bills;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-6">
          <p className="text-gray-500 font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4 text-gray-800">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-rose-100 rounded-xl">
              <Heart className="text-rose-500" size={28} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Bem-vindo de volta</h1>
              <p className="text-sm text-gray-500">
                Entre para acessar seu planner
              </p>
            </div>
          </div>

          {authError && (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="text-xs text-gray-600 font-bold ml-1 block mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50"
                placeholder="voce@email.com"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 font-bold ml-1 block mb-1">
                Senha
              </label>
              <div className="relative">
                <input
                  type={authPasswordVisible ? 'text' : 'password'}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full p-3 pr-12 border border-gray-200 rounded-xl bg-gray-50"
                  placeholder="Sua senha"
                  required
                />
                <button
                  type="button"
                  onClick={() => setAuthPasswordVisible((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={
                    authPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'
                  }
                >
                  {authPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-3 rounded-xl font-semibold text-white shadow-md transition-all bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-95 disabled:opacity-70"
            >
              {authSubmitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-4 font-sans text-gray-800">
      <div className="max-w-7xl mx-auto">
        {/* --- HEADER --- */}
        <header className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-row items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 rounded-xl">
                <Heart
                  className="text-rose-500"
                  size={32}
                  fill="currentColor"
                />
              </div>
              <div>
                {isEditingName ? (
                  <input
                    type="text"
                    value={plannerName}
                    onChange={(e) => setPlannerName(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    className="text-2xl font-bold border-b-2 border-rose-500 focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <h1
                    onClick={() => setIsEditingName(true)}
                    className="text-2xl font-bold cursor-pointer hover:text-rose-500"
                  >
                    {plannerName}
                  </h1>
                )}
                <p className="text-gray-500 text-sm">
                  Construindo Riqueza Juntos
                </p>
              </div>
            </div>
            <div className="text-right bg-gray-50 px-6 py-2 rounded-xl border border-gray-100 shrink-0">
              <p className="text-sm text-gray-500">Saldo Realizado</p>
              <p
                className={`text-2xl font-bold ${
                  saldo >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                R$ {formatCurrency(saldo)}
              </p>
            </div>
          </div>

          {/* Seletor de Mês */}
          <div className="bg-gradient-to-r from-pink-50 to-purple-50 p-4 rounded-xl border border-purple-100">
            <div className="flex items-center justify-center gap-3">
              {/* Seta para meses muito anteriores */}
              <button
                onClick={() => changeMonth(-6)}
                className="p-2 hover:bg-white rounded-lg transition-colors text-purple-600"
                title="Ver meses anteriores"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>

              {/* Últimos 3 meses */}
              <div className="flex gap-2">
                {[3, 2, 1].map((offset) => {
                  const [year, month] = selectedMonth.split('-').map(Number);
                  const pastDate = new Date(year, month - 1 - offset);
                  const pastMonth = `${pastDate.getFullYear()}-${String(
                    pastDate.getMonth() + 1
                  ).padStart(2, '0')}`;
                  const monthLabel = pastDate
                    .toLocaleDateString('pt-BR', { month: 'short' })
                    .replace('.', '');

                  return (
                    <button
                      key={`past-${offset}`}
                      onClick={() => setSelectedMonth(pastMonth)}
                      className="px-3 py-2 hover:bg-white rounded-lg transition-colors text-purple-600 font-semibold text-sm uppercase min-w-[50px]"
                    >
                      {monthLabel}
                    </button>
                  );
                })}
              </div>

              {/* Mês Atual - Destaque */}
              <div className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-6 py-3 rounded-xl shadow-md mx-2">
                <p className="text-lg font-bold capitalize text-center whitespace-nowrap">
                  {getMonthName(selectedMonth)}
                </p>
              </div>

              {/* Próximos 3 meses */}
              <div className="flex gap-2">
                {[1, 2, 3].map((offset) => {
                  const [year, month] = selectedMonth.split('-').map(Number);
                  const futureDate = new Date(year, month - 1 + offset);
                  const futureMonth = `${futureDate.getFullYear()}-${String(
                    futureDate.getMonth() + 1
                  ).padStart(2, '0')}`;
                  const monthLabel = futureDate
                    .toLocaleDateString('pt-BR', { month: 'short' })
                    .replace('.', '');

                  return (
                    <button
                      key={`future-${offset}`}
                      onClick={() => setSelectedMonth(futureMonth)}
                      className="px-3 py-2 hover:bg-white rounded-lg transition-colors text-purple-600 font-semibold text-sm uppercase min-w-[50px]"
                    >
                      {monthLabel}
                    </button>
                  );
                })}
              </div>

              {/* Seta para meses futuros */}
              <button
                onClick={() => changeMonth(6)}
                className="p-2 hover:bg-white rounded-lg transition-colors text-purple-600"
                title="Ver meses futuros"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>

            {/* Botão voltar ao atual (se não estiver no mês atual) */}
            {!isCurrentMonth() && (
              <div className="text-center mt-3">
                <button
                  onClick={() => {
                    const now = new Date();
                    setSelectedMonth(
                      `${now.getFullYear()}-${String(
                        now.getMonth() + 1
                      ).padStart(2, '0')}`
                    );
                  }}
                  className="text-xs text-purple-600 hover:text-purple-800 underline font-medium"
                >
                  ← Voltar para mês atual
                </button>
              </div>
            )}
          </div>
        </header>

        {/* --- MENU TABS --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 p-2 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {[
              { id: 'dashboard', label: 'Visão Geral', icon: TrendingUp },
              { id: 'transactions', label: 'Lançamentos', icon: DollarSign },
              { id: 'budget', label: 'Orçamento', icon: Calendar },
              { id: 'goals', label: 'Objetivos', icon: Target },
              { id: 'alerts', label: 'Alertas', icon: Bell },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-6 rounded-xl transition-all font-semibold ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon size={18} /> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ============================================================================================== */}
        {/* CONTEÚDO: DASHBOARD */}
        {/* ============================================================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cartão de Resumo */}
              <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                <h2 className="text-xl font-bold mb-6">Resumo do Mês</h2>

                {gamification.show && (
                  <div
                    className={`mb-4 p-4 rounded-xl ${gamification.bgColor}`}
                  >
                    <p
                      className={`text-center text-lg font-bold ${gamification.color}`}
                    >
                      {gamification.message}
                    </p>
                    <p className="text-center text-sm text-gray-600 mt-1">
                      Você gastou {percentualGasto.toFixed(1)}% das suas
                      receitas
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-green-50 rounded-xl border border-green-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg text-green-600">
                        <TrendingUp size={20} />
                      </div>
                      <span className="text-gray-600 font-medium">
                        Receitas
                      </span>
                    </div>
                    <span className="text-green-600 font-bold text-lg">
                      R$ {formatCurrency(totalReceitas)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-red-50 rounded-xl border border-red-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 rounded-lg text-red-600">
                        <TrendingDown size={20} />
                      </div>
                      <span className="text-gray-600 font-medium">
                        Despesas
                      </span>
                    </div>
                    <span className="text-red-600 font-bold text-lg">
                      R$ {formatCurrency(totalDespesas)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                        <DollarSign size={20} />
                      </div>
                      <span className="text-gray-600 font-medium">
                        Resultado
                      </span>
                    </div>
                    <span
                      className={`font-bold text-lg ${
                        saldo >= 0 ? 'text-blue-600' : 'text-red-600'
                      }`}
                    >
                      R$ {formatCurrency(saldo)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Gráfico de Despesas (Pizza) */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold mb-4">Gastos por Categoria</h2>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} (${(percent * 100).toFixed(0)}%)`
                        }
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value) =>
                          `R$ ${formatCurrency(Number(value))}`
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <p>Sem dados suficientes para o gráfico</p>
                  </div>
                )}
              </div>
            </div>

            {/* Gráfico de Metas (Barras Verticais) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                  <Target size={20} />
                </div>
                <h2 className="text-lg font-bold">
                  Progresso das Minhas Metas
                </h2>
              </div>
              {goalsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={goalsChartData}
                    margin={{ top: 20, right: 30, left: 10, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      interval={0}
                    />
                    <YAxis hide domain={[0, 100]} />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                              <p className="font-bold text-gray-800 mb-2">
                                {data.name}
                              </p>
                              <p className="text-sm text-green-600">
                                Guardado: R${' '}
                                {formatCurrency(data.GuardadoValor)}
                              </p>
                              <p className="text-sm text-gray-600">
                                Falta: R$ {formatCurrency(data.FaltaValor)}
                              </p>
                              <p className="text-sm font-bold text-purple-600 mt-1">
                                Meta: R$ {formatCurrency(data.Alvo)}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="GuardadoPercent"
                      stackId="a"
                      radius={[0, 0, 0, 0]}
                      label={({ value, GuardadoValor }) => {
                        if (value > 10) {
                          return `R$ ${formatCurrency(GuardadoValor)}`;
                        }
                        return '';
                      }}
                    >
                      {goalsChartData.map((entry, index) => (
                        <Cell
                          key={`cell-guardado-${index}`}
                          fill={entry.colorMain}
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="FaltaPercent"
                      stackId="a"
                      radius={[4, 4, 0, 0]}
                      label={({ value, FaltaValor }) => {
                        if (value > 10) {
                          return `R$ ${formatCurrency(FaltaValor)}`;
                        }
                        return '';
                      }}
                    >
                      {goalsChartData.map((entry, index) => (
                        <Cell
                          key={`cell-falta-${index}`}
                          fill={entry.colorLight}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[200px] text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Target size={48} className="mb-3 opacity-30" />
                  <p className="font-medium">
                    Cadastre suas metas para ver o progresso aqui
                  </p>
                  <p className="text-sm mt-1">
                    Vá até a aba "Objetivos" para começar
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================================================== */}
        {/* CONTEÚDO: ORÇAMENTO */}
        {/* ============================================================================================== */}
        {activeTab === 'budget' && (
          <div className="space-y-6">
            {/* Dashboard de Previsão */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-green-100 relative overflow-hidden">
                <div className="absolute right-0 top-0 p-4 opacity-10">
                  <TrendingUp size={60} />
                </div>
                <p className="text-gray-500 font-medium text-sm">
                  Receita Prevista
                </p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  R$ {formatCurrency(budgetRevenue)}
                </p>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-red-100 relative overflow-hidden">
                <div className="absolute right-0 top-0 p-4 opacity-10">
                  <TrendingDown size={60} />
                </div>
                <p className="text-gray-500 font-medium text-sm">
                  Despesa Prevista
                </p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  R$ {formatCurrency(budgetExpense)}
                </p>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-blue-100 relative overflow-hidden">
                <div className="absolute right-0 top-0 p-4 opacity-10">
                  <DollarSign size={60} />
                </div>
                <p className="text-gray-500 font-medium text-sm">
                  Saldo Previsto
                </p>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    budgetBalance >= 0 ? 'text-blue-600' : 'text-red-500'
                  }`}
                >
                  R$ {formatCurrency(budgetBalance)}
                </p>
              </div>
            </div>

            {/* Formulário */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">
                  {editingBudgetId ? 'Editar Item' : 'Adicionar ao Orçamento'}
                </h2>
                <button
                  onClick={() => setShowCategoryForm(!showCategoryForm)}
                  className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-100 flex items-center gap-1"
                >
                  <Tag size={16} /> Nova Categoria
                </button>
              </div>

              {showCategoryForm && (
                <div className="mb-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col md:flex-row gap-3 items-end">
                  <div className="w-full">
                    <label className="text-xs text-indigo-800 font-bold ml-1">
                      Nome
                    </label>
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full p-2 rounded-lg border border-indigo-200 text-sm"
                    />
                  </div>
                  <div className="w-full md:w-48">
                    <label className="text-xs text-indigo-800 font-bold ml-1">
                      Tipo
                    </label>
                    <select
                      value={newCategoryType}
                      onChange={(e) =>
                        setNewCategoryType(e.target.value as any)
                      }
                      className="w-full p-2 rounded-lg border border-indigo-200 text-sm"
                    >
                      <option value="despesa">Despesa</option>
                      <option value="receita">Receita</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addCustomCategory}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => setShowCategoryForm(false)}
                      className="bg-white text-gray-500 px-3 py-2 rounded-lg text-sm font-bold border border-gray-200"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
                <div className="lg:col-span-2">
                  <label className="text-xs text-gray-600 font-bold ml-1 block mb-1">
                    Descrição
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Aluguel"
                    className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50"
                    value={newBudgetItem.description}
                    onChange={(e) =>
                      setNewBudgetItem({
                        ...newBudgetItem,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-bold ml-1 block mb-1">
                    Tipo
                  </label>
                  <select
                    className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50"
                    value={newBudgetItem.type}
                    onChange={(e) =>
                      setNewBudgetItem({
                        ...newBudgetItem,
                        type: e.target.value as any,
                      })
                    }
                  >
                    <option value="receita-fixa">Receita Fixa</option>
                    <option value="receita-variável">Receita Variável</option>
                    <option value="despesa-fixa">Despesa Fixa</option>
                    <option value="despesa-variável">Despesa Variável</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-bold ml-1 block mb-1">
                    Categoria
                  </label>
                  <select
                    className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50"
                    value={newBudgetItem.category}
                    onChange={(e) =>
                      setNewBudgetItem({
                        ...newBudgetItem,
                        category: e.target.value,
                      })
                    }
                  >
                    <option value="">Selecione...</option>
                    {getAllCategories(newBudgetItem.type).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-bold ml-1 block mb-1">
                    Valor Total
                  </label>
                  <input
                    type="text"
                    placeholder="0,00"
                    className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50"
                    value={newBudgetItem.estimatedAmount}
                    onChange={(e) =>
                      handleCurrencyInput(e.target.value, (val) =>
                        setNewBudgetItem({
                          ...newBudgetItem,
                          estimatedAmount: val,
                        })
                      )
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-bold ml-1 block mb-1">
                    Parcelas (opcional)
                  </label>
                  <input
                    type="number"
                    placeholder="Deixe vazio para não parcelar"
                    min="1"
                    className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50"
                    value={newBudgetItem.installments}
                    onChange={(e) =>
                      setNewBudgetItem({
                        ...newBudgetItem,
                        installments: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-bold ml-1 block mb-1">
                    Vencimento{' '}
                    {newBudgetItem.installments &&
                    parseInt(newBudgetItem.installments) > 1
                      ? '(1ª Parcela)'
                      : '(opcional)'}
                  </label>
                  <input
                    type="date"
                    placeholder="Último dia do mês se vazio"
                    className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50"
                    value={newBudgetItem.dueDate}
                    onChange={(e) =>
                      setNewBudgetItem({
                        ...newBudgetItem,
                        dueDate: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={saveBudgetItem}
                  className={`w-full md:w-auto px-8 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${
                    editingBudgetId
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg'
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg'
                  }`}
                >
                  {editingBudgetId ? (
                    <>
                      <Save size={20} /> Salvar Alterações
                    </>
                  ) : (
                    <>
                      <Plus size={20} /> Adicionar ao Orçamento
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Listas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg text-green-600">
                    <TrendingUp size={18} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-700">
                    Receitas Planejadas
                  </h3>
                </div>
                <div className="space-y-3">
                  {filteredBudgetItems
                    .filter((i) => i.type.startsWith('receita'))
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center p-3 border border-gray-100 rounded-xl hover:bg-green-50 group"
                      >
                        <div className="flex-1">
                          <p className="font-bold text-gray-800">
                            {item.description}
                            {item.installments && (
                              <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold">
                                {item.installments.current}/
                                {item.installments.total}x
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                              {item.category}
                            </p>
                            {item.dueDate && (
                              <p className="text-xs text-gray-500 bg-green-100 px-2 py-0.5 rounded flex items-center gap-1">
                                <Calendar size={10} />
                                {new Date(item.dueDate).toLocaleDateString(
                                  'pt-BR'
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-green-600">
                            R$ {formatCurrency(item.estimatedAmount)}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                            <button
                              onClick={() => startEditingBudget(item)}
                              className="text-blue-500"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => deleteBudgetItem(item.id)}
                              className="text-red-500"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-red-100 rounded-lg text-red-600">
                    <TrendingDown size={18} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-700">
                    Despesas Planejadas
                  </h3>
                </div>
                <div className="space-y-3">
                  {filteredBudgetItems
                    .filter((i) => i.type.startsWith('despesa'))
                    .map((item) => (
                      <div
                        key={item.id}
                        className={`flex justify-between items-center p-3 border rounded-xl group transition-colors ${
                          item.isPaid
                            ? 'bg-green-50 border-green-200'
                            : 'border-gray-100 hover:bg-red-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <button
                            onClick={() => toggleBudgetItemPaid(item.id)}
                            className={`p-1 rounded-lg transition-colors ${
                              item.isPaid
                                ? 'bg-green-500 hover:bg-green-600'
                                : 'bg-red-500 hover:bg-red-600'
                            }`}
                            title={
                              item.isPaid
                                ? 'Marcar como não pago'
                                : 'Marcar como pago'
                            }
                          >
                            <CheckCircle
                              size={20}
                              className="text-white"
                              fill={item.isPaid ? '#10b981' : 'none'}
                            />
                          </button>
                          <div className="flex-1">
                            <p
                              className={`font-bold text-gray-800 ${
                                item.isPaid ? 'line-through text-gray-500' : ''
                              }`}
                            >
                              {item.description}
                              {item.installments && (
                                <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold">
                                  {item.installments.current}/
                                  {item.installments.total}x
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <p
                                className={`text-xs px-2 py-0.5 rounded ${
                                  item.isPaid
                                    ? 'bg-green-100 text-green-700'
                                    : 'text-gray-500 bg-gray-100'
                                }`}
                              >
                                {item.category}
                              </p>
                              {item.dueDate && (
                                <p
                                  className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
                                    item.isPaid
                                      ? 'bg-green-100 text-green-700'
                                      : 'text-gray-500 bg-red-100'
                                  }`}
                                >
                                  <Calendar size={10} />
                                  {new Date(item.dueDate).toLocaleDateString(
                                    'pt-BR'
                                  )}
                                </p>
                              )}
                              {item.isPaid && (
                                <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded font-bold">
                                  PAGO
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-bold text-lg ${
                              item.isPaid ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            R$ {formatCurrency(item.estimatedAmount)}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                            <button
                              onClick={() => startEditingBudget(item)}
                              className="text-blue-500"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => deleteBudgetItem(item.id)}
                              className="text-red-500"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================================================== */}
        {/* CONTEÚDO: LANÇAMENTOS (SEPARADO EM DUAS COLUNAS) */}
        {/* ============================================================================================== */}
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">
                Novo Lançamento
              </h2>
              {transactionsError && (
                <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {transactionsError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <input
                  type="date"
                  className="p-3 border rounded-xl bg-gray-50"
                  value={newTransaction.date}
                  onChange={(e) =>
                    setNewTransaction({
                      ...newTransaction,
                      date: e.target.value,
                    })
                  }
                />
                <input
                  type="text"
                  placeholder="Descrição"
                  className="p-3 border rounded-xl bg-gray-50"
                  value={newTransaction.description}
                  onChange={(e) =>
                    setNewTransaction({
                      ...newTransaction,
                      description: e.target.value,
                    })
                  }
                />
                <input
                  type="text"
                  placeholder="Valor"
                  className="p-3 border rounded-xl bg-gray-50"
                  value={newTransaction.amount}
                  onChange={(e) =>
                    handleCurrencyInput(e.target.value, (val) =>
                      setNewTransaction({ ...newTransaction, amount: val })
                    )
                  }
                />
                <select
                  className="p-3 border rounded-xl bg-gray-50"
                  value={newTransaction.tipoMovimentacaoId}
                  onChange={(e) =>
                    setNewTransaction({
                      ...newTransaction,
                      tipoMovimentacaoId: e.target.value,
                      categoriaFinanceiraId: '',
                    })
                  }
                >
                  <option value="">Selecione o tipo</option>
                  {tipoMovimentacoes.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.descricao}
                    </option>
                  ))}
                </select>
                <select
                  className="p-3 border rounded-xl bg-gray-50 lg:col-span-3"
                  value={newTransaction.categoriaFinanceiraId}
                  onChange={(e) =>
                    setNewTransaction({
                      ...newTransaction,
                      categoriaFinanceiraId: e.target.value,
                    })
                  }
                >
                  <option value="">Selecione Categoria</option>
                  {getCategoriasFinanceiras(
                    getTipoMovimentacaoBase(newTransaction.tipoMovimentacaoId)
                  ).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.descricao ?? 'Sem categoria'}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addTransaction}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-3 rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={20} /> Adicionar
                </button>
              </div>
            </div>

            {/* HISTÓRICO SEPARADO EM DUAS COLUNAS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* HISTÓRICO DE RECEITAS */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-green-100">
                  <div className="p-2 bg-green-100 rounded-lg text-green-600">
                    <TrendingUp size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">
                    Histórico de Receitas
                  </h3>
                </div>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {transactionsLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <p className="font-medium">Carregando lançamentos...</p>
                    </div>
                  ) : (
                    filteredTransactions
                      .filter((t) => t.type.includes('receita'))
                      .slice()
                      .reverse()
                      .map((t) => (
                        <div
                          key={t.id}
                          className="flex justify-between items-center p-4 border border-gray-100 rounded-xl hover:bg-green-50 transition-colors group"
                        >
                          <div className="flex-1">
                            <p className="font-bold text-gray-800">
                              {t.description}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded mr-2">
                                {t.category}
                              </span>
                              {new Date(t.date).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-green-600 text-lg">
                              + R$ {formatCurrency(t.amount)}
                            </span>
                            <button
                              onClick={() => deleteTransaction(t.id)}
                              className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                  {!transactionsLoading &&
                    filteredTransactions.filter((t) =>
                      t.type.includes('receita')
                    ).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <TrendingUp size={48} className="mb-3 opacity-20" />
                      <p className="font-medium">
                        Nenhuma receita lançada neste mês
                      </p>
                      <p className="text-sm mt-1">
                        Adicione suas receitas acima
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* HISTÓRICO DE DESPESAS */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-red-100">
                  <div className="p-2 bg-red-100 rounded-lg text-red-600">
                    <TrendingDown size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">
                    Histórico de Despesas
                  </h3>
                </div>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {transactionsLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <p className="font-medium">Carregando lançamentos...</p>
                    </div>
                  ) : (
                    filteredTransactions
                      .filter((t) => t.type.includes('despesa'))
                      .slice()
                      .reverse()
                      .map((t) => (
                        <div
                          key={t.id}
                          className="flex justify-between items-center p-4 border border-gray-100 rounded-xl hover:bg-red-50 transition-colors group"
                        >
                          <div className="flex-1">
                            <p className="font-bold text-gray-800">
                              {t.description}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded mr-2">
                                {t.category}
                              </span>
                              {new Date(t.date).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-red-600 text-lg">
                              - R$ {formatCurrency(t.amount)}
                            </span>
                            <button
                              onClick={() => deleteTransaction(t.id)}
                              className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                  {!transactionsLoading &&
                    filteredTransactions.filter((t) =>
                      t.type.includes('despesa')
                    ).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <TrendingDown size={48} className="mb-3 opacity-20" />
                      <p className="font-medium">
                        Nenhuma despesa lançada neste mês
                      </p>
                      <p className="text-sm mt-1">
                        Adicione suas despesas acima
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================================================== */}
        {/* CONTEÚDO: METAS */}
        {/* ============================================================================================== */}
        {activeTab === 'goals' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">
                Nova Meta
              </h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Nome da Meta (Ex: Viagem)"
                  className="w-full p-3 border rounded-xl bg-gray-50"
                  value={newGoal.name}
                  onChange={(e) =>
                    setNewGoal({ ...newGoal, name: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="Valor Alvo"
                  className="w-full p-3 border rounded-xl bg-gray-50"
                  value={newGoal.target}
                  onChange={(e) =>
                    handleCurrencyInput(e.target.value, (val) =>
                      setNewGoal({ ...newGoal, target: val })
                    )
                  }
                />
                <input
                  type="text"
                  placeholder="Já guardado (Opcional)"
                  className="w-full p-3 border rounded-xl bg-gray-50"
                  value={newGoal.current}
                  onChange={(e) =>
                    handleCurrencyInput(e.target.value, (val) =>
                      setNewGoal({ ...newGoal, current: val })
                    )
                  }
                />
                <input
                  type="date"
                  className="w-full p-3 border rounded-xl bg-gray-50"
                  value={newGoal.deadline}
                  onChange={(e) =>
                    setNewGoal({ ...newGoal, deadline: e.target.value })
                  }
                />
                <button
                  onClick={addGoal}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white p-3 rounded-xl font-bold hover:shadow-lg transition-shadow"
                >
                  Criar Meta
                </button>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">
                Minhas Metas
              </h2>
              <div className="space-y-6">
                {goals.map((g) => {
                  const percentage = Math.min(
                    (g.current / g.target) * 100,
                    100
                  );
                  const isCompleted = percentage >= 100;

                  return (
                    <div
                      key={g.id}
                      className={`p-4 rounded-xl border-2 ${
                        isCompleted
                          ? 'bg-green-50 border-green-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800 text-lg">
                              {g.name}
                            </span>
                            {isCompleted && (
                              <PartyPopper
                                className="text-green-600"
                                size={20}
                              />
                            )}
                          </div>
                          {g.deadline && (
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <Calendar size={12} />
                              Prazo:{' '}
                              {new Date(g.deadline).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteGoal(g.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="mb-3">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>R$ {formatCurrency(g.current)}</span>
                          <span className="font-bold">
                            {percentage.toFixed(0)}%
                          </span>
                          <span>R$ {formatCurrency(g.target)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-4">
                          <div
                            className={`h-4 rounded-full transition-all duration-500 ${
                              isCompleted
                                ? 'bg-green-500'
                                : 'bg-gradient-to-r from-pink-500 to-purple-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>

                      {!isCompleted && (
                        <div className="flex gap-2 mt-3">
                          <input
                            type="text"
                            placeholder="Valor a adicionar"
                            className="flex-1 p-2 border rounded-lg text-sm bg-white"
                            value={updateAmounts[g.id] || ''}
                            onChange={(e) =>
                              handleCurrencyInput(e.target.value, (val) =>
                                setUpdateAmounts({
                                  ...updateAmounts,
                                  [g.id]: val,
                                })
                              )
                            }
                          />
                          <button
                            onClick={() => {
                              if (updateAmounts[g.id]) {
                                updateGoalProgress(
                                  g.id,
                                  parseCurrency(updateAmounts[g.id])
                                );
                                setUpdateAmounts({
                                  ...updateAmounts,
                                  [g.id]: '',
                                });
                              }
                            }}
                            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:shadow-lg transition-shadow flex items-center gap-1"
                          >
                            <Plus size={16} /> Atualizar
                          </button>
                        </div>
                      )}

                      {isCompleted && (
                        <div className="text-center text-green-600 font-bold mt-2">
                          🎉 Meta Alcançada! 🎉
                        </div>
                      )}
                    </div>
                  );
                })}
                {goals.length === 0 && (
                  <div className="text-center py-12">
                    <Target size={48} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-400 font-medium">
                      Nenhuma meta cadastrada.
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Crie sua primeira meta ao lado!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================================================== */}
        {/* CONTEÚDO: ALERTAS */}
        {/* ============================================================================================== */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            {/* Informação */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-xl border border-blue-200">
              <div className="flex items-start gap-3">
                <Bell className="text-blue-600 mt-1" size={24} />
                <div>
                  <h3 className="font-bold text-blue-900 mb-1">
                    Central de Alertas
                  </h3>
                  <p className="text-sm text-blue-700">
                    Aqui você visualiza todas as despesas dos{' '}
                    <strong>Lançamentos</strong> e <strong>Orçamento</strong>{' '}
                    organizadas por data de vencimento. As despesas do orçamento
                    que ainda não foram lançadas aparecem como pendentes.
                  </p>
                </div>
              </div>
            </div>

            {(() => {
              const allBills = getAllBills();
              const overdueBills = allBills.filter(
                (b) => !b.isPaid && getAlertStatus(b.date) === 'overdue'
              );
              const warningBills = allBills.filter(
                (b) => !b.isPaid && getAlertStatus(b.date) === 'warning'
              );

              return (
                <div className="grid grid-cols-1 gap-6">
                  {/* Contas Vencidas */}
                  {overdueBills.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border-2 border-red-200 p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-red-100 rounded-lg text-red-600">
                          <AlertTriangle size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-red-700">
                          Contas Vencidas ({overdueBills.length})
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {overdueBills.map((bill) => (
                          <div
                            key={`${bill.source}-${bill.id}`}
                            className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-gray-800">
                                  {bill.description}
                                </p>
                                <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded">
                                  {bill.source === 'budget'
                                    ? 'Orçamento'
                                    : 'Lançado'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {bill.category && (
                                  <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded mr-2">
                                    {bill.category}
                                  </span>
                                )}
                                Vencimento:{' '}
                                {new Date(bill.date).toLocaleDateString(
                                  'pt-BR'
                                )}
                              </p>
                            </div>
                            <span className="font-bold text-red-600 text-lg ml-4">
                              R$ {formatCurrency(bill.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contas a Vencer (Próximos 7 dias) */}
                  {warningBills.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border-2 border-yellow-200 p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-yellow-100 rounded-lg text-yellow-600">
                          <Bell size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-yellow-700">
                          Vencem nos Próximos 7 Dias ({warningBills.length})
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {warningBills.map((bill) => (
                          <div
                            key={`${bill.source}-${bill.id}`}
                            className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-xl"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-gray-800">
                                  {bill.description}
                                </p>
                                <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded">
                                  {bill.source === 'budget'
                                    ? 'Orçamento'
                                    : 'Lançado'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {bill.category && (
                                  <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded mr-2">
                                    {bill.category}
                                  </span>
                                )}
                                Vencimento:{' '}
                                {new Date(bill.date).toLocaleDateString(
                                  'pt-BR'
                                )}
                              </p>
                            </div>
                            <span className="font-bold text-yellow-600 text-lg ml-4">
                              R$ {formatCurrency(bill.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {allBills.length === 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                      <Bell size={48} className="mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-400 font-medium">
                        Nenhuma despesa encontrada
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Adicione despesas nos Lançamentos ou Orçamento
                      </p>
                    </div>
                  )}

                  {allBills.length > 0 &&
                    overdueBills.length === 0 &&
                    warningBills.length === 0 && (
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                        <CheckCircle
                          size={48}
                          className="mx-auto mb-3 text-green-500"
                        />
                        <p className="text-green-600 font-bold text-lg">
                          Tudo em Dia! 🎉
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Nenhuma conta vencida ou próxima do vencimento
                        </p>
                      </div>
                    )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoupleFinancialPlanner;
