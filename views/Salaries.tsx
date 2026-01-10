
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Banknote, Calendar, Plus, Utensils, AlertCircle, Wallet, Trash2, Users, X, AlertTriangle, Hash, Gift, Check, Search, Edit, Save, CheckCircle, UserCog, PieChart, TrendingUp, Info, CreditCard, Clock, ChevronDown, Loader2, Globe, Timer, Calculator, Plane, SaveAll, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Employee, SalaryTransaction, SalaryTransactionType } from '../types';
import { supabase } from '../services/supabaseClient';
import StatCard from '../components/StatCard';
import { logAction } from '../services/auditLogService';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import { round } from '../utils/mathUtils';

type TabType = 'overview' | 'payroll' | 'employees' | 'loans' | 'deductions' | 'meals' | 'shortages' | 'bonuses';

// الثوابت العالمية للشهر الحالي
const currentMonthNum = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

const Salaries: React.FC = () => {
  const { user } = useAuth();
  const { hasFeature } = usePermissions();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<SalaryTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
  
  // حالات الإدخال لمسير الرواتب
  const [workingDays, setWorkingDays] = useState<Record<string, number>>({});
  const [extraDays, setExtraDays] = useState<Record<string, number>>({});
  const [extraHours, setExtraHours] = useState<Record<string, number>>({});
  const [annualLeaveDays, setAnnualLeaveDays] = useState<Record<string, number>>({});

  // تعريف التبويبات مع مفاتيح الصلاحيات
  const allTabs = useMemo(() => [
    { id: 'overview', label: 'نظرة عامة', icon: PieChart, fKey: 'showOverview' },
    { id: 'employees', label: 'الموظفين', icon: Users, fKey: 'showEmployees' },
    { id: 'payroll', label: 'مسير الرواتب', icon: Banknote, fKey: 'showPayroll' },
    { id: 'loans', label: 'السلف', icon: Wallet, fKey: 'showLoans' },
    { id: 'deductions', label: 'الخصومات', icon: AlertCircle, fKey: 'showDeductions' },
    { id: 'meals', label: 'الوجبات', icon: Utensils, fKey: 'showMeals' },
    { id: 'shortages', label: 'العجوزات', icon: AlertTriangle, fKey: 'showShortages' },
    { id: 'bonuses', label: 'المكافآت', icon: Gift, fKey: 'showBonuses' }
  ], []);

  const availableTabs = useMemo(() => 
    allTabs.filter(tab => hasFeature('salaries', tab.fKey)), 
  [allTabs, hasFeature]);

  // تعيين أول تبويب متاح عند التحميل
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(t => t.id === activeTab)) {
        setActiveTab(availableTabs[0].id as TabType);
    }
  }, [availableTabs, activeTab]);

  const fetchData = async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    
    // 1. جلب بيانات الموظفين
    const { data: empData } = await supabase.from('employees').select('*').order('name');
    
    // 2. جلب سجلات المسير المحفوظة لهذا الشهر (payroll_records)
    const { data: payrollRecords } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('month', currentMonthNum)
      .eq('year', currentYear);

    if (empData) {
      setEmployees(empData);
      
      const newWorkingDays: Record<string, number> = {};
      const newExtraDays: Record<string, number> = {};
      const newExtraHours: Record<string, number> = {};
      const newLeaveDays: Record<string, number> = {};

      empData.forEach(e => {
        const record = payrollRecords?.find(r => r.employee_id === e.id);
        newWorkingDays[e.id] = record ? record.working_days : 30;
        newExtraDays[e.id] = record ? record.extra_days : 0;
        newExtraHours[e.id] = record ? record.extra_hours : 0;
        newLeaveDays[e.id] = record ? record.leave_days : 0;
      });

      setWorkingDays(newWorkingDays);
      setExtraDays(newExtraDays);
      setExtraHours(newExtraHours);
      setAnnualLeaveDays(newLeaveDays);
    }
    
    // 3. جلب العمليات المالية (سلف، خصومات...)
    const { data: trxData } = await supabase.from('salaryTransactions').select('*');
    if (trxData) setTransactions(trxData);
    
    if (isInitial) setIsLoading(false);
  };

  useEffect(() => {
    fetchData(true);

    const channel = supabase.channel('salaries-persistence-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'salaryTransactions' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll_records' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const calculateEmployeeStats = (emp: Employee) => {
    const empTrx = transactions.filter(t => {
        const d = new Date(t.date);
        return t.employeeId === emp.id && (d.getMonth() + 1) === currentMonthNum && d.getFullYear() === currentYear;
    });
    
    const daysWorked = workingDays[emp.id] ?? 30;
    const leaveD = annualLeaveDays[emp.id] || 0;
    
    const baseSal = emp.basicSalary || 0;
    const totalSal = emp.salary || 0;

    const proratedSalary = round((totalSal / 30) * (daysWorked + leaveD));
    const extraD = extraDays[emp.id] || 0;
    const extraH = extraHours[emp.id] || 0;
    const empDailyHours = emp.dailyHours || 10; 
    
    const extraDaysValue = round((baseSal / 30) * extraD * 1.5);
    const extraHoursValue = round(1.5 * (extraH * (baseSal / 30 / empDailyHours)));
    
    const loans = empTrx.filter(t => t.type === 'loan').reduce((sum, t) => sum + t.amount, 0);
    const deductions = empTrx.filter(t => t.type === 'deduction').reduce((sum, t) => sum + t.amount, 0);
    const meals = empTrx.filter(t => t.type === 'meal').reduce((sum, t) => sum + t.amount, 0);
    const shortages = empTrx.filter(t => t.type === 'shortage').reduce((sum, t) => sum + t.amount, 0);
    const bonuses = empTrx.filter(t => t.type === 'bonus').reduce((sum, t) => sum + t.amount, 0);
    
    const totalDeductions = loans + deductions + meals + shortages;
    const netSalary = proratedSalary + extraDaysValue + extraHoursValue - totalDeductions + bonuses;
    
    return { proratedSalary, extraDaysValue, extraHoursValue, loans, deductions, meals, shortages, bonuses, totalDeductions, netSalary, daysWorked, extraD, extraH, leaveD };
  };

  const handleSavePayrollRow = async (empId: string) => {
    setSaveStatus(prev => ({ ...prev, [empId]: 'saving' }));
    
    const payrollData = {
      employee_id: empId,
      month: currentMonthNum,
      year: currentYear,
      working_days: workingDays[empId] || 0,
      extra_days: extraDays[empId] || 0,
      extra_hours: extraHours[empId] || 0,
      leave_days: annualLeaveDays[empId] || 0,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('payroll_records')
      .upsert(payrollData, { onConflict: 'employee_id,month,year' });

    if (!error) {
      setSaveStatus(prev => ({ ...prev, [empId]: 'saved' }));
      const empName = employees.find(e => e.id === empId)?.name;
      await logAction(user, 'update', 'الرواتب', `حفظ مسير الموظف ${empName} لشهر ${currentMonthNum}`);
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [empId]: 'idle' })), 2000);
    } else {
      console.error("Save error:", error);
      alert("فشل حفظ البيانات.");
      setSaveStatus(prev => ({ ...prev, [empId]: 'idle' }));
    }
  };

  const handleDaysChange = (id: string, val: string) => {
    const days = Math.min(31, Math.max(0, Number(val) || 0));
    setWorkingDays(prev => ({ ...prev, [id]: days }));
    setSaveStatus(prev => ({ ...prev, [id]: 'idle' }));
  };

  const handleExtraDaysChange = (id: string, val: string) => {
    const days = Math.max(0, Number(val) || 0);
    setExtraDays(prev => ({ ...prev, [id]: days }));
    setSaveStatus(prev => ({ ...prev, [id]: 'idle' }));
  };

  const handleExtraHoursChange = (id: string, val: string) => {
    const hours = Math.max(0, Number(val) || 0);
    setExtraHours(prev => ({ ...prev, [id]: hours }));
    setSaveStatus(prev => ({ ...prev, [id]: 'idle' }));
  };

  const handleLeaveChange = (id: string, val: string) => {
    const days = Math.min(31, Math.max(0, Number(val) || 0));
    setAnnualLeaveDays(prev => ({ ...prev, [id]: days }));
    setSaveStatus(prev => ({ ...prev, [id]: 'idle' }));
  };

  const overviewStats = useMemo(() => {
    const activeEmployees = employees.length;
    let expectedCash = 0;
    let expectedTransfer = 0;
    let cashLoans = 0;
    let transferLoans = 0;
    let totalDeductions = 0;
    let totalBonuses = 0;

    employees.forEach(emp => {
      const stats = calculateEmployeeStats(emp);
      
      if (emp.paymentMethod === 'cash') {
        expectedCash += stats.netSalary;
        cashLoans += stats.loans;
      } else {
        expectedTransfer += stats.netSalary;
        transferLoans += stats.loans;
      }
      
      totalDeductions += stats.totalDeductions;
      totalBonuses += stats.bonuses;
    });

    return { 
      activeEmployees, 
      expectedCash, 
      expectedTransfer, 
      cashLoans, 
      transferLoans, 
      expectedPayroll: expectedCash + expectedTransfer, 
      totalDeductions, 
      totalBonuses 
    };
  }, [employees, transactions, workingDays, extraDays, extraHours, annualLeaveDays]);

  const updatePaymentMethodQuickly = async (id: string, method: 'cash' | 'transfer') => {
      const emp = employees.find(e => e.id === id);
      if (!emp || emp.paymentMethod === method) return;
      setIsUpdating(id);
      const { error } = await supabase.from('employees').update({ paymentMethod: method }).eq('id', id);
      if (error) alert(`فشل التحديث: ${error.message}`);
      else {
          setEmployees(prev => prev.map(e => e.id === id ? { ...e, paymentMethod: method } : e));
          await logAction(user, 'update', 'الرواتب', `تغيير طريقة صرف الموظف ${emp.name} إلى ${method === 'cash' ? 'كاش' : 'حوالة'}`);
      }
      setIsUpdating(null);
  };

  const handleSaveEmployee = async () => {
    if (!newEmployee.name || totalCalculatedSalary <= 0) {
      alert("يرجى إكمال البيانات الأساسية والراتب");
      return;
    }
    const employeePayload = {
        name: newEmployee.name, role: newEmployee.role, salary: totalCalculatedSalary,
        basicSalary: Number(newEmployee.basicSalary) || 0, housingAllowance: Number(newEmployee.housingAllowance) || 0,
        transportationAllowance: Number(newEmployee.transportationAllowance) || 0, phone: newEmployee.phone,
        code: newEmployee.code, paymentMethod: newEmployee.paymentMethod, nationality: newEmployee.nationality,
        dailyHours: Number(newEmployee.dailyHours) || 10
    };
    if (editingEmpId) {
        await supabase.from('employees').update(employeePayload).eq('id', editingEmpId);
        await logAction(user, 'update', 'الموظفين', `تعديل بيانات الموظف ${newEmployee.name}`);
        setShowEmpModal(false);
    } else {
        const emp: Employee = { id: `EMP-${Date.now()}`, joinDate: new Date().toISOString().split('T')[0], ...employeePayload } as Employee;
        await supabase.from('employees').insert(emp);
        await logAction(user, 'create', 'الموظفين', `إضافة موظف جديد: ${newEmployee.name}`);
        setShowEmpModal(false);
    }
    fetchData();
  };

  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({ 
    name: '', role: '', salary: 0, basicSalary: 0, housingAllowance: 0, transportationAllowance: 0, 
    phone: '', code: '', paymentMethod: 'transfer', nationality: '', dailyHours: 10
  });

  const totalCalculatedSalary = useMemo(() => {
    return round((newEmployee.basicSalary || 0) + (newEmployee.housingAllowance || 0) + (newEmployee.transportationAllowance || 0));
  }, [newEmployee.basicSalary, newEmployee.housingAllowance, newEmployee.transportationAllowance]);

  const openAddEmployeeModal = () => {
    setNewEmployee({ name: '', role: '', salary: 0, basicSalary: 0, housingAllowance: 0, transportationAllowance: 0, phone: '', code: '', paymentMethod: 'transfer', nationality: '', dailyHours: 10 });
    setEditingEmpId(null);
    setShowEmpModal(true);
  };

  const openEditEmployeeModal = (emp: Employee) => {
    setNewEmployee({
      name: emp.name, role: emp.role, salary: emp.salary, basicSalary: emp.basicSalary || 0,
      housingAllowance: emp.housingAllowance || 0, transportationAllowance: emp.transportationAllowance || 0,
      phone: emp.phone, code: emp.code, paymentMethod: emp.paymentMethod || 'transfer',
      nationality: emp.nationality || '', dailyHours: emp.dailyHours || 10
    });
    setEditingEmpId(emp.id);
    setShowEmpModal(true);
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [empToDelete, setEmpToDelete] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const initiateDeleteEmployee = (id: string) => {
    setEmpToDelete(id);
    setDeletePassword('');
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteEmployee = async () => {
    if (deletePassword === '1234') {
      if (empToDelete) {
        const emp = employees.find(e => e.id === empToDelete);
        if (emp) await logAction(user, 'delete', 'الموظفين', `حذف الموظف: ${emp.name}`);
        await supabase.from('employees').delete().eq('id', empToDelete);
        fetchData();
      }
      setIsDeleteModalOpen(false);
    } else setDeleteError('كلمة المرور غير صحيحة');
  };

  const [newTransaction, setNewTransaction] = useState<{ employeeId: string; amount: string; date: string; notes: string; }>({
    employeeId: '', amount: '', date: new Date().toISOString().split('T')[0], notes: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const handleAddTransaction = async (type: SalaryTransactionType) => {
    if (!newTransaction.employeeId || !newTransaction.amount) return;
    const trx: SalaryTransaction = {
      id: `TRX-${Date.now()}`,
      employeeId: newTransaction.employeeId,
      amount: Number(newTransaction.amount),
      date: newTransaction.date,
      type: type,
      notes: newTransaction.notes
    };
    await supabase.from('salaryTransactions').insert(trx);
    const emp = employees.find(e => e.id === newTransaction.employeeId);
    await logAction(user, 'create', 'الرواتب', `إضافة ${type} للموظف ${emp?.name} بمبلغ ${newTransaction.amount}`);
    setNewTransaction(prev => ({ ...prev, employeeId: '', amount: '', notes: '' }));
    setSearchTerm('');
  };

  const handleDeleteTransaction = async (id: string) => {
      const trx = transactions.find(t => t.id === id);
      if (trx) await logAction(user, 'delete', 'الرواتب', `حذف ${trx.type} بقيمة ${trx.amount}`);
      await supabase.from('salaryTransactions').delete().eq('id', id);
  };

  const renderTransactionForm = (type: SalaryTransactionType, title: string, icon: React.ElementType, colorClass: string) => {
    const currentTransactions = transactions.filter(t => t.type === type && (new Date(t.date).getMonth()+1 === currentMonthNum));
    const totalAmount = currentTransactions.reduce((sum, t) => sum + t.amount, 0);
    const filteredEmployees = employees.filter(emp => emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || (emp.code && emp.code.toLowerCase().includes(searchTerm.toLowerCase())));
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3">
             <StatCard title={`إجمالي ${title}`} value={totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} icon={icon as any} color="blue" trend="للشهر الحالي" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit text-right">
              <h3 className={`font-bold mb-4 flex items-center gap-2 ${colorClass}`}>
                {React.createElement(icon, { size: 20 })}
                تسجيل {title} جديد
              </h3>
              <div className="space-y-4">
                <div className="relative" ref={searchWrapperRef}>
                    <label className="block text-sm font-medium text-slate-600 mb-1">الموظف</label>
                    <div className="relative">
                        <input type="text" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 pl-8 text-right" placeholder="بحث..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setNewTransaction({...newTransaction, employeeId: ''}); setShowSearchDropdown(true); }} onFocus={() => setShowSearchDropdown(true)} />
                        <Search size={16} className="absolute left-2 top-3 text-slate-400" />
                        {newTransaction.employeeId && <Check size={16} className="absolute right-2 top-3 text-green-500" />}
                    </div>
                    {showSearchDropdown && (
                        <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                            {filteredEmployees.map(emp => (
                                    <div key={emp.id} onClick={() => { setNewTransaction({...newTransaction, employeeId: emp.id}); setSearchTerm(`${emp.name} ${emp.code ? `(${emp.code})` : ''}`); setShowSearchDropdown(false); }} className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center">
                                        <div><p className="font-medium text-slate-700 text-sm">{emp.name}</p></div>
                                        {emp.code && <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded font-mono">#{emp.code}</span>}
                                    </div>
                            ))}
                        </div>
                    )}
                </div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">المبلغ</label><input type="number" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 text-center" placeholder="0.00" value={newTransaction.amount} onChange={e => setNewTransaction({...newTransaction, amount: e.target.value})} /></div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">التاريخ</label><input type="date" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500" value={newTransaction.date} onChange={e => setNewTransaction({...newTransaction, date: e.target.value})} /></div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">ملاحظات</label><textarea className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 text-right" rows={3} value={newTransaction.notes} onChange={e => setNewTransaction({...newTransaction, notes: e.target.value})}></textarea></div>
                <button onClick={() => handleAddTransaction(type)} disabled={!newTransaction.employeeId} className={`w-full py-2 rounded-lg transition-colors font-medium flex justify-center items-center gap-2 ${newTransaction.employeeId ? 'bg-slate-800 text-white hover:bg-slate-900' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}><Plus size={18} /> حفظ</button>
              </div>
          </div>
          <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden text-right">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center"><h3 className="font-bold text-slate-700">سجل {title} (الشهر الحالي)</h3></div>
              <table className="w-full text-right"><thead className="bg-slate-50 text-slate-500 text-sm"><tr><th className="p-4">التاريخ</th><th className="p-4">الموظف</th><th className="p-4">المبلغ</th><th className="p-4">ملاحظات</th><th className="p-4 text-center">إجراء</th></tr></thead><tbody className="divide-y divide-slate-100">{transactions.filter(t => t.type === type && (new Date(t.date).getMonth()+1 === currentMonthNum)).map(t => { const emp = employees.find(e => e.id === t.employeeId); return (<tr key={t.id} className="hover:bg-slate-50 transition-colors"><td className="p-4 font-mono text-slate-600 text-sm">{t.date}</td><td className="p-4 font-medium text-slate-800">{emp ? emp.name : '-'}</td><td className={`p-4 font-bold ${colorClass.split(' ')[0]}`}>{t.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="p-4 text-slate-500 text-sm">{t.notes}</td><td className="p-4 text-center"><button onClick={() => handleDeleteTransaction(t.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button></td></tr>)})}</tbody></table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in text-right" dir="rtl">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <UserCog className="text-indigo-600" size={28} />
                إدارة الموارد البشرية والرواتب
            </h2>
            <p className="text-slate-500 text-sm mt-1">إدارة بيانات الموظفين والحسابات والمسيرات الشهرية.</p>
         </div>
      </div>

      <div className="mb-6">
         <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1 overflow-x-auto custom-scrollbar">
             {availableTabs.map((tab) => (
                 <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`px-5 py-2.5 rounded-t-xl flex items-center gap-2 transition-all font-bold text-sm whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-indigo-600 border-x border-t border-slate-200 shadow-sm relative top-px' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}><tab.icon size={18} /><span>{tab.label}</span></button>
             ))}
         </div>
      </div>

      <div className="mt-4">
          {activeTab === 'overview' && hasFeature('salaries', 'showOverview') && (
              <div className="space-y-8 animate-fade-in">
                 {/* البطاقات الرئيسية */}
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="إجمالي الموظفين" value={overviewStats.activeEmployees.toString()} icon={Users} color="blue" trend="موظف نشط حالياً" />
                    <StatCard title="صافي الرواتب المستحقة" value={overviewStats.expectedPayroll.toLocaleString()} icon={TrendingUp} color="green" trend="إجمالي ما سيتم صرفه" />
                    <StatCard title="إجمالي السلف" value={(overviewStats.cashLoans + overviewStats.transferLoans).toLocaleString()} icon={Wallet} color="orange" trend="ريال (هذا الشهر)" />
                    <StatCard title="إجمالي الخصومات" value={overviewStats.totalDeductions.toLocaleString()} icon={AlertCircle} color="red" trend="خصومات وجزاءات" />
                 </div>

                 {/* جدول ملخص الرواتب حسب طريقة الصرف */}
                 <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-50 bg-slate-50 flex items-center justify-between">
                        <h3 className="font-black text-slate-700 flex items-center gap-2">
                            <Calculator size={20} className="text-indigo-600" />
                            ملخص الرواتب والسلف (كاش وحوالات)
                        </h3>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Financial Disbursement Summary</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="p-5">البند المالي</th>
                                    <th className="p-5 text-center">نقدي (كاش)</th>
                                    <th className="p-5 text-center">حوالة بنكية</th>
                                    <th className="p-5 text-center bg-indigo-50/30">الإجمالي</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                <tr className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Banknote size={18} /></div>
                                            <span className="font-black text-slate-800 text-sm">صافي الرواتب المستحقة</span>
                                        </div>
                                    </td>
                                    <td className="p-5 text-center font-bold text-slate-700 font-mono">{overviewStats.expectedCash.toLocaleString()} ر.س</td>
                                    <td className="p-5 text-center font-bold text-slate-700 font-mono">{overviewStats.expectedTransfer.toLocaleString()} ر.س</td>
                                    <td className="p-5 text-center font-black text-indigo-700 font-mono bg-indigo-50/20">{(overviewStats.expectedCash + overviewStats.expectedTransfer).toLocaleString()} ر.س</td>
                                </tr>
                                <tr className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Wallet size={18} /></div>
                                            <span className="font-black text-slate-800 text-sm">إجمالي السلف الممنوحة</span>
                                        </div>
                                    </td>
                                    <td className="p-5 text-center font-bold text-orange-600 font-mono">{overviewStats.cashLoans.toLocaleString()} ر.س</td>
                                    <td className="p-5 text-center font-bold text-blue-600 font-mono">{overviewStats.transferLoans.toLocaleString()} ر.س</td>
                                    <td className="p-5 text-center font-black text-indigo-700 font-mono bg-indigo-50/20">{(overviewStats.cashLoans + overviewStats.transferLoans).toLocaleString()} ر.س</td>
                                </tr>
                            </tbody>
                            <tfoot className="bg-slate-900 text-white font-black text-lg">
                                <tr>
                                    <td className="p-6">الإجمالي الكلي للصرف هذا الشهر</td>
                                    <td className="p-6 text-center font-mono">{(overviewStats.expectedCash + overviewStats.cashLoans).toLocaleString()}</td>
                                    <td className="p-6 text-center font-mono">{(overviewStats.expectedTransfer + overviewStats.transferLoans).toLocaleString()}</td>
                                    <td className="p-6 text-center font-mono bg-indigo-600 text-2xl">
                                        {(overviewStats.expectedCash + overviewStats.expectedTransfer + overviewStats.cashLoans + overviewStats.transferLoans).toLocaleString()}
                                        <span className="text-xs mr-2 opacity-70">ر.س</span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                 </div>
              </div>
          )}

          {activeTab === 'payroll' && hasFeature('salaries', 'showPayroll') && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
                <div className="overflow-x-auto">
                    <table className="w-full text-right min-w-[1500px]">
                      <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase border-b border-slate-100">
                        <tr>
                          <th className="p-4 text-sm font-bold sticky right-0 bg-slate-50 z-10 text-center">الموظف</th>
                          <th className="p-4 text-sm font-bold text-center">طريقة الصرف</th>
                          <th className="p-4 text-center w-20">أيام العمل</th>
                          <th className="p-4 text-center w-20 text-indigo-600 bg-indigo-50/20">إجازة سنوية</th>
                          <th className="p-4 text-center w-32 text-blue-600 bg-blue-50/20">أيام إضافية (×1.5)</th>
                          <th className="p-4 text-center w-32 text-blue-600 bg-blue-50/20">ساعات إضافية (×1.5)</th>
                          <th className="p-4 text-center">الأساسي</th>
                          <th className="p-4 text-center text-orange-600">السلف</th>
                          <th className="p-4 text-center text-red-600">الخصومات</th>
                          <th className="p-4 text-center text-blue-600">الوجبات</th>
                          <th className="p-4 text-center text-purple-600">العجوزات</th>
                          <th className="p-4 text-center text-green-600">مكافآت</th>
                          <th className="p-4 bg-indigo-50 font-bold text-indigo-900 text-center">صافي المستحق</th>
                          <th className="p-4 text-center bg-slate-50 sticky left-0 z-10">حفظ الصف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {employees.map((emp) => { 
                          const stats = calculateEmployeeStats(emp); 
                          const isCurrentlyUpdating = isUpdating === emp.id;
                          const currentSaveStatus = saveStatus[emp.id] || 'idle';
                          const totalAllowances = (emp.housingAllowance || 0) + (emp.transportationAllowance || 0);
                          return (
                            <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                              <td className="p-4 sticky right-0 bg-white group-hover:bg-slate-50 z-10 border-l border-slate-100 text-right">
                                <p className="font-bold text-slate-800">{emp.name}</p>
                                <p className="text-[10px] text-slate-400">{emp.role}</p>
                              </td>
                              <td className="p-4 text-center">
                                <div className="relative inline-block">
                                    <select 
                                      value={emp.paymentMethod || 'transfer'}
                                      onChange={(e) => updatePaymentMethodQuickly(emp.id, e.target.value as 'cash' | 'transfer')}
                                      disabled={isCurrentlyUpdating}
                                      className={`text-[10px] font-bold px-2 py-1 rounded-lg outline-none border cursor-pointer transition-all appearance-none pr-6 ${
                                        emp.paymentMethod === 'cash' 
                                          ? 'bg-orange-50 text-orange-600 border-orange-200' 
                                          : 'bg-blue-50 text-blue-600 border-blue-200'
                                      } ${isCurrentlyUpdating ? 'opacity-50 cursor-wait' : ''}`}
                                    >
                                      <option value="transfer">حوالة بنكية</option>
                                      <option value="cash">نقدي (كاش)</option>
                                    </select>
                                    <div className="absolute left-1 top-1.5 pointer-events-none">
                                        {isCurrentlyUpdating ? <Loader2 size={12} className="animate-spin text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
                                    </div>
                                </div>
                              </td>
                              <td className="p-4 text-center">
                                  <input type="number" value={workingDays[emp.id] || 0} onChange={(e) => handleDaysChange(emp.id, e.target.value)} className="w-14 p-1 border border-slate-200 rounded text-center font-bold text-slate-700 bg-slate-50 outline-none text-xs" />
                              </td>
                              <td className="p-4 text-center bg-indigo-50/10">
                                  <input type="number" value={annualLeaveDays[emp.id] || 0} onChange={(e) => handleLeaveChange(emp.id, e.target.value)} className="w-14 p-1 border border-indigo-100 rounded text-center font-bold text-indigo-600 bg-white outline-none text-xs" placeholder="0" />
                              </td>
                              <td className="p-4 text-center bg-blue-50/10">
                                  <div className="flex flex-col items-center">
                                      <input type="number" value={extraDays[emp.id] || 0} onChange={(e) => handleExtraDaysChange(emp.id, e.target.value)} className="w-16 p-1 border border-blue-200 rounded text-center font-bold text-blue-700 bg-white outline-none text-xs mb-1" placeholder="0" />
                                      {stats.extraDaysValue > 0 && <span className="text-[9px] font-black text-blue-500 whitespace-nowrap">{stats.extraDaysValue.toLocaleString()} ر.س</span>}
                                  </div>
                              </td>
                              <td className="p-4 text-center bg-blue-50/10">
                                  <div className="flex flex-col items-center">
                                      <input type="number" value={extraHours[emp.id] || 0} onChange={(e) => handleExtraHoursChange(emp.id, e.target.value)} className="w-16 p-1 border border-blue-200 rounded text-center font-bold text-blue-700 bg-white outline-none text-xs mb-1" placeholder="0" />
                                      {stats.extraHoursValue > 0 && <span className="text-[9px] font-black text-blue-500 whitespace-nowrap">{stats.extraHoursValue.toLocaleString()} ر.س</span>}
                                  </div>
                              </td>
                              <td className="p-4 text-center">
                                <p className="font-bold text-slate-700 font-mono text-xs">{(emp.basicSalary || 0).toLocaleString()}</p>
                                {totalAllowances > 0 && <p className="text-[8px] text-slate-400">بدلات: {totalAllowances.toLocaleString()}</p>}
                                {stats.daysWorked !== 30 && <p className="text-[9px] text-indigo-500 font-bold">لـ {stats.daysWorked} يوم</p>}
                              </td>
                              <td className="p-4 text-orange-600 font-mono text-xs text-center">{stats.loans > 0 ? stats.loans.toLocaleString() : '-'}</td>
                              <td className="p-4 text-red-600 font-mono text-xs text-center">{stats.deductions > 0 ? stats.deductions.toLocaleString() : '-'}</td>
                              <td className="p-4 text-blue-600 font-mono text-xs text-center">{stats.meals > 0 ? stats.meals.toLocaleString() : '-'}</td>
                              <td className="p-4 text-purple-600 font-mono text-xs text-center">{stats.shortages > 0 ? stats.shortages.toLocaleString() : '-'}</td>
                              <td className="p-4 text-green-600 font-bold font-mono text-xs text-center">{stats.bonuses > 0 ? stats.bonuses.toLocaleString() : '-'}</td>
                              <td className="p-4 font-black text-indigo-700 bg-indigo-50/30 text-base border-x border-slate-100 font-mono text-center">{stats.netSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                              <td className="p-4 text-center bg-white sticky left-0 z-10 border-r border-slate-100 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)]">
                                  <button 
                                    onClick={() => handleSavePayrollRow(emp.id)}
                                    disabled={currentSaveStatus === 'saving'}
                                    className={`p-2 rounded-xl transition-all shadow-sm ${
                                      currentSaveStatus === 'saved' ? 'bg-green-100 text-green-600' : 
                                      currentSaveStatus === 'saving' ? 'bg-slate-100 text-slate-400' :
                                      'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'
                                    }`}
                                    title="حفظ بيانات الموظف لهذا الشهر"
                                  >
                                      {currentSaveStatus === 'saving' ? <Loader2 size={18} className="animate-spin" /> : 
                                       currentSaveStatus === 'saved' ? <CheckCircle size={18} /> : 
                                       <Save size={18} />}
                                  </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                </div>
              </div>
          )}

          {activeTab === 'employees' && hasFeature('salaries', 'showEmployees') && (
              <div className="space-y-6 animate-fade-in text-right">
                 <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">قائمة الموظفين ({employees.length})</h3>
                    <button onClick={openAddEmployeeModal} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 flex items-center gap-2 font-bold text-sm transition-all"><Plus size={18} /> إضافة موظف</button>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {employees.map(emp => {
                        const isCurrentlyUpdating = isUpdating === emp.id;
                        return (
                        <div key={emp.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 relative group hover:shadow-md transition-all border-b-4 border-b-indigo-500">
                            {emp.code && (<div className="absolute top-2 left-2 bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded font-mono">#{emp.code}</div>)}
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => openEditEmployeeModal(emp)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={16} /></button>
                                <button onClick={() => initiateDeleteEmployee(emp.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                            </div>
                            <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 mt-2"><User size={28} /></div>
                            <div className="flex-1 mt-2">
                                <h3 className="font-black text-lg text-slate-800 leading-tight">{emp.name}</h3>
                                <p className="text-slate-500 text-xs font-bold mb-1">{emp.role}</p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-2 font-bold">
                                    <Globe size={12} className="text-slate-300" /> {emp.nationality || 'غير محدد'}
                                    <span className="mx-1">|</span>
                                    <Timer size={12} className="text-slate-300" /> {emp.dailyHours || 10} ساعات
                                </div>
                                <div className="space-y-1.5 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <div className="flex justify-between text-xs"><span className="opacity-70">الأساسي:</span><span className="font-bold text-slate-700">{(emp.basicSalary || 0).toLocaleString()} ر.س</span></div>
                                    <div className="flex justify-between text-xs"><span className="opacity-70">سكن/مواصلات:</span><span className="font-bold text-slate-700">{((emp.housingAllowance || 0) + (emp.transportationAllowance || 0)).toLocaleString()} ر.س</span></div>
                                    <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1"><span className="text-xs font-black">إجمالي الراتب:</span><span className="font-black text-indigo-600">{emp.salary.toLocaleString()} ر.س</span></div>
                                    <div className="flex justify-between items-center mt-1"><span className="text-[10px] opacity-70 font-bold">طريقة الصرف:</span>
                                        <div className="relative">
                                            <select 
                                              value={emp.paymentMethod || 'transfer'}
                                              onChange={(e) => updatePaymentMethodQuickly(emp.id, e.target.value as 'cash' | 'transfer')}
                                              disabled={isCurrentlyUpdating}
                                              className={`text-[10px] font-bold border-none bg-transparent outline-none cursor-pointer focus:ring-0 ${emp.paymentMethod === 'cash' ? 'text-orange-600' : 'text-blue-600'} ${isCurrentlyUpdating ? 'opacity-30' : ''}`}
                                            >
                                                <option value="transfer">حوالة بنكية</option>
                                                <option value="cash">نقدي (كاش)</option>
                                            </select>
                                            {isCurrentlyUpdating && <Loader2 size={10} className="animate-spin absolute -left-4 top-1 text-indigo-400" />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )})}
                 </div>
              </div>
          )}
          {activeTab === 'loans' && hasFeature('salaries', 'showLoans') && renderTransactionForm('loan', 'سلفة / قرض', Wallet, 'text-orange-600')}
          {activeTab === 'deductions' && hasFeature('salaries', 'showDeductions') && renderTransactionForm('deduction', 'خصم إداري', AlertCircle, 'text-red-600')}
          {activeTab === 'meals' && hasFeature('salaries', 'showMeals') && renderTransactionForm('meal', 'وجبة', Utensils, 'text-blue-600')}
          {activeTab === 'shortages' && hasFeature('salaries', 'showShortages') && renderTransactionForm('shortage', 'عجز صندوق', AlertTriangle, 'text-purple-600')}
          {activeTab === 'bonuses' && hasFeature('salaries', 'showBonuses') && renderTransactionForm('bonus', 'مكافأة / حافز', Gift, 'text-green-600')}
      </div>

      {showEmpModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-8 animate-scale-in text-right">
                <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><Users size={24} className="text-indigo-600" />{editingEmpId ? 'تعديل بيانات موظف' : 'تسجيل موظف جديد'}</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-black text-slate-500 mb-1.5 mr-1">الرقم الوظيفي</label><input type="text" className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-right" value={newEmployee.code} onChange={e => setNewEmployee({...newEmployee, code: e.target.value})} placeholder="101" /></div>
                        <div><label className="block text-xs font-black text-slate-500 mb-1.5 mr-1">الجنسية</label><input type="text" className="w-full p-3 border border-slate-200 rounded-xl bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-right" value={newEmployee.nationality} onChange={e => setNewEmployee({...newEmployee, nationality: e.target.value})} placeholder="سعودي / هندي..." /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-1"><label className="block text-xs font-black text-slate-500 mb-1.5 mr-1">الاسم الكامل</label><input type="text" className="w-full p-3 border border-slate-200 rounded-xl bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-right" value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} /></div>
                      <div><label className="block text-xs font-black text-slate-500 mb-1.5 mr-1">المسمى الوظيفي</label><input type="text" className="w-full p-3 border border-slate-200 rounded-xl bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-right" value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})} /></div>
                    </div>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                        <p className="text-xs font-black text-indigo-600 mb-2 flex items-center gap-1"><Calculator size={14} /> تفاصيل الراتب والبدلات</p>
                        <div className="grid grid-cols-3 gap-4">
                            <div><label className="block text-[10px] font-black text-slate-500 mb-1">الراتب الأساسي</label><input type="number" className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-black text-center" value={newEmployee.basicSalary || ''} onChange={e => setNewEmployee({...newEmployee, basicSalary: Number(e.target.value)})} placeholder="0.00" /></div>
                            <div><label className="block text-[10px] font-black text-slate-500 mb-1">بدل سكن</label><input type="number" className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-black text-center" value={newEmployee.housingAllowance || ''} onChange={e => setNewEmployee({...newEmployee, housingAllowance: Number(e.target.value)})} placeholder="0.00" /></div>
                            <div><label className="block text-[10px] font-black text-slate-500 mb-1">بدل مواصلات</label><input type="number" className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-black text-center" value={newEmployee.transportationAllowance || ''} onChange={e => setNewEmployee({...newEmployee, transportationAllowance: Number(e.target.value)})} placeholder="0.00" /></div>
                        </div>
                        <div className="flex justify-between items-center bg-indigo-600 text-white p-4 rounded-xl shadow-lg shadow-indigo-100">
                            <span className="font-black text-sm">إجمالي الراتب (يحتسب تلقائياً):</span>
                            <div className="text-left">
                                <span className="text-2xl font-black font-mono">{totalCalculatedSalary.toLocaleString()}</span>
                                <span className="text-xs mr-1">ر.س</span>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-black text-blue-600 mb-1.5 mr-1">ساعات العمل اليومية</label><input type="number" className="w-full p-3 border border-blue-100 rounded-xl bg-blue-50/20 text-blue-800 outline-none focus:ring-2 focus:ring-blue-500 font-black text-center" value={newEmployee.dailyHours || ''} onChange={e => setNewEmployee({...newEmployee, dailyHours: Number(e.target.value)})} placeholder="10" /></div>
                        <div><label className="block text-xs font-black text-slate-500 mb-1.5 mr-1">طريقة الصرف</label>
                            <select className="w-full p-3 border border-slate-200 rounded-xl bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-bold" value={newEmployee.paymentMethod} onChange={e => setNewEmployee({...newEmployee, paymentMethod: e.target.value as any})}>
                                <option value="transfer">حوالة بنكية</option>
                                <option value="cash">نقدي (كاش)</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-3 mt-8">
                        <button onClick={() => setShowEmpModal(false)} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">إلغاء</button>
                        <button onClick={handleSaveEmployee} disabled={isLoading} className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex justify-center items-center gap-2">
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {editingEmpId ? 'حفظ التعديلات' : 'إضافة الموظف'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {isDeleteModalOpen && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-3xl shadow-2xl w-full max-sm p-8 text-center border border-red-100"><div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32} /></div><h3 className="text-xl font-black text-slate-800 mb-2">حذف الموظف؟</h3><p className="text-sm text-slate-500 mb-6 font-bold">أدخل كلمة المرور للتأكيد</p><input type="password" className="w-full p-3 border border-slate-200 rounded-xl text-center mb-6 font-mono text-lg focus:ring-4 focus:ring-red-50 outline-none transition-all" placeholder="****" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmDeleteEmployee()} /><div className="flex gap-3"><button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl transition-all">إلغاء</button><button onClick={confirmDeleteEmployee} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black shadow-lg shadow-red-100 hover:bg-red-700 transition-all">حذف نهائي</button></div></div></div>)}
    </div>
  );
};

export default Salaries;
