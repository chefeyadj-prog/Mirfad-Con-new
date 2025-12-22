
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
  CalendarCheck,
  ShieldCheck,
  History
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const allNavItems = [
    { to: '/', icon: LayoutDashboard, label: 'لوحة التحكم', roles: ['owner', 'admin', 'accountant', 'cashier'] },
    { to: '/sales', icon: ShoppingCart, label: 'تقفيل المبيعات اليومي', roles: ['owner', 'admin', 'cashier', 'chef'] },
    { to: '/terminals', icon: Server, label: 'أجهزة الشبكة', roles: ['owner', 'admin', 'accountant'] },
    { to: '/purchases', icon: ShoppingBag, label: 'المشتريات', roles: ['owner', 'admin', 'accountant'] },
    { to: '/monthly-purchases', icon: CalendarCheck, label: 'تقرير مشتريات شهر', roles: ['owner', 'admin', 'accountant'] },
    { to: '/inventory', icon: Package, label: 'المخزون', roles: ['owner', 'admin', 'accountant', 'cashier'] },
    { to: '/custody', icon: Wallet, label: 'العهد المالية', roles: ['owner', 'admin', 'cashier'] },
    { to: '/general-expenses', icon: PieChart, label: 'المصاريف العامة', roles: ['owner', 'admin', 'accountant'] },
    { to: '/suppliers', icon: Users, label: 'الموردين', roles: ['owner', 'admin', 'accountant'] },
    { to: '/salaries', icon: Banknote, label: 'الرواتب', roles: ['owner', 'admin', 'accountant'] },
    { to: '/retroactive', icon: History, label: 'الأثر الرجعي', roles: ['owner', 'admin', 'accountant'] },
    { to: '/reports', icon: FileText, label: 'التقارير الذكية', roles: ['owner'] },
    { to: '/audit-logs', icon: ShieldCheck, label: 'سجل الحركات', roles: ['owner'] },
  ];

  // Filter items based on user role
  const allowedItems = allNavItems.filter(item => user && item.roles.includes(user.role));

  return (
    <div className="w-64 bg-slate-900 text-white min-h-screen flex flex-col shadow-xl print:hidden">
      <div className="p-6 border-b border-slate-700 flex items-center justify-center">
        <div className="text-2xl font-bold text-indigo-400">Mirfad | مِرفـــاد</div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {allowedItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">تسجيل الخروج</span>
        </button>
        <div className="mt-4 text-xs text-center text-slate-500">
           الإصدار 1.2.6
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
