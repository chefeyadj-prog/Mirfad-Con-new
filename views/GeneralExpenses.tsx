
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Trash2, Calendar, PieChart, Banknote, X, Save, AlertCircle, Loader2, Filter, AlertTriangle, Edit, Lock, CheckCircle2 } from 'lucide-react';
import { GeneralExpense } from '../types';
import DateFilter, { DateRange, getThisMonthRange } from '../components/DateFilter';
import { supabase } from '../services/supabaseClient';
import StatCard from '../components/StatCard';
import { logAction } from '../services/auditLogService';
import { useAuth } from '../context/AuthContext';
import { round } from '../utils/mathUtils';

const EXPENSE_CATEGORIES = [
    { id: 'rent', label: 'الإيجار', color: 'bg-purple-100 text-purple-700' },
    { id: 'electricity', label: 'الكهرباء والمياه', color: 'bg-yellow-100 text-yellow-700' },
    { id: 'maintenance', label: 'الصيانة', color: 'bg-blue-100 text-blue-700' },
    { id: 'marketing', label: 'التسويق والدعاية', color: 'bg-pink-100 text-pink-700' },
    { id: 'gov_fees', label: 'رسوم حكومية', color: 'bg-green-100 text-green-700' },
    { id: 'flight_tickets', label: 'تذاكر طيران', color: 'bg-sky-100 text-sky-700' },
    { id: 'other', label: 'مصاريف أخرى', color: 'bg-slate-100 text-slate-700' },
];

