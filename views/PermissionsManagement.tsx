import React, { useState, useEffect } from 'react';
import { 
    LockKeyhole, UserCog, ShieldCheck, ShieldAlert, CheckCircle2, 
    Loader2, Search, UserCheck, Shield, Settings2, X, Trash2, 
    Plus, AlertCircle, Key, UserPlus, ShieldPlus, LayoutDashboard, 
    ShoppingCart, Server, ShoppingBag, Package, Wallet, PieChart, 
    Users, Banknote, History, FileText, Database, ShieldCheck as AuditIcon, 
    Sparkles, UserRoundCog, ChevronLeft, ToggleRight, ToggleLeft,
    AlertTriangle,
    Calendar,
    Target
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { logAction } from '../services/auditLogService';
import { useAuth } from '../context/AuthContext';

interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    role: string;
    password?: string;
    created_at?: string;
}

interface PagePermissions {
    show: boolean;
    features: Record<string, boolean>;
}

const SYSTEM_ADMINS = [
    { name: 'Ahmed', email: 'ahmed@mirfad.com', role: 'owner' },
    { name: 'Kamal', email: 'kamal@mirfad.com', role: 'admin' },
    { name: 'Majed', email: 'majed@mirfad.com', role: 'admin' }
];

const PERMISSIONS_SCHEMA: Record<string, { label: string, icon: any, features: Record<string, string> }> = {
    dashboard: { 
        label: 'لوحة التحكم', 
        icon: LayoutDashboard, 
        features: { canFilter: 'الفلتر', showTotalSales: 'إجمالي المبيعات', showTotalCash: 'إجمالي الكاش', showTotalPurchases: 'إجمالي المشتريات', showTotalOutgoings: 'إجمالي المصروفات', showExpenseDistribution: 'توزيع المصاريف', showSalesChart: 'حركة المبيعات' } 
    },
    sales: { 
        label: 'تقفيل المبيعات اليومي', 
        icon: ShoppingCart, 
        features: { canAdd: 'إضافة إقفال', showList: 'عرض السجل', showGrandTotal: 'الإجمالي الكلي', canEdit: 'تعديل', canDelete: 'حذف', canView: 'معاينة', canExport: 'Excel', canFilter: 'فلتر', canSearch: 'بحث' } 
    },
    terminals: { 
        label: 'أجهزة الشبكة (POS)', 
        icon: Server, 
        features: { canAdd: 'إضافة جهاز', showActions: 'إجراءات', canExport: 'Excel', canDelete: 'حذف', canEdit: 'تعديل' } 
    },
    purchases: { 
        label: 'المشتريات', 
        icon: ShoppingBag, 
        features: { canAdd: 'إضافة فاتورة', canExport: 'Excel', canDelete: 'حذف', canEdit: 'تعديل', canFilter: 'فلتر', canSearch: 'بحث', showList: 'عرض السجل' } 
    },
    monthly_purchases: {
        label: 'المشتريات الشهرية',
        icon: Calendar,
        features: { canView: 'دخول الصفحة' }
    },
    inventory: { 
        label: 'المخزون', 
        icon: Package, 
        features: { canAdd: 'إضافة منتج', canExport: 'تصدير', canDelete: 'حذف', canEdit: 'تعديل', canFilter: 'فلتر', canSearch: 'بحث' } 
    },
    custody: { 
        label: 'العهد المالية', 
        icon: Wallet, 
        features: { canAdd: 'إنشاء عهدة', canClose: 'إقفال عهدة' } 
    },
    general_expenses: { 
        label: 'المصاريف العامة', 
        icon: PieChart, 
        features: { canAdd: 'تسجيل مصروف', canExport: 'Excel', canDelete: 'حذف', canEdit: 'تعديل', canFilter: 'فلتر', canSearch: 'بحث', showList: 'عرض السجل' } 
    },
    suppliers: { 
        label: 'الموردين', 
        icon: Users, 
        features: { canAdd: 'إضافة مورد', canDelete: 'حذف', canEdit: 'تعديل', canPay: 'دفع مستحقات' } 
    },
    salaries: { 
        label: 'الموارد البشرية والرواتب', 
        icon: UserCog, 
        features: { 
            showOverview: 'إظهار نظرة عامة', 
            showEmployees: 'إظهار الموظفين', 
            showPayroll: 'إظهار مسيرة الرواتب', 
            showLoans: 'إظهار السلف', 
            showDeductions: 'إظهار الخصومات', 
            showMeals: 'إظهار الوجبات', 
            showShortages: 'إظهار العجوزات', 
            showBonuses: 'إظهار المكافآت' 
        } 
    },
    targets: { label: 'الأهداف والعمولات', icon: Target, features: { canEdit: 'تعديل الأهداف', canView: 'عرض العمولات' } },
    retroactive: { label: 'الأثر الرجعي', icon: History, features: { canView: 'دخول الصفحة' } },
    reports: { label: 'التقرير الذكي', icon: FileText, features: { canView: 'دخول الصفحة' } },
    backups: { label: 'النسخة الاحتياطية', icon: Database, features: { canView: 'دخول الصفحة' } },
    audit_logs: { label: 'سجل الحركات', icon: AuditIcon, features: { canView: 'دخول الصفحة' } },
    permissions: { label: 'إدارة الصلاحيات', icon: LockKeyhole, features: { canView: 'دخول الصفحة' } },
};

