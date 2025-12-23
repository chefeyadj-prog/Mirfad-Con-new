
import React, { useState, useEffect } from 'react';
import { Database, History, RotateCcw, ShieldCheck, Calendar, Trash2, AlertTriangle, CheckCircle2, Loader2, Info, Search, User, Clock } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { createSystemBackup, restoreFromBackup } from '../services/backupService';
import { logAction } from '../services/auditLogService';

interface BackupEntry {
    id: string;
    created_at: string;
    created_by: string;
    description: string;
}

const Backups: React.FC = () => {
    const { user } = useAuth();
    const [backups, setBackups] = useState<BackupEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

    // Restore Modal States
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [selectedBackup, setSelectedBackup] = useState<BackupEntry | null>(null);
    const [authPassword, setAuthPassword] = useState('');
    const [authError, setAuthError] = useState('');

    const fetchBackups = async () => {
        setIsLoading(true);
        const { data } = await supabase.from('backups').select('id, created_at, created_by, description').order('created_at', { ascending: false });
        if (data) setBackups(data);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchBackups();
    }, []);

    const handleManualBackup = async () => {
        setIsProcessing(true);
        const res = await createSystemBackup(user, "نسخة احتياطية يدوية كاملة");
        if (res.success) {
            setMessage({ text: 'تم إنشاء النسخة الاحتياطية بنجاح!', type: 'success' });
            fetchBackups();
        } else {
            setMessage({ text: 'فشل في إنشاء النسخة الاحتياطية.', type: 'error' });
        }
        setIsProcessing(false);
        setTimeout(() => setMessage(null), 4000);
    };

    const initiateRestore = (backup: BackupEntry) => {
        setSelectedBackup(backup);
        setAuthPassword('');
        setAuthError('');
        setIsRestoreModalOpen(true);
    };

    const confirmRestore = async () => {
        if (authPassword !== '1234') {
            setAuthError('كلمة المرور غير صحيحة');
            return;
        }

        if (!selectedBackup) return;

        setIsProcessing(true);
        setIsRestoreModalOpen(false);
        setMessage({ text: 'جاري استعادة البيانات وفحص الجداول... يرجى الانتظار وعدم إغلاق الصفحة', type: 'info' });

        const res = await restoreFromBackup(selectedBackup.id);

        if (res.success) {
            await logAction(user, 'update', 'النظام', `استعادة بيانات النظام لنسخة تاريخ ${selectedBackup.created_at}`);
            setMessage({ text: 'تمت الاستعادة بنجاح! سيتم تحديث الصفحة فوراً.', type: 'success' });
            setTimeout(() => window.location.reload(), 2000);
        } else {
            setMessage({ text: 'فشل في استعادة النسخة الاحتياطية.', type: 'error' });
        }
        setIsProcessing(false);
    };

    const deleteBackup = async (id: string) => {
        if (window.confirm('هل أنت متأكد من حذف ملف النسخة هذا من السجل؟ (لن يؤثر على البيانات الحالية)')) {
            await supabase.from('backups').delete().eq('id', id);
            setBackups(prev => prev.filter(b => b.id !== id));
        }
    };

    const filteredBackups = backups.filter(b => 
        b.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
        b.created_by.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto pb-12 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Database size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">النسخ الاحتياطي والاستعادة</h2>
                        <p className="text-slate-500 text-sm mt-1">يحتفظ النظام بنسخة لكل حركة تتم لضمان عدم فقدان البيانات</p>
                    </div>
                </div>
                <button 
                    onClick={handleManualBackup}
                    disabled={isProcessing}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-black flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50"
                >
                    {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Database size={20} />}
                    <span>أخذ نسخة يدوية</span>
                </button>
            </div>

            {message && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-slide-up border-2 ${
                    message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 
                    message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 
                    'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                    {message.type === 'success' ? <CheckCircle2 size={24} /> : message.type === 'error' ? <AlertTriangle size={24} /> : <Info size={24} />}
                    <p className="font-bold">{message.text}</p>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-8">
                <div className="p-5 border-b border-slate-50 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h3 className="font-black text-slate-700 flex items-center gap-2">
                        <History size={20} className="text-indigo-500" />
                        سجل النسخ المحفوظة
                    </h3>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="بحث في النسخ..." 
                            className="w-full pr-9 pl-4 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                            <tr>
                                <th className="p-4">التاريخ والوقت</th>
                                <th className="p-4">تفاصيل النسخة</th>
                                <th className="p-4">المستخدم</th>
                                <th className="p-4 text-center">الإجراء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr><td colSpan={4} className="p-12 text-center text-slate-400 font-medium"><Loader2 className="animate-spin inline-block mr-2" /> جاري جلب النسخ...</td></tr>
                            ) : filteredBackups.length === 0 ? (
                                <tr><td colSpan={4} className="p-12 text-center text-slate-400 font-medium">لا توجد نسخ احتياطية مطابقة للبحث.</td></tr>
                            ) : filteredBackups.map((backup) => (
                                <tr key={backup.id} className="hover:bg-indigo-50/20 transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 text-slate-700 font-black font-mono text-xs" dir="ltr">
                                            <Calendar size={14} className="text-slate-300" />
                                            {new Date(backup.created_at).toLocaleString('ar-EG')}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                                            <Clock size={10} />
                                            <span>{new Date(backup.created_at).toLocaleTimeString('ar-EG')}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <p className="font-bold text-slate-800 text-sm">{backup.description}</p>
                                        <span className="text-[10px] text-slate-400 font-mono uppercase bg-slate-100 px-1 rounded">ID: {backup.id}</span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 text-slate-600 font-bold">
                                            <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-[10px]">{(backup.created_by || '?').charAt(0)}</div>
                                            {backup.created_by}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button 
                                                onClick={() => initiateRestore(backup)}
                                                className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-black text-xs hover:bg-indigo-700 flex items-center gap-1.5 transition-all shadow-md shadow-indigo-100"
                                            >
                                                <RotateCcw size={14} />
                                                استعادة
                                            </button>
                                            <button 
                                                onClick={() => deleteBackup(backup.id)}
                                                className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                                                title="حذف من السجل"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="p-6 bg-amber-50 rounded-2xl border-2 border-dashed border-amber-200 flex items-start gap-4">
                <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                    <AlertTriangle size={24} />
                </div>
                <div>
                    <h4 className="font-black text-amber-900 mb-1">تنبيه أمني هام</h4>
                    <p className="text-sm text-amber-800 leading-relaxed font-bold">
                        عند استعادة نسخة احتياطية، سيتم مسح كافة البيانات الحالية في المبيعات والمشتريات والمخزون واستبدالها ببيانات النسخة المختارة. يرجى التأكد من اختيار النسخة الصحيحة، علماً بأن سجل النسخ الاحتياطية يظل محفوظاً ولن يتأثر بعملية الاستعادة.
                    </p>
                </div>
            </div>

            {/* Restore Auth Modal */}
            {isRestoreModalOpen && selectedBackup && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in border border-slate-200">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
                                <RotateCcw size={32} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-2">تأكيد استعادة البيانات</h3>
                            <p className="text-slate-500 text-sm mb-6 font-bold leading-relaxed px-4">
                                أنت على وشك العودة إلى لقطة تاريخ: <br/>
                                <span className="font-black text-indigo-600" dir="ltr">{new Date(selectedBackup.created_at).toLocaleString('ar-EG')}</span>
                            </p>
                            
                            <div className="mb-6 text-right">
                                <label className="block text-xs font-black text-slate-700 mb-2 mr-1 flex items-center gap-1">
                                    <ShieldCheck size={14} className="text-indigo-500" />
                                    كلمة مرور المدير للتأكيد
                                </label>
                                <input 
                                    type="password" 
                                    autoFocus
                                    className={`w-full p-3 border rounded-xl text-center font-mono text-lg outline-none focus:ring-4 ${authError ? 'border-red-500 ring-red-50' : 'border-slate-200 focus:border-indigo-500 ring-indigo-50'}`}
                                    placeholder="****"
                                    value={authPassword}
                                    onChange={(e) => setAuthPassword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && confirmRestore()}
                                />
                                {authError && <p className="text-xs text-red-500 mt-2 font-bold text-center">{authError}</p>}
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setIsRestoreModalOpen(false)} className="flex-1 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-colors">إلغاء</button>
                                <button onClick={confirmRestore} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">تأكيد الاستعادة</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Backups;