const GeneralExpenses: React.FC = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<GeneralExpense[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>(getThisMonthRange());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Create/Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newExpense, setNewExpense] = useState({ 
    category: 'other' as GeneralExpense['category'], 
    description: '', 
    amount: 0, 
    taxAmount: 0, 
    date: new Date().toISOString().split('T')[0], 
    paymentMethod: 'transfer' as 'cash' | 'transfer', 
    notes: '' 
  });
  
  // Auth state for Editing
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [tempExpenseToEdit, setTempExpenseToEdit] = useState<GeneralExpense | null>(null);

  // Deletion state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Sorting State
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  const fetchExpenses = async () => {
    try {
      setConnectionError(null);
      const { data, error } = await supabase.from('general_expenses').select('*').order('date', { ascending: false });
      
      if (error) throw error;
      if (data) setExpenses(data);
    } catch (err: any) {
      console.error('Supabase Error:', err);
      setConnectionError('يرجى التأكد من إنشاء جدول "general_expenses" في قاعدة البيانات.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
    const channel = supabase.channel('general-expenses-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'general_expenses' }, fetchExpenses)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
    } else {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      }
    }
  };

  const renderSortIcon = (key: string) => {
    if (sortKey !== key) return '⇅';
    if (sortDirection === 'asc') return '↑';
    if (sortDirection === 'desc') return '↓';
    return '⇅';
  };

  const handleSaveExpense = async () => {
      if (!newExpense.description || !newExpense.amount) return;

      const expenseData: any = {
          date: newExpense.date,
          category: newExpense.category,
          description: newExpense.description,
          amount: Number(newExpense.amount),
          taxAmount: Number(newExpense.taxAmount) || 0,
          paymentMethod: newExpense.paymentMethod,
          notes: newExpense.notes,
      };

      if (editingId) {
          const { error } = await supabase.from('general_expenses').update(expenseData).eq('id', editingId);
          if (!error) {
              await logAction(user, 'update', 'المصاريف العامة', `تعديل مصروف: ${expenseData.description} بمبلغ ${expenseData.amount}`);
              setIsModalOpen(false);
              setEditingId(null);
              fetchExpenses();
          } else {
              alert('حدث خطأ أثناء التحديث: ' + error.message);
          }
      } else {
          expenseData.id = `G-EXP-${Date.now()}`;
          expenseData.createdAt = new Date().toISOString();
          const { error } = await supabase.from('general_expenses').insert(expenseData);
          if (!error) {
              await logAction(user, 'create', 'المصاريف العامة', `إضافة مصروف جديد (${getCategoryLabel(expenseData.category)}) - ${expenseData.description} بمبلغ ${expenseData.amount}`);
              setIsModalOpen(false);
              fetchExpenses();
          } else {
              alert('حدث خطأ أثناء الحفظ: ' + error.message);
          }
      }
      
      // Reset form
      setNewExpense({ category: 'other', description: '', amount: 0, taxAmount: 0, date: new Date().toISOString().split('T')[0], paymentMethod: 'transfer', notes: '' });
  };

  const initiateEdit = (expense: GeneralExpense) => {
      setTempExpenseToEdit(expense);
      setAuthPassword('');
      setAuthError('');
      setIsAuthModalOpen(true);
  };

  const verifyAndEdit = () => {
      if (authPassword === '1234') {
          if (tempExpenseToEdit) {
              setEditingId(tempExpenseToEdit.id);
              setNewExpense({
                  category: tempExpenseToEdit.category,
                  description: tempExpenseToEdit.description,
                  amount: tempExpenseToEdit.amount,
                  taxAmount: tempExpenseToEdit.taxAmount || 0,
                  date: tempExpenseToEdit.date,
                  paymentMethod: tempExpenseToEdit.paymentMethod,
                  notes: tempExpenseToEdit.notes || ''
              });
              setIsModalOpen(true);
          }
          setIsAuthModalOpen(false);
      } else {
          setAuthError('كلمة المرور غير صحيحة');
      }
  };

  const initiateDelete = (id: string) => {
      setExpenseToDelete(id);
      setDeletePassword('');
      setDeleteError('');
      setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
      if (deletePassword === '1234') {
          if (expenseToDelete) {
              const expense = expenses.find(e => e.id === expenseToDelete);
              if (expense) {
                  await logAction(user, 'delete', 'المصاريف العامة', `حذف مصروف ${expense.description} بمبلغ ${expense.amount}`);
              }
              
              const { error } = await supabase.from('general_expenses').delete().eq('id', expenseToDelete);
              
              if (error) {
                  alert('فشل حذف المصروف: ' + error.message);
              } else {
                  setExpenses(current => current.filter(e => e.id !== expenseToDelete));
              }
          }
          setIsDeleteModalOpen(false);
          setExpenseToDelete(null);
      } else {
          setDeleteError('كلمة المرور غير صحيحة');
      }
  };

  const filteredExpenses = useMemo(() => {
      let result = expenses.filter(exp => {
          const matchesSearch = exp.description.toLowerCase().includes(searchTerm.toLowerCase());
          let matchesDate = true;
          if (dateRange.start && dateRange.end) {
              const expDate = new Date(exp.date);
              matchesDate = expDate >= dateRange.start && expDate <= dateRange.end;
          }
          return matchesSearch && matchesDate;
      });

      if (sortKey && sortDirection) {
          result = [...result].sort((a: any, b: any) => {
              let valA, valB;
              if (sortKey === 'total') {
                  valA = a.amount + (a.taxAmount || 0);
                  valB = b.amount + (b.taxAmount || 0);
              } else {
                  valA = a[sortKey];
                  valB = b[sortKey];
              }

              if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
              if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
              return 0;
          });
      }

      return result;
  }, [expenses, searchTerm, dateRange, sortKey, sortDirection]);

  const totals = useMemo(() => {
      return filteredExpenses.reduce((acc, exp) => {
          return {
              amount: acc.amount + exp.amount,
              tax: acc.tax + (exp.taxAmount || 0),
              total: acc.total + (exp.amount + (exp.taxAmount || 0))
          };
      }, { amount: 0, tax: 0, total: 0 });
  }, [filteredExpenses]);
  
  const getCategoryLabel = (id: string) => EXPENSE_CATEGORIES.find(c => c.id === id)?.label || id;
  const getCategoryColor = (id: string) => EXPENSE_CATEGORIES.find(c => c.id === id)?.color || 'bg-gray-100 text-gray-700';

  const formatCurrency = (amount: number) => amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 text-right">
                <PieChart className="text-indigo-600" />
                المصاريف العامة والتشغيلية
            </h2>
            <p className="text-slate-500 text-sm mt-1 text-right">إيجارات، كهرباء، صيانة، ورسوم حكومية</p>
        </div>
        <button 
          onClick={() => { setEditingId(null); setNewExpense({ category: 'other', description: '', amount: 0, taxAmount: 0, date: new Date().toISOString().split('T')[0], paymentMethod: 'transfer', notes: '' }); setIsModalOpen(true); }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} />
          <span>تسجيل مصروف جديد</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 text-slate-400" size={18} />
            <input type="text" placeholder="بحث في المصاريف..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-4 pr-10 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-600 text-center" dir="rtl" />
          </div>
          <DateFilter onFilterChange={setDateRange} />
        </div>
        
        {isLoading ? (
          <div className="p-12 flex justify-center items-center text-slate-500 gap-2"><Loader2 className="animate-spin" size={24} /><span>جاري التحميل...</span></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center">
              <thead className="bg-slate-50 text-slate-500 text-sm">
                <tr>
                  <th onClick={() => handleSort('date')} className="p-4 font-bold text-center cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap">
                    التاريخ {renderSortIcon('date')}
                  </th>
                  <th onClick={() => handleSort('category')} className="p-4 font-bold text-center cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap">
                    التصنيف {renderSortIcon('category')}
                  </th>
                  <th onClick={() => handleSort('description')} className="p-4 font-bold text-center cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap">
                    البند / الوصف {renderSortIcon('description')}
                  </th>
                  <th onClick={() => handleSort('paymentMethod')} className="p-4 font-bold text-center cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap">
                    طريقة الدفع {renderSortIcon('paymentMethod')}
                  </th>
                  <th onClick={() => handleSort('amount')} className="p-4 font-bold text-center cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap">
                    المبلغ {renderSortIcon('amount')}
                  </th>
                  <th onClick={() => handleSort('taxAmount')} className="p-4 font-bold text-center text-blue-700 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap">
                    الضريبة {renderSortIcon('taxAmount')}
                  </th>
                  <th onClick={() => handleSort('total')} className="p-4 font-bold text-center cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap">
                    الإجمالي {renderSortIcon('total')}
                  </th>
                  <th className="p-4 font-bold text-center whitespace-nowrap">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-700 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Calendar size={16} className="text-slate-400" />
                          {exp.date}
                        </div>
                    </td>
                    <td className="p-4 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${getCategoryColor(exp.category)}`}>{getCategoryLabel(exp.category)}</span></td>
                    <td className="p-4 text-slate-800 font-medium text-center">{exp.description}<div className="text-xs text-slate-400 font-normal">{exp.notes}</div></td>
                    <td className="p-4 text-slate-600 text-sm text-center">{exp.paymentMethod === 'cash' ? 'نقدي' : 'حوالة بنكية'}</td>
                    <td className="p-4 font-bold text-slate-800 text-center font-mono">{formatCurrency(exp.amount)}</td>
                    <td className="p-4 text-blue-700 font-mono text-sm text-center font-bold">{formatCurrency(exp.taxAmount || 0)}</td>
                    <td className="p-4 font-bold text-slate-900 text-center font-mono">{formatCurrency(exp.amount + (exp.taxAmount || 0))}</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                          <button 
                              onClick={() => initiateEdit(exp)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="تعديل"
                          >
                              <Edit size={18} />
                          </button>
                          <button onClick={() => initiateDelete(exp.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="حذف">
                              <Trash2 size={18} />
                          </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr className="font-black text-slate-800">
                      <td colSpan={4} className="p-4 text-center text-lg">إجمالي الصفحة</td>
                      <td className="p-4 text-center font-mono text-red-700">{formatCurrency(totals.amount)}</td>
                      <td className="p-4 text-center font-mono text-blue-700">{formatCurrency(totals.tax)}</td>
                      <td className="p-4 text-center font-mono text-indigo-700 text-lg bg-indigo-50/50">{formatCurrency(totals.total)}</td>
                      <td></td>
                  </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Auth Modal for Editing */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Lock size={18} className="text-slate-500" />
                تأكيد الصلاحية للتعديل
              </h3>
              <button onClick={() => setIsAuthModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-4 text-center">لتعديل هذا المصروف، يرجى إدخال رمز المرور.</p>
              <input 
                type="password" 
                autoFocus
                className={`w-full p-3 border rounded-lg text-center font-mono text-lg outline-none mb-2 ${authError ? 'border-red-500 bg-red-50' : 'border-slate-300 focus:border-indigo-500'}`}
                placeholder="****"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && verifyAndEdit()}
              />
              {authError && <p className="text-xs text-red-500 text-center mb-4">{authError}</p>}
              <button onClick={verifyAndEdit} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors">تحقق ومتابعة</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">{editingId ? 'تعديل المصروف' : 'تسجيل مصروف جديد'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">التاريخ</label>
                    <input type="date" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">التصنيف</label>
                    <select value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value as any})} className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                      {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">الوصف / البند</label>
                  <input type="text" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} placeholder="مثال: فاتورة كهرباء شهر يوليو" className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-right" dir="rtl" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">المبلغ (قبل الضريبة)</label>
                    <input type="number" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: Number(e.target.value)})} className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-center font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1 text-blue-700">قيمة الضريبة (15%)</label>
                    <input type="number" value={newExpense.taxAmount} onChange={e => setNewExpense({...newExpense, taxAmount: Number(e.target.value)})} className="w-full p-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono" />
                  </div>
               </div>
               <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex justify-between items-center">
                  <span className="font-bold text-indigo-700 text-sm">الإجمالي الكلي:</span>
                  <span className="text-xl font-black text-indigo-800 font-mono">{(Number(newExpense.amount) + Number(newExpense.taxAmount)).toLocaleString()} ر.س</span>
               </div>
               <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">طريقة الدفع</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setNewExpense({...newExpense, paymentMethod: 'transfer'})} className={`py-2 rounded-lg border-2 font-bold transition-all text-sm ${newExpense.paymentMethod === 'transfer' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}>حوالة بنكية</button>
                        <button onClick={() => setNewExpense({...newExpense, paymentMethod: 'cash'})} className={`py-2 rounded-lg border-2 font-bold transition-all text-sm ${newExpense.paymentMethod === 'cash' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}>نقدي (كاش)</button>
                    </div>
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                  <textarea value={newExpense.notes} onChange={e => setNewExpense({...newExpense, notes: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-right h-20" dir="rtl"></textarea>
               </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
               <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-bold">إلغاء</button>
               <button onClick={handleSaveExpense} className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 flex items-center gap-2"><Save size={18} /><span>{editingId ? 'حفظ التغييرات' : 'تسجيل المصروف'}</span></button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><AlertTriangle size={24} /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">تأكيد حذف المصروف</h3>
              <p className="text-slate-500 text-sm mb-6">هل أنت متأكد من حذف هذا المصروف نهائياً؟ لا يمكن التراجع عن هذا الإجراء.</p>
              <div className="mb-4 text-right">
                <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور</label>
                <input type="password" className={`w-full p-2 border rounded-lg text-center font-mono outline-none bg-white text-slate-600 ${deleteError ? 'border-red-500 bg-red-50' : 'border-slate-300 focus:border-indigo-500'}`} placeholder="****" autoFocus value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmDelete()} />
                {deleteError && <p className="text-xs text-red-500 mt-1">{deleteError}</p>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors">إلغاء</button>
                <button onClick={confirmDelete} className="flex-1 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg font-bold shadow-lg shadow-red-200 transition-colors">حذف نهائي</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralExpenses;
