
import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Calendar, FileText, Banknote, X, Save, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import { PaperExpense } from '../types';
import DateFilter, { DateRange, getThisMonthRange } from '../components/DateFilter';
import { supabase } from '../services/supabaseClient';
import { logAction } from '../services/auditLogService';
import { useAuth } from '../context/AuthContext';

const PaperExpenses: React.FC = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<PaperExpense[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>(getThisMonthRange());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Deletion State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const fetchExpenses = async () => {
    try {
      setConnectionError(null);
      const { data, error } = await supabase.from('paperExpenses').select('*').order('date', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      if (data) setExpenses(data);
    } catch (err: any) {
      console.error('Supabase Connection Error:', err);
      if (err.message?.includes('does not exist') || err.code === '42P01') {
         setConnectionError('جدول "paperExpenses" غير موجود في قاعدة البيانات. يرجى إنشاؤه في Supabase.');
      } else {
         setConnectionError('حدث خطأ أثناء الاتصال بقاعدة البيانات. تحقق من الإنترنت أو الإعدادات.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
    const channel = supabase.channel('paper-expenses-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paperExpenses' }, fetchExpenses)
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, []);

  const initiateDelete = (id: string) => {
    setExpenseToDelete(id);
    setDeletePassword('');
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (deletePassword === '1234') {
      if (expenseToDelete) {
        const exp = expenses.find(e => e.id === expenseToDelete);
        if (exp) {
          await logAction(user, 'delete', 'مصاريف الورقة', `حذف مصروف: ${exp.description} بقيمة ${exp.amount}`);
        }
        await supabase.from('paperExpenses').delete().eq('id', expenseToDelete);
      }
      setIsDeleteModalOpen(false);
      setExpenseToDelete(null);
    } else {
      setDeleteError('كلمة المرور غير صحيحة');
    }
  };

  const filteredExpenses = expenses.filter(exp => {
      const matchesSearch = exp.description.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesDate = true;
      if (dateRange.start && dateRange.end) {
          const expDate = new Date(exp.date);
          matchesDate = expDate >= dateRange.start && expDate <= dateRange.end;
      }
      return matchesSearch && matchesDate;
  });
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-indigo-600" />
                مصاريف الورقة
            </h2>
            <p className="text-slate-500 text-sm mt-1">سجل المصروفات اليومية المتنوعة</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} />
          <span>إضافة مصروف جديد</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث في المصروفات..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-600 placeholder:text-slate-400"
            />
          </div>
          <DateFilter onFilterChange={setDateRange} />
        </div>
        <table className="w-full text-right">
            <thead className="bg-slate-50 text-slate-500 text-sm">
              <tr>
                <th className="p-4 font-medium">التاريخ</th>
                <th className="p-4 font-medium">الوصف / البند</th>
                <th className="p-4 font-medium">المبلغ</th>
                <th className="p-4 font-medium">ملاحظات</th>
                <th className="p-4 font-medium text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-700 flex items-center gap-2">
                      <Calendar size={16} className="text-slate-400" />
                      {exp.date}
                  </td>
                  <td className="p-4 text-slate-800 font-medium">{exp.description}</td>
                  <td className="p-4 font-bold text-red-600">
                    {exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-slate-500 text-sm max-w-xs truncate">{exp.notes || '-'}</td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => initiateDelete(exp.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="حذف"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">لا توجد مصروفات مسجلة</td>
                </tr>
              )}
            </tbody>
          </table>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><AlertTriangle size={24} /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">تأكيد حذف المصروف</h3>
              <p className="text-slate-500 text-sm mb-6">هل أنت متأكد من حذف هذا المصروف؟ لا يمكن التراجع عن هذا الإجراء.</p>
              <div className="mb-4 text-right">
                <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور</label>
                <input 
                  type="password" 
                  className={`w-full p-2 border rounded-lg text-center font-mono outline-none bg-white text-slate-600 ${deleteError ? 'border-red-500 bg-red-50' : 'border-slate-300 focus:border-indigo-500'}`} 
                  placeholder="****" 
                  autoFocus 
                  value={deletePassword} 
                  onChange={(e) => setDeletePassword(e.target.value)} 
                />
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

export default PaperExpenses;
