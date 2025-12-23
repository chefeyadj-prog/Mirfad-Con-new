
import React, { useState, useEffect } from 'react';
import { LockKeyhole, UserCog, ShieldCheck, ShieldAlert, CheckCircle2, Loader2, Search, UserCheck, Shield, Settings2, X, Trash2, Plus, AlertCircle, Key, UserPlus, ShieldPlus, LayoutDashboard, ShoppingCart, Server, ShoppingBag, Package, Wallet, PieChart, Users, Banknote, History, FileText, Database, ShieldCheck as AuditIcon, Sparkles, UserRoundCog } from 'lucide-react';
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
        label: '1- لوحة التحكم',
        icon: LayoutDashboard,
        features: {
            canFilter: 'السماح بالتحكم بالفلتر',
            showTotalSales: 'إظهار إجمالي المبيعات',
            showTotalCash: 'إظهار إجمالي الكاش (الفعلي) المبيعات',
            showTotalPurchases: 'إظهار إجمالي المشتريات المبيعات',
            showTotalOutgoings: 'إظهار إجمالي المصروفات والمشتريات',
            showExpenseDistribution: 'إظهار توزيع المصاريف (الفترة المحددة)',
            showSalesChart: 'إظهار حركة المبيعات والتدفقات الخارجة'
        }
    },
    sales: {
        label: '2- تقفيل المبيعات اليومي',
        icon: ShoppingCart,
        features: {
            canAdd: 'ظهور زر تسجيل إقفال جديد',
            showList: 'ظهور سجل الإقفالات اليومية (Z-Reports)',
            showGrandTotal: 'ظهور الإجمالي الكلي',
            canEdit: 'إمكانية التعديل',
            canDelete: 'إمكانية حذف',
            canView: 'إمكانية المعاينة',
            canExport: 'إمكانية تصدير Excel',
            canFilter: 'إمكانية الفلتر',
            canSearch: 'إمكانية البحث'
        }
    },
    terminals: {
        label: '3- أجهزة الشبكة (POS)',
        icon: Server,
        features: {
            canAdd: 'إمكانية إضافة جهاز جديد',
            showActions: 'إمكانية ظهور إجراءات',
            canExport: 'إمكانية تصدير Excel',
            canDelete: 'إمكانية حذف جهاز',
            canEdit: 'إمكانية تعديل جهاز'
        }
    },
    purchases: {
        label: '4- المشتريات',
        icon: ShoppingBag,
        features: {
            canAdd: 'إمكانية إضافة فاتورة مشتريات جديد',
            canExport: 'إمكانية تصدير Excel',
            canDelete: 'إمكانية حذف',
            canEdit: 'إمكانية تعديل',
            canFilter: 'إمكانية الفلتر',
            canSearch: 'إمكانية البحث',
            showList: 'ظهور سجل الفواتير المسجلة'
        }
    },
    inventory: {
        label: '5- المخزون',
        icon: Package,
        features: {
            canAdd: 'إمكانية إضافة منتج جديد',
            canExport: 'إمكانية تصدير',
            canDelete: 'إمكانية حذف',
            canEdit: 'إمكانية تعديل',
            canFilter: 'إمكانية الفلتر',
            canSearch: 'إمكانية البحث'
        }
    },
    custody: {
        label: '6- العهد المالية',
        icon: Wallet,
        features: {
            canAdd: 'إمكانية إنشاء عهدة جديدة',
            canClose: 'إمكانية إقفال العهدة وتصفية الحساب'
        }
    },
    general_expenses: {
        label: '7- المصاريف العامة',
        icon: PieChart,
        features: {
            canAdd: 'إمكانية تسجيل مصروف جديد',
            canExport: 'إمكانية تصدير Excel',
            canDelete: 'إمكانية حذف',
            canEdit: 'إمكانية تعديل',
            canFilter: 'إمكانية الفلتر',
            canSearch: 'إمكانية البحث',
            showList: 'ظهور المصاريف العامة والتشغيلية المسجلة'
        }
    },
    suppliers: {
        label: '8- الموردين',
        icon: Users,
        features: {
            canAdd: 'إمكانية إضافة مورد جديد',
            canDelete: 'إمكانية حذف',
            canEdit: 'إمكانية تعديل',
            canPay: 'إمكانية دفع المستحقات'
        }
    },
    salaries: { label: '9- الرواتب', icon: Banknote, features: { canView: 'دخول الصفحة' } },
    retroactive: { label: '10- الأثر الرجعي', icon: History, features: { canView: 'دخول الصفحة' } },
    reports: { label: '11- التقرير الذكي', icon: FileText, features: { canView: 'دخول الصفحة' } },
    backups: { label: '12- النسخة الاحتياطية', icon: Database, features: { canView: 'دخول الصفحة' } },
    audit_logs: { label: '13- سجل الحركات', icon: AuditIcon, features: { canView: 'دخول الصفحة' } },
    permissions: { label: '14- إدارة الصلاحيات', icon: LockKeyhole, features: { canView: 'دخول الصفحة' } },
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
    const [isSeeding, setIsSeeding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
    
    // Modals
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<string | null>(null);
    const [tempPermissions, setTempPermissions] = useState<Record<string, PagePermissions>>({});
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
    const [isChangeRoleModalOpen, setIsChangeRoleModalOpen] = useState(false);

    // Form data
    const [newUser, setNewUser] = useState({ full_name: '', email: '', role: 'cashier', password: '' });
    const [newRoleName, setNewRoleName] = useState('');
    const [passwordData, setPasswordData] = useState({ userId: '', userName: '', newPassword: '' });
    const [roleUpdateData, setRoleUpdateData] = useState({ userId: '', userName: '', currentRole: '', newRole: '' });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: usersData } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
            if (usersData) setUsers(usersData);

            const { data: permsData } = await supabase.from('role_permissions').select('role');
            if (permsData) {
                const mergedRoles = { ...roles };
                permsData.forEach(p => {
                    if (!mergedRoles[p.role]) {
                        mergedRoles[p.role] = { label: p.role, color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Settings2 };
                    }
                });
                setRoles(mergedRoles);
            }
        } catch (err) {
            console.error("Fetch Error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSeedAdmins = async () => {
        setIsSeeding(true);
        try {
            for (const admin of SYSTEM_ADMINS) {
                const exists = users.some(u => u.email.toLowerCase() === admin.email.toLowerCase());
                if (!exists) {
                    await supabase.from('user_profiles').insert({
                        id: `SYS-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        full_name: admin.name,
                        email: admin.email,
                        role: admin.role,
                        password: '123456'
                    });
                }
            }
            await logAction(currentUser, 'create', 'المستخدمين', 'تهيئة حسابات المسؤولين النظاميين');
            setMessage({ text: 'تمت تهيئة حسابات المسؤولين بنجاح بكلمة مرور افتراضية (123456)', type: 'success' });
            fetchData();
        } catch (err: any) {
            setMessage({ text: 'خطأ أثناء التهيئة: ' + err.message, type: 'error' });
        } finally {
            setIsSeeding(false);
        }
    };

    const handleAddUser = async () => {
        if (!newUser.full_name || !newUser.email || !newUser.password) {
            alert("يرجى إكمال كافة البيانات بما فيها كلمة المرور");
            return;
        }
        setIsLoading(true);
        try {
            const { error } = await supabase.from('user_profiles').upsert({
                id: `USR-${Date.now()}`,
                full_name: newUser.full_name,
                email: newUser.email.toLowerCase().trim(),
                role: newUser.role,
                password: newUser.password
            }, { onConflict: 'email' });
            if (error) throw error;
            await logAction(currentUser, 'create', 'المستخدمين', `إضافة مستخدم: ${newUser.full_name}`);
            setMessage({ text: 'تمت إضافة المستخدم بنجاح', type: 'success' });
            setIsAddUserModalOpen(false);
            setNewUser({ full_name: '', email: '', role: 'cashier', password: '' });
            fetchData();
        } catch (err: any) { setMessage({ text: 'خطأ: ' + err.message, type: 'error' }); }
        finally { setIsLoading(false); }
    };

    const handleUpdatePassword = async () => {
        if (!passwordData.newPassword) return;
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ password: passwordData.newPassword })
                .eq('id', passwordData.userId);
            
            if (error) throw error;
            await logAction(currentUser, 'update', 'المستخدمين', `تغيير كلمة مرور المستخدم: ${passwordData.userName}`);
            setMessage({ text: 'تم تحديث كلمة المرور بنجاح', type: 'success' });
            setIsChangePasswordModalOpen(false);
            fetchData();
        } catch (err: any) {
            alert("فشل التحديث: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateRole = async () => {
        if (!roleUpdateData.newRole) return;
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ role: roleUpdateData.newRole })
                .eq('id', roleUpdateData.userId);
            
            if (error) throw error;
            await logAction(currentUser, 'update', 'المستخدمين', `تغيير رتبة المستخدم ${roleUpdateData.userName} من ${roleUpdateData.currentRole} إلى ${roleUpdateData.newRole}`);
            setMessage({ text: 'تم تحديث الرتبة بنجاح', type: 'success' });
            setIsChangeRoleModalOpen(false);
            fetchData();
        } catch (err: any) {
            alert("فشل تحديث الرتبة: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteUser = async (id: string, name: string) => {
        if (!window.confirm(`هل أنت متأكد من حذف المستخدم ${name}؟`)) return;
        try {
            await supabase.from('user_profiles').delete().eq('id', id);
            await logAction(currentUser, 'delete', 'المستخدمين', `حذف المستخدم: ${name}`);
            setUsers(users.filter(u => u.id !== id));
            setMessage({ text: 'تم حذف المستخدم بنجاح', type: 'success' });
        } catch (err) {}
    };

    const handleAddRole = () => {
        if (!newRoleName) return;
        const roleKey = newRoleName.toLowerCase().replace(/\s+/g, '_');
        setRoles(prev => ({
            ...prev,
            [roleKey]: { label: newRoleName, color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Settings2 }
        }));
        setIsAddRoleModalOpen(false);
        setNewRoleName('');
        openRolePermissions(roleKey);
    };

    const handleDeleteRole = async (roleKey: string) => {
        if (['it', 'owner', 'admin'].includes(roleKey)) {
            alert("لا يمكن حذف الرتب الأساسية للنظام");
            return;
        }
        if (!window.confirm(`حذف رتبة ${roles[roleKey].label} سيمسح صلاحياتها المسجلة. هل أنت متأكد؟`)) return;
        
        await supabase.from('role_permissions').delete().eq('role', roleKey);
        const newRoles = { ...roles };
        delete newRoles[roleKey];
        setRoles(newRoles);
        setMessage({ text: 'تم حذف الرتبة بنجاح', type: 'success' });
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
            initial[key] = { 
                show: data?.permissions?.[key]?.show ?? true, 
                features 
            };
        });

        setTempPermissions(initial);
        setIsLoading(false);
        setIsRoleModalOpen(true);
    };

    const handleSaveRolePermissions = async () => {
        if (!selectedRoleForPerms) return;
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('role_permissions')
                .upsert({ role: selectedRoleForPerms, permissions: tempPermissions }, { onConflict: 'role' });
            if (error) throw error;
            await logAction(currentUser, 'update', 'الصلاحيات', `تعديل صلاحيات رتبة ${selectedRoleForPerms}`);
            setMessage({ text: 'تم حفظ الصلاحيات بنجاح', type: 'success' });
            setIsRoleModalOpen(false);
        } catch (err: any) {
            setMessage({ text: 'فشل الحفظ: تأكد من وجود جدول role_permissions', type: 'error' });
        } finally {
            setIsLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const missingAdmins = SYSTEM_ADMINS.filter(admin => !users.some(u => u.email.toLowerCase() === admin.email.toLowerCase()));

    return (
        <div className="max-w-7xl mx-auto pb-20 animate-fade-in text-right" dir="rtl">
            {/* Header Area */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                        <LockKeyhole size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">إدارة حوكمة النظام والصلاحيات</h2>
                        <p className="text-slate-500 text-sm mt-1">التحكم المركزي في المستخدمين، الرتب، وكلمات المرور</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsAddUserModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">
                        <UserPlus size={18} /> إضافة مستخدم
                    </button>
                    <button onClick={() => setIsAddRoleModalOpen(true)} className="bg-slate-800 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-900 shadow-lg shadow-slate-100 transition-all">
                        <ShieldPlus size={18} /> رتبة جديدة
                    </button>
                </div>
            </div>

            {missingAdmins.length > 0 && (
                <div className="mb-6 bg-indigo-50 border-2 border-indigo-200 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse">
                    <div className="flex items-center gap-3">
                        <Sparkles className="text-indigo-600" />
                        <div>
                            <p className="font-black text-indigo-900 text-sm">نظام مِرفاد: اكتشفنا حسابات مسؤولين غير مفعلة في السجل</p>
                            <p className="text-indigo-600 text-xs font-bold">هل تريد إضافة أحمد، كمال، وماجد تلقائياً لتتمكن من إدارتهم؟</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleSeedAdmins}
                        disabled={isSeeding}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-xs shadow-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSeeding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        تفعيل حسابات المسؤولين الآن
                    </button>
                </div>
            )}

            {message && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 border-2 animate-slide-up ${
                    message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                    {message.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                    <p className="font-bold">{message.text}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Users List */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 font-black text-slate-700 flex justify-between items-center">
                        <div className="flex items-center gap-2"><UserCog size={20} /> سجل المستخدمين الفعالين</div>
                        <div className="relative">
                            <Search className="absolute right-3 top-2 text-slate-400" size={14} />
                            <input type="text" placeholder="بحث..." className="pr-8 pl-3 py-1 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <table className="w-full text-right">
                        <thead className="bg-slate-50 text-slate-500 text-xs font-bold border-b border-slate-100 uppercase">
                            <tr>
                                <th className="p-4">الموظف</th>
                                <th className="p-4">الرتبة</th>
                                <th className="p-4 text-center">الإجراء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.filter(u => u.full_name.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
                                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-black text-sm">{u.full_name.charAt(0)}</div>
                                            <div>
                                                <p className="font-black text-slate-800 text-sm">{u.full_name}</p>
                                                <p className="text-[10px] text-slate-400 font-mono">{u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${roles[u.role]?.color || 'bg-slate-100'}`}>
                                            {roles[u.role]?.label || u.role}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex justify-center gap-1">
                                            <button onClick={() => { setRoleUpdateData({ userId: u.id, userName: u.full_name, currentRole: u.role, newRole: u.role }); setIsChangeRoleModalOpen(true); }} className="text-slate-400 hover:text-emerald-600 p-2" title="تغيير الرتبة"><UserRoundCog size={16} /></button>
                                            <button onClick={() => { setPasswordData({ userId: u.id, userName: u.full_name, newPassword: '' }); setIsChangePasswordModalOpen(true); }} className="text-slate-400 hover:text-indigo-600 p-2" title="تغيير كلمة المرور"><Key size={16} /></button>
                                            <button onClick={() => handleDeleteUser(u.id, u.full_name)} className="text-slate-400 hover:text-red-500 p-2" title="حذف"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Roles List */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden h-fit">
                    <div className="p-4 bg-indigo-50 border-b border-indigo-100 font-black text-indigo-800 flex items-center gap-2">
                        <Settings2 size={20} /> إدارة صلاحيات الرتب
                    </div>
                    <div className="p-4 space-y-3">
                        {Object.entries(roles).map(([key, details]) => (
                            <div key={key} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${details.color}`}><details.icon size={18} /></div>
                                    <span className="font-black text-slate-700 text-sm">{details.label}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openRolePermissions(key)} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all">تعديل</button>
                                    {!['it', 'owner', 'admin'].includes(key) && (
                                        <button onClick={() => handleDeleteRole(key)} className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modal: Add User */}
            {isAddUserModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-md overflow-hidden animate-scale-in">
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-black text-slate-800">إضافة مستخدم جديد</h3>
                            <button onClick={() => setIsAddUserModalOpen(false)}><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4 text-right">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">الاسم الكامل</label>
                                <input type="text" className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" value={newUser.full_name} onChange={e => setNewUser({...newUser, full_name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">البريد الإلكتروني</label>
                                <input type="email" className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">تعيين الرتبة</label>
                                    <select className="w-full p-2.5 border border-slate-200 rounded-xl outline-none bg-white font-bold" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                                        {Object.entries(roles).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-indigo-600 mb-1">كلمة المرور</label>
                                    <input type="text" className="w-full p-2.5 border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold bg-indigo-50/30" placeholder="مثلاً: 123456" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 flex justify-end gap-2">
                            <button onClick={() => setIsAddUserModalOpen(false)} className="px-4 py-2 font-bold text-slate-400">إلغاء</button>
                            <button onClick={handleAddUser} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black shadow-md">حفظ المستخدم</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Change Password */}
            {isChangePasswordModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in border border-slate-200">
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-black text-slate-800 flex items-center gap-2"><Key size={18} className="text-indigo-600" /> تحديث كلمة المرور</h3>
                            <button onClick={() => setIsChangePasswordModalOpen(false)}><X size={20} /></button>
                        </div>
                        <div className="p-6 text-center">
                            <p className="text-sm text-slate-500 mb-4 font-bold">تعديل كلمة مرور: <span className="text-indigo-600">{passwordData.userName}</span></p>
                            <label className="block text-xs font-black text-slate-500 mb-2">كلمة المرور الجديدة</label>
                            <input 
                                type="text" 
                                autoFocus
                                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-50 font-bold text-center text-lg"
                                placeholder="أدخل الرقم السري الجديد"
                                value={passwordData.newPassword}
                                onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                            />
                            <p className="text-[10px] text-slate-400 mt-3">سيتمكن الموظف من استخدام الرقم الجديد فور الحفظ.</p>
                        </div>
                        <div className="p-4 bg-slate-50 flex gap-2">
                            <button onClick={() => setIsChangePasswordModalOpen(false)} className="flex-1 py-2 font-bold text-slate-400">إلغاء</button>
                            <button onClick={handleUpdatePassword} className="flex-1 bg-indigo-600 text-white py-2 rounded-xl font-black shadow-md">تحديث الآن</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Change Role */}
            {isChangeRoleModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in border border-slate-200">
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-black text-slate-800 flex items-center gap-2"><UserRoundCog size={18} className="text-emerald-600" /> تعديل الرتبة الوظيفية</h3>
                            <button onClick={() => setIsChangeRoleModalOpen(false)}><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-slate-500 mb-4 font-bold">المستخدم: <span className="text-indigo-600">{roleUpdateData.userName}</span></p>
                            <label className="block text-xs font-black text-slate-500 mb-2">اختر الرتبة الجديدة</label>
                            <select 
                                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-50 font-bold bg-white text-slate-700"
                                value={roleUpdateData.newRole}
                                onChange={e => setRoleUpdateData({...roleUpdateData, newRole: e.target.value})}
                            >
                                {Object.entries(roles).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
                                * تغيير الرتبة سيؤدي فوراً لتغيير صلاحيات الوصول لهذا المستخدم بناءً على إعدادات الحوكمة.
                            </p>
                        </div>
                        <div className="p-4 bg-slate-50 flex gap-2">
                            <button onClick={() => setIsChangeRoleModalOpen(false)} className="flex-1 py-2 font-bold text-slate-400">إلغاء</button>
                            <button onClick={handleUpdateRole} className="flex-1 bg-emerald-600 text-white py-2 rounded-xl font-black shadow-md">تغيير الرتبة</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Add Role */}
            {isAddRoleModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-black text-slate-800">إنشاء رتبة جديدة</h3>
                            <button onClick={() => setIsAddRoleModalOpen(false)}><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            <label className="block text-xs font-bold text-slate-500 mb-2">اسم الرتبة الوظيفية</label>
                            <input type="text" className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="مثال: مشرف مستودع" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} />
                        </div>
                        <div className="p-4 bg-slate-50 flex justify-end gap-2">
                            <button onClick={handleAddRole} className="bg-indigo-600 text-white w-full py-3 rounded-xl font-black shadow-md">إنشاء الرتبة</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Detailed Permissions Editor */}
            {isRoleModalOpen && selectedRoleForPerms && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[90vh] flex flex-col overflow-hidden animate-scale-in text-right" dir="rtl">
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-xl ${roles[selectedRoleForPerms]?.color || 'bg-slate-100'}`}><UserCog size={24} /></div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-lg">تعديل حوكمة: {roles[selectedRoleForPerms]?.label || selectedRoleForPerms}</h3>
                                    <p className="text-xs text-slate-400 font-bold">تحديد دقيق لظهور الصفحات والخصائص (تبعِيّة كاملة)</p>
                                </div>
                            </div>
                            <button onClick={() => setIsRoleModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                            {Object.entries(PERMISSIONS_SCHEMA).map(([pageKey, pageData]) => {
                                const isShowEnabled = tempPermissions?.[pageKey]?.show;
                                const Icon = pageData.icon;

                                return (
                                    <div key={pageKey} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                        <div className={`p-4 flex items-center justify-between border-b border-slate-100 ${isShowEnabled ? 'bg-white' : 'bg-slate-50'}`}>
                                            <div className="flex items-center gap-4">
                                                <div 
                                                    className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer ${isShowEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                                    onClick={() => setTempPermissions(prev => ({ ...prev, [pageKey]: { ...prev[pageKey], show: !isShowEnabled } }))}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${isShowEnabled ? 'right-1' : 'right-7'}`}></div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-lg ${isShowEnabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}><Icon size={18} /></div>
                                                    <span className={`font-black ${isShowEnabled ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{pageData.label}</span>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isShowEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{isShowEnabled ? 'مفعلة' : 'مخفية بالكامل'}</span>
                                        </div>

                                        <div className={`p-4 grid grid-cols-1 md:grid-cols-2 gap-3 transition-all ${!isShowEnabled && 'pointer-events-none grayscale opacity-40'}`}>
                                            {Object.entries(pageData.features).map(([fKey, fLabel]) => {
                                                const isChecked = tempPermissions?.[pageKey]?.features?.[fKey];
                                                return (
                                                    <div key={fKey} onClick={() => setTempPermissions(prev => ({...prev, [pageKey]: {...prev[pageKey], features: {...prev[pageKey].features, [fKey]: !isChecked}}}))} className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer ${isChecked ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                                                        <span className={`text-xs font-bold ${isChecked ? 'text-indigo-900' : 'text-slate-50'}`}>{fLabel}</span>
                                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200'}`}>{isChecked && <CheckCircle2 size={14} className="text-white" />}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
                            <button onClick={() => setIsRoleModalOpen(false)} className="px-6 py-2 text-slate-600 font-bold">إلغاء</button>
                            <button onClick={handleSaveRolePermissions} disabled={isLoading} className="px-10 py-2 bg-indigo-600 text-white rounded-xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50">
                                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />} حفظ وإعتماد الصلاحيات
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PermissionsManagement;
