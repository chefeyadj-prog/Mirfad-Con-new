
import React, { useState, useEffect } from 'react';
import { Server, ArrowRight, CreditCard, Calendar, TrendingUp, Plus, Trash2, X, Save, Lock, AlertTriangle, Loader2 } from 'lucide-react';
import DateFilter, { DateRange } from '../components/DateFilter';
import { supabase } from '../services/supabaseClient';
import { DailyClosing } from '../types';
import { useAuth } from '../context/AuthContext';
import { logAction } from '../services/auditLogService';

const DEFAULT_TERMINAL_IDS = [
  '63427603', '63427604', '63427605', '64873724', '64873994', '64102585'
];

const Terminals: React.FC = () => {
  const { user } = useAuth();
  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const [registeredTerminals, setRegisteredTerminals] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({ label: 'الكل', start: null, end: null });
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTerminalId, setNewTerminalId] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [terminalToDelete, setTerminalToDelete] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch Data
  const fetchRegisteredTerminals = async () => {
    const { data, error } = await supabase.from('pos_terminals').select('terminal_id');
    if (data && data.length > 0) {
      setRegisteredTerminals(data.map(t => t.terminal_id));
    } else {
      setRegisteredTerminals(DEFAULT_TERMINAL_IDS);
    }
  };

  const fetchClosings = async () => {
    const { data } = await supabase.from('dailyClosings').select('*').order('date', { ascending: false });
    if (data) setClosings(data);
  };

  useEffect(() => {
    fetchRegisteredTerminals();
    fetchClosings();
    
    const channel = supabase.channel('terminals-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_terminals' }, fetchRegisteredTerminals)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dailyClosings' }, fetchClosings)
        .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAddTerminal = async () => {
    if (!newTerminalId.trim()) return;
    setIsLoading(true);
    
    const { error } = await supabase.from('pos_terminals').insert([{ terminal_id: newTerminalId.trim() }]);
    
    if (!error) {
        await logAction(user, 'create', 'أجهزة الشبكة', `إضافة جهاز شبكة جديد برقم: ${newTerminalId}`);
        setIsAddModalOpen(false);
        setNewTerminalId('');
        fetchRegisteredTerminals();
    } else {
        alert("خطأ: قد يكون الجهاز مضافاً مسبقاً");
    }
    setIsLoading(false);
  };

  const confirmDeleteTerminal = async () => {
    if (deletePassword !== '1234') {
        setDeleteError('كلمة المرور غير صحيحة');
        return;
    }
    if (terminalToDelete) {
        await supabase.from('pos_terminals').delete().eq('terminal_id', terminalToDelete);
        await logAction(user, 'delete', 'أجهزة الشبكة', `حذف جهاز الشبكة رقم: ${terminalToDelete}`);
        setIsDeleteModalOpen(false);
        setTerminalToDelete(null);
        fetchRegisteredTerminals();
    }
  };

  // Filter Closings based on Date
  const filteredClosings = closings.filter(c => {
      if (dateRange.start && dateRange.end) {
          const cDate = new Date(c.date);
          return cDate >= dateRange.start && cDate <= dateRange.end;
      }
      return true;
  });

  // Calculate Aggregates
  const terminalAggregates = registeredTerminals.map(id => {
      let mada = 0, visa = 0, master = 0, amex = 0, gcci = 0;
      filteredClosings.forEach(closing => {
          if (closing.details?.terminalDetails?.[id]) {
              const termData = closing.details.terminalDetails[id];
              mada += Number(termData.mada || 0);
              visa += Number(termData.visa || 0);
              master += Number(termData.master || 0);
              amex += Number(termData.amex || 0);
              gcci += Number(termData.gcci || 0);
          }
      });
      return { id, mada, visa, master, amex, gcci, total: mada + visa + master + amex + gcci };
  });

  const grandTotal = terminalAggregates.reduce((sum, t) => sum + t.total, 0);

  const getTerminalHistory = (termId: string) => {
      return filteredClosings.map(closing => {
          const details = closing.details?.terminalDetails?.[termId];
          if (!details) return null;
          const total = (Number(details.mada)||0) + (Number(details.visa)||0) + (Number(details.master)||0) + (Number(details.amex)||0) + (Number(details.gcci)||0);
          if (total === 0) return null;
          return { date: closing.date, ...details, total };
      }).filter(Boolean);
  };

  const renderSummaryView = () => (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Server className="text-indigo-600" size={28} />
             أجهزة الشبكة (POS Terminals)
           </h2>
           <p className="text-slate-500 text-sm mt-1">إدارة الأجهزة والتقارير المجمعة</p>
        </div>
        <div className="flex items-center gap-3">
             <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 px-4 py-2 rounded-lg flex items-center gap-2 hidden md:flex">
                <span className="text-sm">الإجمالي:</span>
                <span className="font-bold font-mono">{grandTotal.toLocaleString()} ر.س</span>
             </div>
             <DateFilter onFilterChange={setDateRange} />
             <button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-md transition-all"
             >
                <Plus size={18} />
                <span>إضافة جهاز</span>
             </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-center">
          <thead className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
            <tr>
              <th className="p-4 font-medium text-center">رقم الجهاز</th>
              <th className="p-4 font-medium text-center">مدى</th>
              <th className="p-4 font-medium text-center">فيزا</th>
              <th className="p-4 font-medium text-center">ماستر كارد</th>
              <th className="p-4 font-medium text-center">أمريكان</th>
              <th className="p-4 font-medium text-center">بطاقات الخليج</th>
              <th className="p-4 font-medium text-center">الإجمالي</th>
              <th className="p-4 font-medium text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {terminalAggregates.map((term) => (
              <tr key={term.id} className="hover:bg-slate-50 transition-colors group">
                <td className="p-4 font-bold text-slate-700 font-mono border-l border-slate-100 text-center">
                    <div className="flex items-center justify-center gap-2">
                        <span>{term.id}</span>
                        <button 
                            onClick={() => { setTerminalToDelete(term.id); setDeletePassword(''); setDeleteError(''); setIsDeleteModalOpen(true); }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="حذف الجهاز"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </td>
                <td className="p-4 text-slate-600 text-center">{term.mada.toLocaleString()}</td>
                <td className="p-4 text-slate-600 text-center">{term.visa.toLocaleString()}</td>
                <td className="p-4 text-slate-600 text-center">{term.master.toLocaleString()}</td>
                <td className="p-4 text-slate-600 text-center">{term.amex.toLocaleString()}</td>
                <td className="p-4 text-slate-600 text-center">{term.gcci.toLocaleString()}</td>
                <td className="p-4 font-bold text-indigo-600 text-center">{term.total.toLocaleString()}</td>
                <td className="p-4 text-center">
                    <button 
                        onClick={() => setSelectedTerminal(term.id)}
                        className="bg-indigo-50 text-indigo-600 p-2 rounded-full hover:bg-indigo-100 transition-colors"
                    >
                        <ArrowRight size={16} className="rotate-180" />
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderDetailView = () => {
      const history = getTerminalHistory(selectedTerminal!);
      const termTotal = history.reduce((sum, h: any) => sum + h.total, 0);

      return (
        <div className="animate-fade-in">
           <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-4">
                 <button onClick={() => setSelectedTerminal(null)} className="p-2 bg-white border border-slate-200 rounded-full text-slate-500 hover:bg-slate-50 transition-colors"><ArrowRight size={20} /></button>
                 <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><CreditCard className="text-blue-600" size={24} />تفاصيل الجهاز: <span className="font-mono text-blue-700">{selectedTerminal}</span></h2>
                    <p className="text-slate-500 text-sm mt-1">سجل العمليات اليومية لهذا الجهاز</p>
                 </div>
             </div>
             <div className="bg-blue-50 border border-blue-100 text-blue-800 px-6 py-3 rounded-xl flex items-center gap-3">
                 <div className="p-2 bg-blue-100 rounded-lg"><TrendingUp size={20} /></div>
                 <div><span className="block text-xs text-blue-500">إجمالي الفترة</span><span className="font-bold font-mono text-xl">{termTotal.toLocaleString()} ر.س</span></div>
             </div>
           </div>

           <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-center">
                    <thead className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                        <tr>
                            <th className="p-4 font-medium text-center">التاريخ</th>
                            <th className="p-4 font-medium text-center">مدى</th>
                            <th className="p-4 font-medium text-center">فيزا</th>
                            <th className="p-4 font-medium text-center">ماستر</th>
                            <th className="p-4 font-medium text-center">أمريكان</th>
                            <th className="p-4 font-medium text-center">خليج</th>
                            <th className="p-4 font-medium text-center">المجموع</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {history.map((row: any, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-bold text-slate-700 flex items-center justify-center gap-2"><Calendar size={16} className="text-slate-400" />{row.date}</td>
                                <td className="p-4 text-slate-600 text-center">{Number(row.mada || 0).toLocaleString()}</td>
                                <td className="p-4 text-slate-600 text-center">{Number(row.visa || 0).toLocaleString()}</td>
                                <td className="p-4 text-slate-600 text-center">{Number(row.master || 0).toLocaleString()}</td>
                                <td className="p-4 text-slate-600 text-center">{Number(row.amex || 0).toLocaleString()}</td>
                                <td className="p-4 text-slate-600 text-center">{Number(row.gcci || 0).toLocaleString()}</td>
                                <td className="p-4 font-bold text-blue-600 bg-blue-50/30 text-center">{row.total.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
           </div>
        </div>
      );
  };

  return (
    <div>
       {selectedTerminal ? renderDetailView() : renderSummaryView()}

       {/* Add Terminal Modal */}
       {isAddModalOpen && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
               <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                   <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                       <h3 className="font-bold text-slate-800">إضافة جهاز شبكة جديد</h3>
                       <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20} /></button>
                   </div>
                   <div className="p-6">
                       <label className="block text-sm font-medium text-slate-700 mb-2">رقم الجهاز التعريف (Terminal ID)</label>
                       <input 
                        type="text" 
                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-center text-xl"
                        placeholder="00000000"
                        value={newTerminalId}
                        onChange={(e) => setNewTerminalId(e.target.value)}
                        autoFocus
                       />
                       <p className="text-xs text-slate-400 mt-2 text-center">سيظهر هذا الرقم في نموذج إقفال المبيعات اليومي فور إضافته.</p>
                       <button 
                        onClick={handleAddTerminal}
                        disabled={isLoading || !newTerminalId.trim()}
                        className="w-full mt-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex justify-center items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-100"
                       >
                        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        <span>تأكيد الإضافة</span>
                       </button>
                   </div>
               </div>
           </div>
       )}

       {/* Delete Confirmation Modal */}
       {isDeleteModalOpen && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
               <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-6">
                   <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32} /></div>
                   <h3 className="text-xl font-bold text-slate-800 mb-1">حذف الجهاز</h3>
                   <p className="text-slate-500 text-sm mb-6">هل أنت متأكد من حذف الجهاز رقم <span className="font-mono font-bold text-red-600">{terminalToDelete}</span>؟</p>
                   <input 
                    type="password" 
                    className="w-full p-2 border rounded-lg text-center mb-2 outline-none focus:border-red-500 font-mono" 
                    placeholder="****"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                   />
                   {deleteError && <p className="text-xs text-red-500 mb-4">{deleteError}</p>}
                   <div className="flex gap-3 mt-4">
                       <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 text-slate-600 bg-slate-100 rounded-lg font-bold">إلغاء</button>
                       <button onClick={confirmDeleteTerminal} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold shadow-lg shadow-red-100">تأكيد الحذف</button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default Terminals;
