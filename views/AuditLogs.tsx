
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Filter, Clock, User, FileText, Trash2, Edit, PlusCircle, LogIn, RotateCcw, AlertTriangle, Loader2, CheckCircle2, X, Lock } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { AuditLogEntry, Purchase, Supplier, Product } from '../types';
import DateFilter, { DateRange, getThisMonthRange } from '../components/DateFilter';
import { logAction } from '../services/auditLogService';
import { useAuth } from '../context/AuthContext';
import { round } from '../utils/mathUtils';

const AuditLogs: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>(getThisMonthRange());
  const [isProcessing, setIsProcessing] = useState(false);
  
  const fetchLogs = async () => {
    let query = supabase.from('audit_logs').select('*').order('timestamp', { ascending: false });
    const { data, error } = await query;
    if (data) setLogs(data);
  };

  useEffect(() => {
    fetchLogs();
    const channel = supabase.channel('audit-logs-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, (payload) => {
        setLogs(prev => [payload.new as AuditLogEntry, ...prev]);
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create': return <PlusCircle size={14} className="text-green-500" />;
      case 'update': return <Edit size={14} className="text-blue-500" />;
      case 'delete': return <Trash2 size={14} className="text-red-500" />;
      case 'login': return <LogIn size={14} className="text-indigo-500" />;
      default: return <FileText size={14} />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'create': return 'إضافة';
      case 'update': return 'تعديل';
      case 'delete': return 'حذف';
      case 'login': return 'دخول';
      default: return action;
    }
  };

  const initiateUndo = async (log: AuditLogEntry) => {
    if (window.confirm(`هل أنت متأكد من رغبتك في التراجع عن هذه العملية؟\n${log.details}`)) {
      setIsProcessing(true);
      // Implementation placeholder for actual undo logic depending on resource type
      alert('ميزة التراجع قيد التطوير حالياً.');
      setIsProcessing(false);
    }
  };

  const filteredLogs = logs.filter(log => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (log.user_name || '').toLowerCase().includes(searchLower) ||
        (log.details || '').toLowerCase().includes(searchLower) ||
        (log.resource || '').toLowerCase().includes(searchLower);
      
      let matchesDate = true;
      if (dateRange.start && dateRange.end) {
          const logDate = new Date(log.timestamp);
          matchesDate = logDate >= dateRange.start && logDate <= dateRange.end;
      }
      return matchesSearch && matchesDate;
  });
  
  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <ShieldCheck className="text-indigo-600" size={28} />
             سجل الحركات (Audit Log)
           </h2>
           <p className="text-slate-500 text-sm mt-1">تتبع العمليات وإمكانية التراجع عن آخر الحركات</p>
        </div>
        <div className="flex items-center gap-3">
             <DateFilter onFilterChange={setDateRange} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث في السجل..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-500 text-sm">
                    <tr>
                        <th className="p-4 font-bold">الوقت</th>
                        <th className="p-4 font-bold">المستخدم</th>
                        <th className="p-4 font-bold">النوع</th>
                        <th className="p-4 font-bold">القسم</th>
                        <th className="p-4 font-bold">التفاصيل</th>
                        <th className="p-4 font-bold text-center">إجراء</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map((log, index) => (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-slate-500 text-xs font-mono" dir="ltr">
                                {new Date(log.timestamp).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                            </td>
                            <td className="p-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[10px]">
                                        {(log.user_name || '?').charAt(0)}
                                    </div>
                                    <span className="font-bold text-slate-700 text-sm">{log.user_name}</span>
                                </div>
                            </td>
                            <td className="p-4">
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                                    {getActionIcon(log.action)}
                                    {getActionLabel(log.action)}
                                </span>
                            </td>
                            <td className="p-4 text-slate-700 font-medium text-sm">{log.resource}</td>
                            <td className="p-4 text-slate-600 text-xs leading-relaxed max-w-xs">{log.details}</td>
                            <td className="p-4 text-center">
                                {index < 15 && log.action === 'create' && (
                                    <button 
                                        onClick={() => initiateUndo(log)}
                                        className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors flex items-center gap-1 mx-auto text-xs font-bold border border-orange-100"
                                        title="تراجع عن هذه العملية"
                                    >
                                        <RotateCcw size={14} />
                                        <span>تراجع</span>
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">لا يوجد سجل حركات مطابق للبحث</td>
                      </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