const PermissionsManagement: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [roles, setRoles] = useState<Record<string, { label: string, color: string, icon: any }>>({
        it: { label: 'مسؤول تقني (IT)', color: 'bg-red-100 text-red-700 border-red-200', icon: ShieldAlert },
        owner: { label: 'المالك (Owner)', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: ShieldCheck },
        admin: { label: 'المدير (Admin)', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: UserCog },
        accountant: { label: 'المحاسب (Accountant)', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: UserCheck },
        cashier: { label: 'الكاشير (Cashier)', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Shield },
    });

    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
    
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<string | null>(null);
    const [tempPermissions, setTempPermissions] = useState<Record<string, PagePermissions>>({});
    
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
    const [isChangeRoleModalOpen, setIsChangeRoleModalOpen] = useState(false);
    const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState(false);
    
    const [newUser, setNewUser] = useState({ full_name: '', email: '', role: 'cashier', password: '' });
    const [newRoleName, setNewRoleName] = useState('');
    const [passwordData, setPasswordData] = useState({ userId: '', userName: '', newPassword: '' });
    const [roleUpdateData, setRoleUpdateData] = useState({ userId: '', userName: '', currentRole: '', newRole: '' });
    const [deleteUserData, setDeleteUserData] = useState({ userId: '', userName: '', confirmPassword: '' });
    const [modalError, setModalError] = useState('');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: usersData } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
            if (usersData) setUsers(usersData);
            
            const { data: permsData } = await supabase.from('role_permissions').select('role');
            if (permsData) {
                const mergedRoles = { ...roles };
                permsData.forEach(p => {
                    if (p.role && !mergedRoles[p.role]) {
                        mergedRoles[p.role] = { label: p.role, color: 'bg-slate-50 text-slate-600 border-slate-200', icon: Settings2 };
                    }
                });
                setRoles(mergedRoles);
            }
        } catch (err) {} finally { setIsLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const handleAddUser = async () => {
        if (!newUser.full_name || !newUser.email || !newUser.password) return alert("يرجى إكمال البيانات");
        setIsLoading(true);
        try {
            await supabase.from('user_profiles').upsert({
                id: `USR-${Date.now()}`, full_name: newUser.full_name, email: newUser.email.toLowerCase().trim(), role: newUser.role, password: newUser.password
            });
            await logAction(currentUser, 'create', 'المستخدمين', `إضافة: ${newUser.full_name}`);
            setIsAddUserModalOpen(false);
            setNewUser({ full_name: '', email: '', role: 'cashier', password: '' });
            fetchData();
            setMessage({ text: 'تمت إضافة المستخدم بنجاح', type: 'success' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {} finally { setIsLoading(false); }
    };

    const handleUpdatePassword = async () => {
        if (!passwordData.newPassword) return;
        setIsLoading(true);
        try {
            await supabase.from('user_profiles').update({ password: passwordData.newPassword }).eq('id', passwordData.userId);
            await logAction(currentUser, 'update', 'المستخدمين', `تغيير كلمة مرور: ${passwordData.userName}`);
            setIsChangePasswordModalOpen(false);
            fetchData();
            setMessage({ text: 'تم تحديث كلمة المرور', type: 'success' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {} finally { setIsLoading(false); }
    };

    const handleUpdateRole = async () => {
        if (!roleUpdateData.newRole) return;
        setIsLoading(true);
        try {
            await supabase.from('user_profiles').update({ role: roleUpdateData.newRole }).eq('id', roleUpdateData.userId);
            await logAction(currentUser, 'update', 'المستخدمين', `تغيير رتبة: ${roleUpdateData.userName}`);
            setIsChangeRoleModalOpen(false);
            fetchData();
            setMessage({ text: 'تم تحديث الرتبة بنجاح', type: 'success' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {} finally { setIsLoading(false); }
    };

    const handleDeleteUser = async () => {
        if (deleteUserData.confirmPassword !== '1234') {
            setModalError('كلمة مرور التأكيد غير صحيحة');
            return;
        }

        setIsLoading(true);
        try {
            await supabase.from('user_profiles').delete().eq('id', deleteUserData.userId);
            await logAction(currentUser, 'delete', 'المستخدمين', `حذف المستخدم: ${deleteUserData.userName}`);
            setUsers(users.filter(u => u.id !== deleteUserData.userId));
            setIsDeleteUserModalOpen(false);
            setMessage({ text: 'تم حذف المستخدم بنجاح', type: 'success' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {} finally { setIsLoading(false); }
    };

    const openRolePermissions = async (roleKey: string) => {
        setSelectedRoleForPerms(roleKey);
        setIsLoading(true);
        const { data } = await supabase.from('role_permissions').select('permissions').eq('role', roleKey).maybeSingle();
        
        const initial: Record<string, PagePermissions> = {};
        Object.keys(PERMISSIONS_SCHEMA).forEach(key => {
            const features: Record<string, boolean> = {};
            Object.keys(PERMISSIONS_SCHEMA[key].features).forEach(f => {
                features[f] = data?.permissions?.[key]?.features?.[f] ?? true;
            });
            initial[key] = { show: data?.permissions?.[key]?.show ?? true, features };
        });
        setTempPermissions(initial);
        setIsLoading(false);
        setIsRoleModalOpen(true);
    };

    const handleSaveRolePermissions = async () => {
        if (!selectedRoleForPerms) return;
        setIsLoading(true);
        try {
            await supabase.from('role_permissions').upsert({ 
                role: selectedRoleForPerms, 
                permissions: tempPermissions 
            }, { onConflict: 'role' });
            setIsRoleModalOpen(false);
            setMessage({ text: 'تم حفظ الصلاحيات بنجاح', type: 'success' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {} finally { setIsLoading(false); }
    };

    const handleAddRole = async () => {
        if (!newRoleName.trim()) return;
        setIsLoading(true);
        try {
            // إضافة رتبة جديدة للصلاحيات ببيانات افتراضية
            const initialPerms: Record<string, PagePermissions> = {};
            Object.keys(PERMISSIONS_SCHEMA).forEach(key => {
                const features: Record<string, boolean> = {};
                Object.keys(PERMISSIONS_SCHEMA[key].features).forEach(f => { features[f] = true; });
                initialPerms[key] = { show: true, features };
            });

            await supabase.from('role_permissions').insert({
                role: newRoleName.trim().toLowerCase(),
                permissions: initialPerms
            });
            
            await logAction(currentUser, 'create', 'الرتب', `إضافة رتبة جديدة: ${newRoleName}`);
            setIsAddRoleModalOpen(false);
            setNewRoleName('');
            fetchData();
            setMessage({ text: 'تمت إضافة الرتبة بنجاح', type: 'success' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {} finally { setIsLoading(false); }
    };

    return (
        <div className="max-w-7xl mx-auto pb-20 animate-fade-in text-right" dir="rtl">
            {/* Header */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
                        <LockKeyhole size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">إدارة الحوكمة والصلاحيات</h2>
                        <p className="text-slate-500 text-sm font-bold mt-1">التحكم المركزي في المستخدمين ورتب الوصول</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setIsAddUserModalOpen(true)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-black flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all text-sm">
                        <UserPlus size={18} /> إضافة مستخدم
                    </button>
                    <button onClick={() => setIsAddRoleModalOpen(true)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl font-black flex items-center gap-2 hover:bg-slate-900 transition-all text-sm">
                        <ShieldPlus size={18} /> رتبة جديدة
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Active Users Section */}
                <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-black text-slate-700 flex items-center gap-2"><Users size={20} className="text-indigo-500" /> سجل الموظفين النشطين</h3>
                        <div className="relative w-64">
                            <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                            <input type="text" placeholder="بحث باسم الموظف..." className="w-full pr-10 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="p-5">الموظف</th>
                                    <th className="p-5">الرتبة</th>
                                    <th className="p-5 text-center">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {users.filter(u => u.full_name.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
                                    <tr key={u.id} className="hover:bg-indigo-50/20 transition-colors group">
                                        <td className="p-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-black text-lg border-2 border-white shadow-sm">{u.full_name.charAt(0)}</div>
                                                <div>
                                                    <p className="font-black text-slate-800 text-sm">{u.full_name}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono" dir="ltr">{u.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            {/* Fix: cast roles to Record<string, any> to avoid Property access errors */}
                                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black border ${(roles as Record<string, any>)[u.role]?.color || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                {(roles as Record<string, any>)[u.role]?.label || u.role}
                                            </span>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => { setRoleUpdateData({ userId: u.id, userName: u.full_name, currentRole: u.role, newRole: u.role }); setIsChangeRoleModalOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl" title="تغيير الرتبة"><UserRoundCog size={18} /></button>
                                                <button onClick={() => { setPasswordData({ userId: u.id, userName: u.full_name, newPassword: '' }); setIsChangePasswordModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl" title="تغيير كلمة المرور"><Key size={18} /></button>
                                                <button onClick={() => { setDeleteUserData({ userId: u.id, userName: u.full_name, confirmPassword: '' }); setModalError(''); setIsDeleteUserModalOpen(true); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl" title="حذف"><Trash2 size={18} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Roles Management Section */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 h-fit overflow-hidden">
                    <div className="p-5 bg-indigo-50 border-b border-indigo-100 font-black text-indigo-800 flex items-center gap-2">
                        <Settings2 size={20} /> إدارة صلاحيات الرتب
                    </div>
                    <div className="p-4 space-y-3">
                        {(Object.entries(roles) as [string, any][]).map(([key, details]) => (
                            <div key={key} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all group cursor-pointer" onClick={() => openRolePermissions(key)}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-2.5 rounded-xl ${details.color}`}><details.icon size={20} /></div>
                                    <span className="font-black text-slate-700 text-sm">{details.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <ChevronLeft size={16} className="text-slate-300 group-hover:text-indigo-500 transform group-hover:-translate-x-1 transition-all" />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-100">
                        <button onClick={() => setIsAddRoleModalOpen(true)} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-xs hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center justify-center gap-2">
                            <Plus size={16} /> تعريف رتبة وظيفية جديدة
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal: Detailed Permissions Editor */}
            {isRoleModalOpen && selectedRoleForPerms && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-scale-in border border-white/20">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                {/* Fix: Explicitly cast roles to access color property */}
                                <div className={`p-4 rounded-2xl ${(roles as Record<string, any>)[selectedRoleForPerms]?.color || 'bg-slate-100'}`}>
                                    <Settings2 size={24} />
                                </div>
                                <div>
                                    {/* Fix: Explicitly cast roles to access label property */}
                                    <h3 className="font-black text-slate-800 text-xl">حوكمة رتبة: {(roles as Record<string, any>)[selectedRoleForPerms]?.label}</h3>
                                    <p className="text-xs text-slate-400 font-bold mt-0.5">تحكم دقيق في ظهور الصفحات والوظائف الفرعية</p>
                                </div>
                            </div>
                            <button onClick={() => setIsRoleModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-red-500 rounded-full transition-all shadow-sm"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-slate-50/30">
                            {Object.entries(PERMISSIONS_SCHEMA).map(([pageKey, pageData]) => {
                                const isShowEnabled = tempPermissions[pageKey]?.show;
                                const Icon = pageData.icon;

                                return (
                                    <div key={pageKey} className={`bg-white border rounded-3xl overflow-hidden transition-all duration-300 ${isShowEnabled ? 'border-indigo-100 shadow-md shadow-indigo-900/5' : 'border-slate-100 opacity-60'}`}>
                                        <div className={`p-5 flex items-center justify-between border-b ${isShowEnabled ? 'bg-indigo-50/30 border-indigo-50' : 'bg-slate-50 border-slate-100'}`}>
                                            <div className="flex items-center gap-4">
                                                <button 
                                                    onClick={() => setTempPermissions(prev => ({ ...prev, [pageKey]: { ...prev[pageKey], show: !isShowEnabled } }))}
                                                    className={`transition-colors ${isShowEnabled ? 'text-indigo-600' : 'text-slate-300'}`}
                                                >
                                                    {isShowEnabled ? <ToggleRight size={44} /> : <ToggleLeft size={44} />}
                                                </button>
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-xl ${isShowEnabled ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        <Icon size={20} />
                                                    </div>
                                                    <span className={`font-black text-lg ${isShowEnabled ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{pageData.label}</span>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] font-black px-3 py-1 rounded-full ${isShowEnabled ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                                {isShowEnabled ? 'مفعلة' : 'محجوبة'}
                                            </span>
                                        </div>

                                        {isShowEnabled && (
                                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                                                {Object.entries(pageData.features).map(([fKey, fLabel]) => {
                                                    const isChecked = tempPermissions[pageKey]?.features?.[fKey];
                                                    return (
                                                        <div 
                                                            key={fKey} 
                                                            onClick={() => setTempPermissions(prev => ({
                                                                ...prev, 
                                                                [pageKey]: {
                                                                    ...prev[pageKey], 
                                                                    features: { ...prev[pageKey].features, [fKey]: !isChecked }
                                                                }
                                                            }))}
                                                            className={`group flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                                                                isChecked 
                                                                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' 
                                                                    : 'border-slate-100 bg-white hover:border-slate-200'
                                                            }`}
                                                        >
                                                            <span className={`text-xs font-black ${isChecked ? 'text-indigo-900' : 'text-slate-400'}`}>{fLabel}</span>
                                                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                                                isChecked 
                                                                    ? 'bg-indigo-600 border-indigo-600 shadow-md shadow-indigo-200' 
                                                                    : 'bg-white border-slate-200 group-hover:border-slate-300'
                                                            }`}>
                                                                {isChecked && <CheckCircle2 size={16} className="text-white" />}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
                            <button onClick={() => setIsRoleModalOpen(false)} className="px-8 py-3 text-slate-500 font-black hover:bg-slate-100 rounded-2xl transition-all">إلغاء</button>
                            <button onClick={handleSaveRolePermissions} disabled={isLoading} className="px-12 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50">
                                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />} 
                                اعتماد وحفظ الصلاحيات
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Add User */}
            {isAddUserModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-black text-slate-800">إضافة مستخدم جديد</h3>
                            <button onClick={() => setIsAddUserModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div><label className="block text-xs font-black text-slate-500 mb-1.5">الاسم الكامل</label><input type="text" className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" value={newUser.full_name} onChange={e => setNewUser({...newUser, full_name: e.target.value})} /></div>
                            <div><label className="block text-xs font-black text-slate-500 mb-1.5">البريد الإلكتروني</label><input type="email" className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} /></div>
                            <div><label className="block text-xs font-black text-slate-500 mb-1.5">كلمة المرور</label><input type="text" className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} /></div>
                            <div><label className="block text-xs font-black text-slate-500 mb-1.5">الرتبة</label>
                                <select className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                                    {/* Fix: cast Object.entries(roles) to any to handle dynamic role value property access */}
                                    {(Object.entries(roles) as [string, any][]).map(([key, details]) => <option key={key} value={key}>{details.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setIsAddUserModalOpen(false)} className="px-6 py-2.5 text-slate-500 font-bold">إلغاء</button>
                            <button onClick={handleAddUser} className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 shadow-md">حفظ المستخدم</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Add Role */}
            {isAddRoleModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-sm overflow-hidden animate-scale-in">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-black text-slate-800">تعريف رتبة جديدة</h3>
                            <button onClick={() => setIsAddRoleModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            <label className="block text-xs font-black text-slate-500 mb-2">اسم الرتبة (باللغة الإنجليزية غالباً لسهولة الربط)</label>
                            <input type="text" className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 text-center font-bold" placeholder="مثلاً: supervisor" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} />
                            <button onClick={handleAddRole} className="w-full mt-6 py-3 bg-slate-800 text-white rounded-xl font-black hover:bg-slate-900 shadow-lg">إنشاء الرتبة</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Change Password */}
            {isChangePasswordModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-sm overflow-hidden animate-scale-in">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center text-right">
                            <h3 className="font-black text-slate-800">تغيير كلمة مرور: {passwordData.userName}</h3>
                            <button onClick={() => setIsChangePasswordModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            <label className="block text-xs font-black text-slate-500 mb-2">كلمة المرور الجديدة</label>
                            <input type="text" className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 text-center font-bold" value={passwordData.newPassword} onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})} />
                            <button onClick={handleUpdatePassword} className="w-full mt-6 py-3 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 shadow-lg">تحديث كلمة المرور</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Change Role */}
            {isChangeRoleModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-sm overflow-hidden animate-scale-in">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-black text-slate-800">تعديل رتبة: {roleUpdateData.userName}</h3>
                            <button onClick={() => setIsChangeRoleModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            <label className="block text-xs font-black text-slate-500 mb-2">اختر الرتبة الجديدة</label>
                            <select className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" value={roleUpdateData.newRole} onChange={e => setRoleUpdateData({...roleUpdateData, newRole: e.target.value})}>
                                {/* Fix: cast Object.entries(roles) to any to handle dynamic role value property access */}
                                {(Object.entries(roles) as [string, any][]).map(([key, details]) => <option key={key} value={key}>{details.label}</option>)}
                            </select>
                            <button onClick={handleUpdateRole} className="w-full mt-6 py-3 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 shadow-lg">حفظ الرتبة الجديدة</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Delete User */}
            {isDeleteUserModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-sm overflow-hidden animate-scale-in border border-red-100">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-sm"><AlertTriangle size={32} /></div>
                            <h3 className="text-xl font-black text-slate-800 mb-2">حذف المستخدم نهائياً؟</h3>
                            <p className="text-sm text-slate-500 mb-6 font-bold leading-relaxed px-4">أنت على وشك حذف حساب الموظف <span className="text-red-600">{deleteUserData.userName}</span>. يرجى تأكيد العملية عبر إدخال رمز التحقق (1234).</p>
                            
                            <input type="password" className="w-full p-3 border border-slate-200 rounded-xl text-center font-mono text-xl focus:ring-4 focus:ring-red-50 outline-none transition-all mb-4" placeholder="رمز التحقق" value={deleteUserData.confirmPassword} onChange={e => setDeleteUserData({...deleteUserData, confirmPassword: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleDeleteUser()} />
                            {modalError && <p className="text-xs text-red-500 font-bold mb-4">{modalError}</p>}
                            
                            <div className="flex gap-3">
                                <button onClick={() => setIsDeleteUserModalOpen(false)} className="flex-1 py-3 bg-slate-50 text-slate-500 font-bold rounded-xl transition-all">إلغاء</button>
                                <button onClick={handleDeleteUser} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black shadow-lg shadow-red-100 hover:bg-red-700 transition-all">تأكيد الحذف</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PermissionsManagement;
