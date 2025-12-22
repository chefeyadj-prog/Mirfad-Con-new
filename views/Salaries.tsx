
import React, { useState, useEffect, useRef } from 'react';
import { User, Banknote, Calendar, Plus, Utensils, AlertCircle, Wallet, Trash2, Users, X, AlertTriangle, Hash, Gift, Check, Search, Edit, Save, CheckCircle } from 'lucide-react';
import { Employee, SalaryTransaction, SalaryTransactionType } from '../types';
import { supabase } from '../services/supabaseClient';
import StatCard from '../components/StatCard';
import { logAction } from '../services/auditLogService';
import { useAuth } from '../context/AuthContext';

type TabType = 'payroll' | 'employees' | 'loans' | 'deductions' | 'meals' | 'shortages' | 'bonuses';

const Salaries: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('payroll');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<SalaryTransaction[]>([]);

  const fetchData = async () => {
    const { data: empData } = await supabase.from('employees').select('*');
    if (empData) setEmployees(empData);
    
    const { data: trxData } = await supabase.from('salaryTransactions').select('*');
    if (trxData) setTransactions(trxData);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('salaries-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'salaryTransactions' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({ name: '', role: '', salary: 0, phone: '', code: '' });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [empToDelete, setEmpToDelete] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const [newTransaction, setNewTransaction] = useState<{ employeeId: string; amount: string; date: string; notes: string; }>({
    employeeId: '', amount: '', date: new Date().toISOString().split('T')[0], notes: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) setShowSearchDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openAddEmployeeModal = () => {
      setEditingEmpId(null);
      setNewEmployee({ name: '', role: '', salary: 0, phone: '', code: '' });
      setShowEmpModal(true);
  };

  const openEditEmployeeModal = (emp: Employee) => {
      setEditingEmpId(emp.id);
      setNewEmployee({ name: emp.name, role: emp.role, salary: emp.salary, phone: emp.phone || '', code: emp.code || '' });
      setShowEmpModal(true);
  };

  const handleSaveEmployee = async () => {
    if (!newEmployee.name || !newEmployee.salary) return;
    if (editingEmpId) {
        await supabase.from('employees').update({
            name: newEmployee.name,
            role: newEmployee.role,
            salary: Number(newEmployee.salary),
            phone: newEmployee.phone,
            code: newEmployee.code
        }).eq('id', editingEmpId);
        await logAction(user, 'update', 'الموظفين', `تعديل بيانات الموظف ${newEmployee.name}`);
    } else {
        const emp: Employee = {
            id: `EMP-${Date.now()}`,
            code: newEmployee.code || String(Math.floor(1000 + Math.random() * 9000)),
            name: newEmployee.name!,
            role: newEmployee.role || 'موظف',
            salary: Number(newEmployee.salary),
            phone: newEmployee.phone,
            joinDate: new Date().toISOString().split('T')[0]
        };
        await supabase.from('employees').insert(emp);
        await logAction(user, 'create', 'الموظفين', `إضافة موظف جديد: ${newEmployee.name}`);
    }
    setShowEmpModal(false);
    setNewEmployee({ name: '', role: '', salary: 0, phone: '', code: '' });
    setEditingEmpId(null);
  };

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
              if (emp) {
                  await logAction(user, 'delete', 'الموظفين', `حذف الموظف ${emp.name}`);
              }
              await supabase.from('employees').delete().eq('id', empToDelete);
          }
          setIsDeleteModalOpen(false);
          setEmpToDelete(null);
      } else {
          setDeleteError('كلمة المرور غير صحيحة');
      }
  };

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
      if (trx) {
          await logAction(user, 'delete', 'الرواتب', `حذف ${trx.type} بقيمة ${trx.amount}`);
      }
      await supabase.from('salaryTransactions').delete().eq('id', id);
  };

  const handleSelectEmployee = (emp: Employee) => {
      setNewTransaction({...newTransaction, employeeId: emp.id});
      setSearchTerm(`${emp.name} ${emp.code ? `(${emp.code})` : ''}`);
      setShowSearchDropdown(false);
  };

  const filteredEmployees = employees.filter(emp => emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || (emp.code && emp.code.toLowerCase().includes(searchTerm.toLowerCase())));
  const currentMonthNum = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const calculateEmployeeStats = (empId: string) => {
    const empTrx = transactions.filter(t => {
        const d = new Date(t.date);
        return t.employeeId === empId && (d.getMonth() + 1) === currentMonthNum && d.getFullYear() === currentYear;
    });
    const loans = empTrx.filter(t => t.type === 'loan').reduce((sum, t) => sum + t.amount, 0);
    const deductions = empTrx.filter(t => t.type === 'deduction').reduce((sum, t) => sum + t.amount, 0);
    const meals = empTrx.filter(t => t.type === 'meal').reduce((sum, t) => sum + t.amount, 0);
    const shortages = empTrx.filter(t => t.type === 'shortage').reduce((sum, t) => sum + t.amount, 0);
    const bonuses = empTrx.filter(t => t.type === 'bonus').reduce((sum, t) => sum + t.amount, 0);
    const isPaid = empTrx.some(t => t.type === 'salary_payment');
    const totalDeductions = loans + deductions + meals + shortages;
    return { loans, deductions, meals, shortages, bonuses, totalDeductions, isPaid };
  };

  const handlePaySalary = async (emp: Employee, netSalary: number) => {
    if (window.confirm(`هل أنت متأكد من اعتماد وصرف راتب الموظف: ${emp.name}؟\nصافي المبلغ المستحق: ${netSalary.toLocaleString()}`)) {
      const trx: SalaryTransaction = {
        id: `PAY-${Date.now()}`,
        employeeId: emp.id,
        date: new Date().toISOString().split('T')[0],
        amount: netSalary,
        type: 'salary_payment',
        notes: `راتب شهر ${currentMonthNum}`
      };
      await supabase.from('salaryTransactions').insert(trx);
      await logAction(user, 'create', 'الرواتب', `صرف راتب شهر ${currentMonthNum} للموظف ${emp.name} بمبلغ ${netSalary}`);
    }
  };

  const getStatCardColor = (type: SalaryTransactionType): 'blue' | 'green' | 'red' | 'orange' => {
      switch (type) {
          case 'loan': return 'orange';
          case 'deduction': return 'red';
          case 'meal': return 'blue';
          case 'shortage': return 'red';
          case 'bonus': return 'green';
          default: return 'blue';
      }
  };

  const renderTransactionForm = (type: SalaryTransactionType, title: string, icon: React.ElementType, colorClass: string) => {
    const currentTransactions = transactions.filter(t => t.type === type);
    const totalAmount = currentTransactions.reduce((sum, t) => sum + t.amount, 0);
    const StatIcon = icon as any;

    return (
      <div className="space-y-6">
        {/* Total Stat Card */}
        <div className="grid grid-cols-1 md:grid-cols-3">
             <StatCard 
                title={`إجمالي ${title}`} 
                value={totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                icon={StatIcon}
                color={getStatCardColor(type)}
                trend="لجميع الموظفين"
             />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit">
              <h3 className={`font-bold mb-4 flex items-center gap-2 ${colorClass}`}>
                {React.createElement(icon, { size: 20 })}
                تسجيل {title} جديد
              </h3>
              <div className="space-y-4">
                <div className="relative" ref={searchWrapperRef}>
                    <label className="block text-sm font-medium text-slate-600 mb-1">الموظف</label>
                    <div className="relative">
                        <input type="text" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 pl-8" placeholder="بحث بالاسم أو الرقم الوظيفي..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setNewTransaction({...newTransaction, employeeId: ''}); setShowSearchDropdown(true); }} onFocus={() => setShowSearchDropdown(true)} />
                        <Search size={16} className="absolute left-2 top-3 text-slate-400" />
                        {newTransaction.employeeId && <Check size={16} className="absolute right-2 top-3 text-green-500" />}
                    </div>
                    {showSearchDropdown && (
                        <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                            {filteredEmployees.map(emp => (
                                    <div key={emp.id} onClick={() => handleSelectEmployee(emp)} className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center">
                                        <div><p className="font-medium text-slate-700 text-sm">{emp.name}</p></div>
                                        {emp.code && <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded font-mono">#{emp.code}</span>}
                                    </div>
                            ))}
                        </div>
                    )}
                </div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">المبلغ</label><input type="number" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-300" placeholder="0.00" value={newTransaction.amount} onChange={e => setNewTransaction({...newTransaction, amount: e.target.value})} /></div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">التاريخ</label><input type="date" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500" value={newTransaction.date} onChange={e => setNewTransaction({...newTransaction, date: e.target.value})} /></div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">ملاحظات / السبب</label><textarea className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-300" rows={3} value={newTransaction.notes} onChange={e => setNewTransaction({...newTransaction, notes: e.target.value})}></textarea></div>
                <button onClick={() => handleAddTransaction(type)} disabled={!newTransaction.employeeId} className={`w-full py-2 rounded-lg transition-colors font-medium flex justify-center items-center gap-2 ${newTransaction.employeeId ? 'bg-slate-800 text-white hover:bg-slate-900' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}><Plus size={18} /> حفظ</button>
              </div>
          </div>
          <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center"><h3 className="font-bold text-slate-700">سجل {title} (الشهر الحالي)</h3></div>
              <table className="w-full text-right"><thead className="bg-slate-50 text-slate-500 text-sm"><tr><th className="p-4">التاريخ</th><th className="p-4">الموظف</th><th className="p-4">المبلغ</th><th className="p-4">ملاحظات</th><th className="p-4 text-center">إجراء</th></tr></thead><tbody className="divide-y divide-slate-100">{transactions.filter(t => t.type === type).map(t => { const emp = employees.find(e => e.id === t.employeeId); return (<tr key={t.id} className="hover:bg-slate-50"><td className="p-4 font-mono text-slate-600 text-sm">{t.date}</td><td className="p-4 font-medium text-slate-800">{emp ? emp.name : '-'}</td><td className={`p-4 font-bold ${colorClass.split(' ')[0]}`}>{t.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="p-4 text-slate-500 text-sm">{t.notes}</td><td className="p-4 text-center"><button onClick={() => handleDeleteTransaction(t.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button></td></tr>)})}</tbody></table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-6">
         <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold text-slate-800">إدارة الرواتب وشؤون الموظفين</h2></div>
         <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
             {[ { id: 'payroll', label: 'مسير الرواتب', icon: Banknote }, { id: 'employees', label: 'الموظفين', icon: Users }, { id: 'loans', label: 'السلف', icon: Wallet }, { id: 'deductions', label: 'الخصومات', icon: AlertCircle }, { id: 'meals', label: 'الوجبات', icon: Utensils }, { id: 'shortages', label: 'العجوزات', icon: AlertTriangle }, { id: 'bonuses', label: 'المكافآت', icon: Gift } ].map((tab) => (
                 <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`px-4 py-2 rounded-t-lg flex items-center gap-2 transition-all font-medium ${activeTab === tab.id ? 'bg-white text-indigo-600 border-x border-t border-slate-200 shadow-sm relative top-px' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}><tab.icon size={18} /><span>{tab.label}</span></button>
             ))}
         </div>
      </div>
      <div className="mt-4">
          {activeTab === 'payroll' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right min-w-[900px]">
                      <thead className="bg-white text-slate-500 text-sm border-b border-slate-100">
                        <tr>
                          <th className="p-4">الموظف</th>
                          <th className="p-4">الراتب الأساسي</th>
                          <th className="p-4 text-orange-600">السلف</th>
                          <th className="p-4 text-red-600">الخصومات</th>
                          <th className="p-4 text-blue-600">الوجبات</th>
                          <th className="p-4 text-purple-600">العجوزات</th>
                          <th className="p-4 text-green-600">مكافآت</th>
                          <th className="p-4 bg-slate-50">صافي الراتب</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {employees.map((emp) => { 
                          const stats = calculateEmployeeStats(emp.id); 
                          const netSalary = emp.salary - stats.totalDeductions + stats.bonuses; 
                          return (
                            <tr key={emp.id} className="hover:bg-slate-50">
                              <td className="p-4 font-medium text-slate-800">{emp.name}</td>
                              <td className="p-4 font-bold text-slate-700">{emp.salary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="p-4 text-orange-600">{stats.loans > 0 ? stats.loans.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                              <td className="p-4 text-red-600">{stats.deductions > 0 ? stats.deductions.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                              <td className="p-4 text-blue-600">{stats.meals > 0 ? stats.meals.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                              <td className="p-4 text-purple-600">{stats.shortages > 0 ? stats.shortages.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                              <td className="p-4 text-green-600">{stats.bonuses > 0 ? stats.bonuses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                              <td className="p-4 font-bold text-indigo-700 bg-slate-50 text-lg border-x border-slate-100">{netSalary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                </div>
              </div>
          )}
          {activeTab === 'employees' && (
              <div className="space-y-6">
                 <div className="flex justify-end"><button onClick={openAddEmployeeModal} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow flex items-center gap-2"><Plus size={18} /> إضافة موظف جديد</button></div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{employees.map(emp => (<div key={emp.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start gap-4 relative group hover:shadow-md transition-shadow">{emp.code && (<div className="absolute top-2 left-2 bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded font-mono">#{emp.code}</div>)}<div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => openEditEmployeeModal(emp)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={16} /></button><button onClick={() => initiateDeleteEmployee(emp.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button></div><div className="p-3 bg-slate-100 rounded-full text-slate-500 mt-2"><User size={24} /></div><div className="flex-1 mt-2"><h3 className="font-bold text-lg text-slate-800">{emp.name}</h3><p className="text-slate-500 text-sm mb-2">{emp.role}</p><div className="space-y-1 text-sm text-slate-600"><div className="flex justify-between"><span>الراتب الأساسي:</span><span className="font-bold">{emp.salary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div><div className="flex justify-between"><span>رقم الهاتف:</span><span className="font-mono">{emp.phone || '-'}</span></div></div></div></div>))}</div>
                 {showEmpModal && (<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"><div className="space-y-4"><div><label className="block text-sm font-medium mb-1 text-slate-600">الرقم الوظيفي</label><input type="text" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-600 outline-none" value={newEmployee.code} onChange={e => setNewEmployee({...newEmployee, code: e.target.value})} /></div><div><label className="block text-sm font-medium mb-1 text-slate-600">الاسم</label><input type="text" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-600 outline-none" value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} /></div><div><label className="block text-sm font-medium mb-1 text-slate-600">المسمى</label><input type="text" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-600 outline-none" value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})} /></div><div><label className="block text-sm font-medium mb-1 text-slate-600">الراتب</label><input type="number" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-600 outline-none" value={newEmployee.salary} onChange={e => setNewEmployee({...newEmployee, salary: Number(e.target.value)})} /></div><button onClick={handleSaveEmployee} className="w-full py-2 bg-indigo-600 text-white rounded-lg mt-2">{editingEmpId ? 'حفظ التعديلات' : 'حفظ الموظف'}</button></div></div></div>)}
                 {isDeleteModalOpen && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center"><h3 className="text-xl font-bold mb-2">تأكيد حذف الموظف</h3><input type="password" className="w-full p-2 border rounded-lg text-center mb-4" placeholder="****" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} /><div className="flex gap-3"><button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 bg-slate-100 rounded-lg">إلغاء</button><button onClick={confirmDeleteEmployee} className="flex-1 py-2 bg-red-600 text-white rounded-lg">حذف</button></div></div></div>)}
              </div>
          )}
          {activeTab === 'loans' && renderTransactionForm('loan', 'سلفة / قرض', Wallet, 'text-orange-600')}
          {activeTab === 'deductions' && renderTransactionForm('deduction', 'خصم إداري', AlertCircle, 'text-red-600')}
          {activeTab === 'meals' && renderTransactionForm('meal', 'وجبة', Utensils, 'text-blue-600')}
          {activeTab === 'shortages' && renderTransactionForm('shortage', 'عجز صندوق', AlertTriangle, 'text-purple-600')}
          {activeTab === 'bonuses' && renderTransactionForm('bonus', 'مكافأة / حافز', Gift, 'text-green-600')}
      </div>
    </div>
  );
};

export default Salaries;
