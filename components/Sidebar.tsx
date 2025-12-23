
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  ShoppingBag, 
  Package, 
  Wallet, 
  Users, 
  Banknote, 
  FileText,
  LogOut,
  Server,
  PieChart,
  ShieldCheck,
  History,
  Database,
  LockKeyhole
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';

const Sidebar = () => {
  const { logout } = useAuth();
  const { hasPageAccess } = usePermissions();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'لوحة التحكم', pKey: 'dashboard' },
    { to: '/sales', icon: ShoppingCart, label: 'تقفيل المبيعات اليومي', pKey: 'sales' },
    { to: '/terminals', icon: Server, label: 'أجهزة الشبكة', pKey: 'terminals' },
    { to: '/purchases', icon: ShoppingBag, label: 'المشتريات', pKey: 'purchases' },
    { to: '/inventory', icon: Package, label: 'المخزون', pKey: 'inventory' },
    { to: '/custody', icon: Wallet, label: 'العهد المالية', pKey: 'custody' },
    { to: '/general-expenses', icon: PieChart, label: 'المصاريف العامة', pKey: 'general_expenses' },
    { to: '/suppliers', icon: Users, label: 'الموردين', pKey: 'suppliers' },
    { to: '/salaries', icon: Banknote, label: 'الرواتب', pKey: 'salaries' },
    { to: '/retroactive', icon: History, label: 'الأثر الرجعي', pKey: 'retroactive' },
    { to: '/reports', icon: FileText, label: 'التقارير الذكية', pKey: 'reports' },
    { to: '/backups', icon: Database, label: 'النسخ الاحتياطية', pKey: 'backups' },
    { to: '/audit-logs', icon: ShieldCheck, label: 'سجل الحركات', pKey: 'audit_logs' },
    { to: '/permissions', icon: LockKeyhole, label: 'إدارة الصلاحيات', pKey: 'permissions' },
  ];

  const allowedItems = navItems.filter(item => hasPageAccess(item.pKey));

  return (
    <div className="w-64 bg-slate-900 text-white min-h-screen flex flex-col shadow-xl print:hidden sticky top-0" dir="rtl">
      <div className="p-6 border-b border-slate-800 flex items-center justify-center">
        <div className="text-2xl font-bold text-indigo-400">Mirfad | مِرفـــاد</div>
      </div>
      
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
        {allowedItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold text-sm ${
                isActive 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={18} className={isActive ? 'text-white' : 'text-indigo-400'} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-950/30">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors font-bold text-sm"
        >
          <LogOut size={18} />
          <span>تسجيل الخروج</span>
        </button>
        <div className="mt-4 text-[9px] text-center text-slate-600 uppercase tracking-widest font-black">
           Governance System v1.5.0
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
