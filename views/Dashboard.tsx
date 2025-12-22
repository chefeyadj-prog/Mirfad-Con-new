
import React, { useState, useEffect } from 'react';
import { DollarSign, ShoppingCart, TrendingDown, Banknote, PieChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/StatCard';
import DateFilter, { DateRange, getThisMonthRange } from '../components/DateFilter';
import { supabase } from '../services/supabaseClient';
import { DailyClosing, Purchase, GeneralExpense } from '../types';
import { useAuth } from '../context/AuthContext';
import { round } from '../utils/mathUtils';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === 'chef') {
      navigate('/sales');
    }
  }, [user, navigate]);

  const [stats, setStats] = useState({
    totalSales: 0,
    totalCashSales: 0,
    totalPurchases: 0,
    totalOutgoings: 0 // Combined Purchases + General Expenses
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>(getThisMonthRange());
  const [allClosings, setAllClosings] = useState<DailyClosing[]>([]);
  const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
  const [allExpenses, setAllExpenses] = useState<GeneralExpense[]>([]);

  const fetchData = async () => {
    const { data: closingsData } = await supabase.from('dailyClosings').select('*');
    if (closingsData) setAllClosings(closingsData);

    const { data: purchasesData } = await supabase.from('purchases').select('*');
    if (purchasesData) setAllPurchases(purchasesData);

    const { data: expensesData } = await supabase.from('general_expenses').select('*');
    if (expensesData) setAllExpenses(expensesData);
  };

  useEffect(() => {
    if (user?.role !== 'chef') {
        fetchData();
        const channels = supabase.channel('dashboard-realtime-v2')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dailyClosings' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'general_expenses' }, fetchData)
            .subscribe();
        return () => { supabase.removeChannel(channels); };
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'chef') return;

    const filterByDate = (itemDateStr: string) => {
        if (!dateRange.start || !dateRange.end) return true;
        const itemDate = new Date(itemDateStr);
        return itemDate >= dateRange.start && itemDate <= dateRange.end;
    };

    const filteredClosings = allClosings.filter(c => filterByDate(c.date));
    const filteredPurchases = allPurchases.filter(p => filterByDate(p.date));
    const filteredExpenses = allExpenses.filter(e => filterByDate(e.date));

    const totalSales = round(filteredClosings.reduce((sum, item) => sum + (item.grossSales || item.totalSystem || 0), 0));
    const totalCashSales = round(filteredClosings.reduce((sum, item) => sum + (item.cashActual || 0), 0));
    const totalPurchases = round(filteredPurchases.reduce((sum, item) => sum + item.amount, 0));
    const totalGeneralExpenses = round(filteredExpenses.reduce((sum, item) => sum + (item.amount + (item.taxAmount || 0)), 0));
    
    // Combined Outgoings (Purchases + General Expenses)
    const totalOutgoings = round(totalPurchases + totalGeneralExpenses);

    setStats({ totalSales, totalCashSales, totalPurchases, totalOutgoings });

    const generateChartData = () => {
        let daysToProcess = 7;
        let endDate = new Date();
        if (dateRange.start && dateRange.end) {
            const diffTime = Math.abs(dateRange.end.getTime() - dateRange.start.getTime());
            daysToProcess = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            endDate = dateRange.end;
            if (daysToProcess > 30) daysToProcess = 30;
        }

        const data = [];
        for (let i = daysToProcess - 1; i >= 0; i--) {
            const d = new Date(endDate);
            d.setDate(endDate.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            
            const daySales = allClosings.filter(c => c.date === dateStr).reduce((sum, c) => sum + (c.grossSales || c.totalSystem || 0), 0);
            const dayPurchasesOnly = allPurchases.filter(p => p.date === dateStr).reduce((sum, p) => sum + p.amount, 0);
            const dayExpensesOnly = allExpenses.filter(e => e.date === dateStr).reduce((sum, e) => sum + (e.amount + (e.taxAmount || 0)), 0);
            
            if (!dateRange.start || !dateRange.end || (d >= dateRange.start && d <= dateRange.end)) {
                 data.push({
                    name: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    fullDate: dateStr,
                    sales: round(daySales),
                    outgoings: round(dayPurchasesOnly + dayExpensesOnly)
                });
            }
        }
        return data;
    };
    setChartData(generateChartData());
  }, [dateRange, allClosings, allPurchases, allExpenses, user]);

  if (user?.role === 'chef') return <div className="p-8 text-center text-slate-500">جاري التحويل...</div>;

  const numberFormatter = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <h2 className="text-2xl font-bold text-slate-800">لوحة التحكم</h2>
         <DateFilter onFilterChange={setDateRange} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="إجمالي المبيعات" value={`${stats.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={DollarSign} color="blue" trend="المبيعات (Gross)" />
        <StatCard title="إجمالي الكاش (الفعلي)" value={`${stats.totalCashSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={Banknote} color="green" trend="النقد في الصندوق" />
        <StatCard title="إجمالي المشتريات" value={`${stats.totalPurchases.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={ShoppingCart} color="orange" trend="فواتير الموردين" />
        <StatCard title="إجمالي المصروفات والمشتريات" value={`${stats.totalOutgoings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={TrendingDown} color="red" trend="المشتريات + المصاريف العامة" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-4 text-slate-700">حركة المبيعات والتدفقات الخارجة</h3>
          <div className="h-[320px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f8fafc' }} formatter={(value: number) => numberFormatter(value)} />
                <Bar dataKey="sales" name="المبيعات" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outgoings" name="المشتريات والمصاريف" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-4 text-slate-700">توزيع المصاريف (الفترة المحددة)</h3>
          <div className="flex flex-col justify-center h-[320px]">
             <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><ShoppingCart size={20} /></div>
                        <span className="font-bold text-slate-700">المشتريات</span>
                    </div>
                    <span className="font-mono font-bold text-lg">{stats.totalPurchases.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><PieChart size={20} /></div>
                        <span className="font-bold text-slate-700">المصاريف العامة</span>
                    </div>
                    <span className="font-mono font-bold text-lg">{(stats.totalOutgoings - stats.totalPurchases).toLocaleString()} ر.س</span>
                </div>
                <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                    <span className="font-black text-slate-500">إجمالي المخرج المالي:</span>
                    <span className="text-2xl font-black text-red-600 font-mono">{stats.totalOutgoings.toLocaleString()} ر.س</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
