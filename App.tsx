
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { Bell, AlertTriangle, Loader2 } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import Sales from './views/Sales';
import Terminals from './views/Terminals';
import Purchases from './views/Purchases';
import CreatePurchase from './views/CreatePurchase';
import PurchaseDetails from './views/PurchaseDetails';
import DailyClosingDetails from './views/DailyClosingDetails';
import Inventory from './views/Inventory';
import Custody from './views/Custody';
import Suppliers from './views/Suppliers';
import SupplierStatement from './views/SupplierStatement';
import Salaries from './views/Salaries';
import Reports from './views/Reports';
import Backups from './views/Backups';
import GeneralExpenses from './views/GeneralExpenses';
import Login from './views/Login';
import AuditLogs from './views/AuditLogs';
import Retroactive from './views/Retroactive';
import PermissionsManagement from './views/PermissionsManagement';
import MonthlyPurchasesReport from './views/MonthlyPurchasesReport';
import { useAuth } from './context/AuthContext';
import { usePermissions } from './context/PermissionsContext';
import ProtectedRoute from './components/ProtectedRoute';
import { supabase } from './services/supabaseClient';

const AppLayout = () => {
  const { user } = useAuth();
  const { isLoading: permsLoading } = usePermissions();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [lowStockItems, setLowStockItems] = useState<{id: string, name: string, quantity: number}[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     const fetchAlerts = async () => {
         const { data } = await supabase.from('products').select('id, name, quantity').lt('quantity', 5);
         if (data) setLowStockItems(data);
     };
     fetchAlerts();
     
     const channel = supabase.channel('app-alerts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchAlerts)
        .subscribe();
     return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, []);

  if (permsLoading) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-4">
              <Loader2 className="animate-spin text-indigo-600" size={48} />
              <p className="text-slate-500 font-bold">جاري تحميل إعدادات الحوكمة...</p>
          </div>
      );
  }
  
  return (
    <div className="flex flex-row min-h-screen bg-slate-50 text-slate-800">
      <Sidebar />
      <main className="flex-1 overflow-auto h-screen">
        <header className="bg-white shadow-sm sticky top-0 z-10 px-8 py-4 flex justify-between items-center print:hidden">
          <h1 className="text-xl font-bold text-slate-700">نظام مِرفاد للموارد</h1>
          
          <div className="flex items-center gap-6">
            <div className="relative" ref={notifRef}>
                <button 
                    onClick={() => setNotificationsOpen(!notificationsOpen)} 
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors relative"
                >
                    <Bell size={22} />
                    {lowStockItems.length > 0 && (
                        <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                        </span>
                    )}
                </button>

                {notificationsOpen && (
                    <div className="absolute left-0 mt-3 w-80 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in origin-top-left text-right" dir="rtl">
                        <div className="p-4 border-b border-slate-50 bg-slate-50 flex justify-between items-center">
                            <h4 className="font-bold text-slate-700 text-sm">التنبيهات</h4>
                            {lowStockItems.length > 0 && (
                                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{lowStockItems.length} نفاد مخزون</span>
                            )}
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                            {lowStockItems.length > 0 ? (
                                <div className="divide-y divide-slate-50">
                                    {lowStockItems.map(item => (
                                        <Link 
                                            key={item.id} 
                                            to="/inventory" 
                                            onClick={() => setNotificationsOpen(false)}
                                            className="p-4 hover:bg-slate-50 flex items-start gap-3 transition-colors block"
                                        >
                                            <div className="p-2 bg-red-50 text-red-500 rounded-lg shrink-0">
                                                <AlertTriangle size={16} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{item.name}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">الكمية المتبقية: <span className="font-bold text-red-600">{item.quantity}</span></p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center">
                                    <p className="text-sm text-slate-500">لا توجد تنبيهات حالياً</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4 border-r border-slate-100 pr-6">
                <div className="text-right">
                <span className="block text-sm font-bold text-slate-700">{user?.name}</span>
                <span className="block text-[10px] text-slate-400 uppercase font-black">{user?.role}</span>
                </div>
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold border-2 border-white shadow-sm">
                {user?.name.charAt(0)}
                </div>
            </div>
          </div>
        </header>
        <div className="p-8 print:p-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<ProtectedRoute />}>
           <Route element={<AppLayout />}>
              <Route path="/" element={<ProtectedRoute permissionKey="dashboard"><Dashboard /></ProtectedRoute>} />
              <Route path="/sales" element={<ProtectedRoute permissionKey="sales"><Sales /></ProtectedRoute>} />
              <Route path="/sales/:id" element={<ProtectedRoute permissionKey="sales"><DailyClosingDetails /></ProtectedRoute>} />
              <Route path="/terminals" element={<ProtectedRoute permissionKey="terminals"><Terminals /></ProtectedRoute>} />
              <Route path="/purchases" element={<ProtectedRoute permissionKey="purchases"><Purchases /></ProtectedRoute>} />
              <Route path="/purchases/new" element={<ProtectedRoute permissionKey="purchases"><CreatePurchase /></ProtectedRoute>} />
              <Route path="/purchases/edit/:id" element={<ProtectedRoute permissionKey="purchases"><CreatePurchase /></ProtectedRoute>} />
              <Route path="/purchases/:id" element={<ProtectedRoute permissionKey="purchases"><PurchaseDetails /></ProtectedRoute>} />
              <Route path="/monthly-purchases" element={<ProtectedRoute permissionKey="monthly_purchases"><MonthlyPurchasesReport /></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute permissionKey="inventory"><Inventory /></ProtectedRoute>} />
              <Route path="/custody" element={<ProtectedRoute permissionKey="custody"><Custody /></ProtectedRoute>} />
              <Route path="/general-expenses" element={<ProtectedRoute permissionKey="general_expenses"><GeneralExpenses /></ProtectedRoute>} />
              <Route path="/suppliers" element={<ProtectedRoute permissionKey="suppliers"><Suppliers /></ProtectedRoute>} />
              <Route path="/suppliers/:id" element={<ProtectedRoute permissionKey="suppliers"><SupplierStatement /></ProtectedRoute>} />
              <Route path="/salaries" element={<ProtectedRoute permissionKey="salaries"><Salaries /></ProtectedRoute>} />
              <Route path="/retroactive" element={<ProtectedRoute permissionKey="retroactive"><Retroactive /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute permissionKey="reports"><Reports /></ProtectedRoute>} />
              <Route path="/backups" element={<ProtectedRoute permissionKey="backups"><Backups /></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute permissionKey="audit_logs"><AuditLogs /></ProtectedRoute>} />
              <Route path="/permissions" element={<ProtectedRoute permissionKey="permissions"><PermissionsManagement /></ProtectedRoute>} />
              
              <Route path="*" element={<Navigate to="/" replace />} />
           </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;
