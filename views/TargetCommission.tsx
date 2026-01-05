
import React, { useState, useEffect, useMemo } from 'react';
import { Target, TrendingUp, Users, Plus, Save, Loader2, Calendar, CheckCircle2, AlertCircle, Info, Calculator, Banknote, User, Hash, Trophy, PlusCircle, X, UserPlus, Search, UserCheck, UserMinus, TableProperties, LayoutGrid } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { Employee } from '../types';
import { useAuth } from '../context/AuthContext';
import { logAction } from '../services/auditLogService';
import StatCard from '../components/StatCard';
import { round } from '../utils/mathUtils';

interface EmployeeCommission {
    employee_id: string;
    total_count: number;
    updated_at: string;
}

const TargetCommission: React.FC = () => {
    const { user } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [commissions, setCommissions] = useState<Record<string, EmployeeCommission>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    // Modal states
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [entryValues, setEntryValues] = useState<Record<string, string>>({});
    const [isSelectParticipantsModalOpen, setIsSelectParticipantsModalOpen] = useState(false);
    const [participantSearch, setParticipantSearch] = useState('');
    const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);

    const [year, month] = selectedMonth.split('-');
    const currentMonthNum = Number(month);
    const currentYearNum = Number(year);

    const fetchData = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            // 1. Fetch All Employees
            const { data: empData, error: empError } = await supabase.from('employees').select('*').order('name');
            if (empError) throw empError;
            if (empData) setEmployees(empData);

            // 2. Fetch Commissions Summary for the selected month/year
            const { data: commData, error: commError } = await supabase
                .from('employee_commissions')
                .select('*')
                .eq('month', currentMonthNum)
                .eq('year', currentYearNum);

            if (commError) {
                if (commError.code === '42P01') {
                    setMessage({ text: 'خطأ: جدول العمولات غير موجود في قاعدة البيانات. يرجى مراجعة التعليمات.', type: 'error' });
                }
                throw commError;
            }

            const commMap: Record<string, EmployeeCommission> = {};
            const activeIds: string[] = [];
            
            if (commData) {
                (commData as any[]).forEach((c: any) => {
                    commMap[c.employee_id] = {
                        employee_id: c.employee_id,
                        total_count: Number(c.total_count) || 0,
                        updated_at: c.updated_at
                    };
                    activeIds.push(c.employee_id);
                });
            }
            setCommissions(commMap);
            setSelectedParticipantIds(activeIds);
        } catch (err: any) {
            console.error("Fetch error:", err);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedMonth]);

    // Derived state: employees who have a record in the commissions table for this month
    const eligibleEmployees = useMemo(() => {
        return employees.filter(emp => commissions[emp.id] !== undefined);
    }, [employees, commissions]);

    const totalGlobalCount = useMemo(() => {
        const commArray = Object.values(commissions) as EmployeeCommission[];
        return commArray.reduce((sum, c) => sum + (Number(c.total_count) || 0), 0);
    }, [commissions]);

    const handleOpenAddModal = () => {
        if (eligibleEmployees.length === 0) {
            alert("يرجى تحديد الموظفين المشاركين أولاً عبر زر إدارة المشاركين.");
            return;
        }
        const initial: Record<string, string> = {};
        eligibleEmployees.forEach(emp => {
            initial[emp.id] = '';
        });
        setEntryValues(initial);
        setIsAddModalOpen(true);
    };

    const handleSaveBatchEntries = async () => {
        if (Object.values(entryValues).every(v => !v || Number(v) === 0)) {
            setIsAddModalOpen(false);
            return;
        }

        setIsSaving(true);
        try {
            const updates = [];
            for (const emp of eligibleEmployees) {
                const addValue = Number(entryValues[emp.id]) || 0;
                if (addValue !== 0) {
                    const currentCount = commissions[emp.id]?.total_count || 0;
                    const newTotal = currentCount + addValue;
                    
                    updates.push(
                        supabase.from('employee_commissions').upsert({
                            employee_id: emp.id,
                            month: currentMonthNum,
                            year: currentYearNum,
                            total_count: newTotal,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'employee_id,month,year' })
                    );
                }
            }

            if (updates.length > 0) {
                await Promise.all(updates);
                await logAction(user, 'update', 'العمولات', `إضافة أعداد جديدة لـ ${updates.length} موظف لشهر ${selectedMonth}`);
                setMessage({ text: 'تم تحديث الأعداد بنجاح', type: 'success' });
                await fetchData(true);
            }
            setIsAddModalOpen(false);
        } catch (err) {
            setMessage({ text: 'حدث خطأ أثناء حفظ البيانات', type: 'error' });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleSaveParticipants = async () => {
        setIsSaving(true);
        try {
            const updates = [];
            for (const id of selectedParticipantIds) {
                if (!commissions[id]) {
                    updates.push(
                        supabase.from('employee_commissions').upsert({
                            employee_id: id,
                            month: currentMonthNum,
                            year: currentYearNum,
                            total_count: 0,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'employee_id,month,year' })
                    );
                }
            }
            
            const idsToDelete = Object.keys(commissions).filter(id => !selectedParticipantIds.includes(id));
            if (idsToDelete.length > 0) {
                updates.push(
                    supabase.from('employee_commissions')
                        .delete()
                        .in('employee_id', idsToDelete)
                        .eq('month', currentMonthNum)
                        .eq('year', currentYearNum)
                );
            }

            if (updates.length > 0) {
                await Promise.all(updates);
                await logAction(user, 'update', 'العمولات', `تحديث قائمة المشاركين لشهر ${selectedMonth}`);
                await fetchData(true);
                setMessage({ text: 'تم تحديث قائمة المشاركين بنجاح', type: 'success' });
            } else {
                 setIsSelectParticipantsModalOpen(false);
            }
            setIsSelectParticipantsModalOpen(false);
        } catch (err: any) {
            console.error("Save participants error:", err);
            setMessage({ text: 'حدث خطأ أثناء تحديث قائمة المشاركين. تأكد من وجود الجدول في قاعدة البيانات.', type: 'error' });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const toggleParticipant = (id: string) => {
        setSelectedParticipantIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const filteredEmployeesForSelection = employees.filter(e => 
        e.name.toLowerCase().includes(participantSearch.toLowerCase()) || 
        (e.role && e.role.toLowerCase().includes(participantSearch.toLowerCase()))
    );

    return (
        <div className="max-w-7xl mx-auto pb-20 animate-fade-in text-right" dir="rtl">
            {/* Header */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
                        <Trophy size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">نظام العمولات والتحفيز</h2>
                        <p className="text-slate-500 text-sm font-bold mt-1">إدارة الموظفين المحددين ومتابعة إنجازاتهم</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100 flex items-center gap-2">
                        <Calendar className="text-slate-400 mr-1" size={18} />
                        <input 
                            type="month" 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent outline-none font-black text-slate-700 text-sm"
                        />
                    </div>
                    <button 
                        onClick={() => setIsSelectParticipantsModalOpen(true)}
                        className="bg-white text-slate-600 px-5 py-2.5 rounded-2xl font-black flex items-center gap-2 hover:bg-slate-50 transition-all text-sm border border-slate-200"
                    >
                        <UserPlus size={18} />
                        إدارة المشاركين
                    </button>
                    <button 
                        onClick={handleOpenAddModal}
                        className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl font-black flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all text-sm"
                    >
                        <PlusCircle size={18} />
                        إضافة عمولة
                    </button>
                </div>
            </div>

            {message && (
                <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 border-2 animate-slide-up ${
                    message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                    {message.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                    <p className="font-black">{message.text}</p>
                </div>
            )}

            {/* Summary Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <StatCard title="إجمالي الأعداد (النقاط)" value={totalGlobalCount.toLocaleString()} icon={TrendingUp} color="blue" trend="مجموع إنجاز الموظفين" />
                <StatCard title="المشاركون في العمولات" value={eligibleEmployees.length.toString()} icon={Users} color="green" trend="موظف ظاهر حالياً" />
                <StatCard title="تاريخ التحديث" value={new Date().toLocaleDateString('ar-SA')} icon={Calendar} color="orange" trend="توقيت النظام" />
            </div>

            {/* Main Grid View - Smaller Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {isLoading ? (
                    <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin inline-block text-indigo-600" size={48} /></div>
                ) : eligibleEmployees.length === 0 ? (
                    <div className="col-span-full py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-200 text-center">
                        <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users size={32} />
                        </div>
                        <h3 className="font-black text-slate-400 text-base">لا يوجد موظفون مشاركون</h3>
                        <p className="text-[10px] text-slate-300 mt-2 max-w-xs mx-auto font-bold">يرجى اختيار الموظفين المحددين لعرضهم هنا.</p>
                        <button 
                            onClick={() => setIsSelectParticipantsModalOpen(true)}
                            className="mt-4 bg-indigo-50 text-indigo-600 px-6 py-2 rounded-xl font-black text-xs hover:bg-indigo-100 transition-all inline-flex items-center gap-2"
                        >
                            <UserPlus size={14} /> تحديد المشاركين
                        </button>
                    </div>
                ) : eligibleEmployees.map(emp => {
                    const comm = commissions[emp.id];
                    return (
                        <div key={emp.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50/40 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110"></div>
                            <div className="flex items-center gap-3 relative mb-3">
                                <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-base shadow-md shadow-indigo-100 shrink-0">
                                    {emp.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-black text-slate-800 text-xs truncate" title={emp.name}>{emp.name}</h3>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase truncate">{emp.role}</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-2">
                                <span className="text-[9px] font-black text-slate-400 block mb-1 uppercase">إجمالي المحقق</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-indigo-700 font-mono">{(comm?.total_count || 0).toLocaleString()}</span>
                                    <span className="text-[9px] font-bold text-slate-400 italic">نقطة</span>
                                </div>
                            </div>
                            <p className="text-[8px] text-slate-300 font-bold text-left italic">
                                {comm?.updated_at ? new Date(comm.updated_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '---'}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Selection Modal */}
            {isSelectParticipantsModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in border border-slate-200 flex flex-col h-[85vh]">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                                    <Users size={24} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-xl">تحديد أسماء الموظفين</h3>
                                    <p className="text-xs text-slate-400 font-bold">اختر الموظفين الذين تود متابعة عمولاتهم في هذا الشهر</p>
                                </div>
                            </div>
                            <button onClick={() => setIsSelectParticipantsModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24} /></button>
                        </div>

                        <div className="p-4 bg-white border-b border-slate-50 shrink-0">
                            <div className="relative">
                                <Search className="absolute right-3 top-3 text-slate-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="بحث باسم الموظف..."
                                    className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={participantSearch}
                                    onChange={(e) => setParticipantSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar bg-white">
                            {filteredEmployeesForSelection.map(emp => {
                                const isSelected = selectedParticipantIds.includes(emp.id);
                                return (
                                    <div 
                                        key={emp.id} 
                                        onClick={() => toggleParticipant(emp.id)}
                                        className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                                            isSelected 
                                                ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' 
                                                : 'border-slate-50 hover:border-slate-200 bg-slate-50/30'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                {emp.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className={`font-black text-sm ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{emp.name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold">{emp.role}</p>
                                            </div>
                                        </div>
                                        <div className={`p-1.5 rounded-lg transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-300'}`}>
                                            {isSelected ? <UserCheck size={18} /> : <Plus size={18} />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                            <button onClick={() => setIsSelectParticipantsModalOpen(false)} className="px-8 py-3 text-slate-500 font-black hover:bg-slate-100 rounded-2xl transition-all">إلغاء</button>
                            <button 
                                onClick={handleSaveParticipants}
                                disabled={isSaving}
                                className="px-12 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                حفظ التغييرات
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Commission Modal (Ultra Compact & Wider) */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-7xl overflow-hidden animate-scale-in border border-slate-200 flex flex-col max-h-[90vh]">
                        <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-600 text-white rounded-xl">
                                    <LayoutGrid size={20} />
                                </div>
                                <div className="text-right">
                                    <h3 className="font-black text-slate-800 text-lg">تحديث أعداد العمولات</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">إدخال البيانات السريع لمجموع الموظفين</p>
                                </div>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors p-2"><X size={24} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/20">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3">
                                {eligibleEmployees.map((emp) => (
                                    <div key={emp.id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3 relative group hover:shadow-md transition-all">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-black text-[11px] shadow-sm shrink-0">
                                                    {emp.name.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-black text-slate-800 text-[11px] truncate" title={emp.name}>{emp.name}</h3>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase truncate">{emp.role}</p>
                                                </div>
                                            </div>
                                            <div className="text-left bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 shrink-0">
                                                <span className="text-[8px] font-black text-slate-400 block uppercase">الحالي</span>
                                                <span className="font-mono font-black text-slate-700 text-[10px]">{(commissions[emp.id]?.total_count || 0).toLocaleString()}</span>
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-300 pointer-events-none">
                                                <Plus size={14} />
                                            </div>
                                            <input 
                                                type="number" 
                                                value={entryValues[emp.id]}
                                                onChange={(e) => setEntryValues({...entryValues, [emp.id]: e.target.value})}
                                                className="w-full p-2.5 pr-8 text-center font-mono font-black text-indigo-600 text-lg bg-slate-50/50 border-2 border-slate-100 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-100"
                                                placeholder="0"
                                            />
                                            {Number(entryValues[emp.id]) > 0 && (
                                                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-green-500 font-black text-[9px] bg-green-50 px-1.5 py-0.5 rounded border border-green-100 animate-fade-in pointer-events-none">
                                                    ➔ {(Number(commissions[emp.id]?.total_count || 0) + Number(entryValues[emp.id])).toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
                            <button onClick={() => setIsAddModalOpen(false)} className="px-6 py-2.5 text-slate-500 font-black hover:bg-slate-50 rounded-xl transition-all text-xs">إلغاء</button>
                            <button 
                                onClick={handleSaveBatchEntries}
                                disabled={isSaving}
                                className="px-12 py-2.5 bg-indigo-600 text-white rounded-xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 text-xs"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                اعتماد وحفظ البيانات
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Info Footer */}
            <div className="mt-12 p-6 bg-indigo-50 rounded-[2rem] border-2 border-dashed border-indigo-200 flex items-start gap-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl shrink-0">
                    <Info size={24} />
                </div>
                <div className="text-right">
                    <h4 className="font-black text-indigo-900 mb-1">تعليمات استخدام نظام الأعداد</h4>
                    <p className="text-xs text-indigo-800 leading-relaxed font-bold">
                        الخطوة الأولى هي الضغط على "إدارة المشاركين" وتحديد الموظفين الذين تود متابعتهم لهذا الشهر. بعد ذلك، استخدم زر "إضافة عمولة" لتسجيل الإنجازات اليومية. يتم تحديث الواجهة فورياً لتعرض الإجمالي التراكمي لكل موظف بشكل مبسط.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TargetCommission;
