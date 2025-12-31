
import React, { useState, useEffect } from 'react';
import { Calendar, Printer, Filter, Building, FileSpreadsheet, Loader2, PieChart, Banknote, Wallet, CreditCard, Calculator } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { Purchase, GeneralExpense, SalaryTransaction, Employee } from '../types';
import * as XLSX from 'xlsx';
import { round } from '../utils/mathUtils';

interface SummaryRow {
  name: string;
  net: number;
  vat: number;
  total: number;
  type: 'supplier' | 'expense' | 'salary' | 'loan';
  method?: 'cash' | 'transfer';
}

const MonthlyPurchasesReport: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [reportData, setReportData] = useState<SummaryRow[]>([]);
  const [overallTotal, setOverallTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    const [year, month] = selectedMonth.split('-');
    const yearNum = Number(year);
    const monthNum = Number(month);
    
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    const endDate = `${year}-${month}-${lastDay}`;

    try {
      // 1. جلب المشتريات
      const { data: purchases } = await supabase
        .from('purchases')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      // 2. جلب المصاريف العامة
      const { data: expenses } = await supabase
        .from('general_expenses')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      // 3. جلب بيانات الرواتب والموظفين
      const { data: employees } = await supabase.from('employees').select('*');
      const { data: salaryTrx } = await supabase
        .from('salaryTransactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      // 4. جلب سجلات المسير لهذا الشهر
      const { data: payrollRecords } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('month', monthNum)
        .eq('year', yearNum);

      processCombinedData(
        purchases || [], 
        expenses || [], 
        employees || [], 
        salaryTrx || [], 
        payrollRecords || []
      );
    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const processCombinedData = (
    purchases: Purchase[], 
    expenses: GeneralExpense[], 
    employees: Employee[], 
    salaryTrx: SalaryTransaction[],
    payrollRecords: any[]
  ) => {
    const rows: SummaryRow[] = [];
    
    // أولاً: معالجة الموردين
    const supplierGroups: Record<string, { net: number, vat: number, total: number }> = {};
    purchases.forEach(p => {
      const name = p.partyName || 'مورد غير محدد';
      let total = p.amount;
      let net = p.isTaxExempt ? total : total / 1.15;
      let vat = total - net;

      if (!supplierGroups[name]) supplierGroups[name] = { net: 0, vat: 0, total: 0 };
      supplierGroups[name].net += net;
      supplierGroups[name].vat += vat;
      supplierGroups[name].total += total;
    });

    Object.entries(supplierGroups).forEach(([name, data]) => {
      rows.push({ name, ...data, type: 'supplier' });
    });
    
    rows.sort((a, b) => b.total - a.total);

    // ثانياً: معالجة المصاريف العامة
    let expNet = 0;
    let expVat = 0;
    expenses.forEach(e => {
      expNet += e.amount;
      expVat += (e.taxAmount || 0);
    });
    if (expenses.length > 0) {
      rows.push({ 
        name: 'إجمالي المصاريف العامة والتشغيلية', 
        net: expNet, 
        vat: expVat, 
        total: expNet + expVat, 
        type: 'expense' 
      });
    }

    // ثالثاً: تحليل الرواتب والسلف التفصيلي
    let cashNetSalaries = 0;
    let transferNetSalaries = 0;
    let cashLoans = 0;
    let transferLoans = 0;

    employees.forEach(emp => {
      const record = payrollRecords.find(r => r.employee_id === emp.id);
      const daysWorked = record ? record.working_days : 30;
      const leaveD = record ? record.leave_days : 0;
      const extraD = record ? record.extra_days : 0;
      const extraH = record ? record.extra_hours : 0;
      const dailyHours = emp.dailyHours || 10;

      const baseSal = emp.basicSalary || 0;
      const totalSal = emp.salary || 0;

      // حساب الراتب المستحق
      const proratedSalary = round((totalSal / 30) * (daysWorked + leaveD));
      const extraDaysValue = round((baseSal / 30) * extraD * 1.5);
      const extraHoursValue = round(1.5 * (extraH * (baseSal / 30 / dailyHours)));

      // العمليات المالية للموظف في هذا الشهر
      const empTrx = salaryTrx.filter(t => t.employeeId === emp.id);
      const loans = empTrx.filter(t => t.type === 'loan').reduce((sum, t) => sum + t.amount, 0);
      const deductions = empTrx.filter(t => ['deduction', 'meal', 'shortage'].includes(t.type)).reduce((sum, t) => sum + t.amount, 0);
      const bonuses = empTrx.filter(t => t.type === 'bonus').reduce((sum, t) => sum + t.amount, 0);

      const netSalary = proratedSalary + extraDaysValue + extraHoursValue - (loans + deductions) + bonuses;

      if (emp.paymentMethod === 'cash') {
        cashNetSalaries += netSalary;
        cashLoans += loans;
      } else {
        transferNetSalaries += netSalary;
        transferLoans += loans;
      }
    });

    // إضافة أسطر الرواتب التفصيلية
    if (cashNetSalaries > 0) {
      rows.push({ name: 'صافي رواتب الموظفين (كاش)', net: cashNetSalaries, vat: 0, total: cashNetSalaries, type: 'salary', method: 'cash' });
    }
    if (transferNetSalaries > 0) {
      rows.push({ name: 'صافي رواتب الموظفين (حوالات)', net: transferNetSalaries, vat: 0, total: transferNetSalaries, type: 'salary', method: 'transfer' });
    }
    if (cashLoans > 0) {
      rows.push({ name: 'إجمالي سلف الموظفين (كاش)', net: cashLoans, vat: 0, total: cashLoans, type: 'loan', method: 'cash' });
    }
    if (transferLoans > 0) {
      rows.push({ name: 'إجمالي سلف الموظفين (حوالات)', net: transferLoans, vat: 0, total: transferLoans, type: 'loan', method: 'transfer' });
    }

    setReportData(rows);
    setOverallTotal(rows.reduce((sum, row) => sum + row.total, 0));
  };

  const exportToExcel = () => {
    if (reportData.length === 0) return alert("لا توجد بيانات");
    const excelData = reportData.map(item => ({
      'البيان': item.name,
      'التصنيف': item.type === 'supplier' ? 'مورد' : item.type === 'expense' ? 'مصاريف' : item.type === 'salary' ? 'رواتب' : 'سلف',
      'طريقة الصرف': item.method === 'cash' ? 'نقدي' : item.method === 'transfer' ? 'حوالة' : '-',
      'الصافي (بدون ضريبة)': item.net,
      'الضريبة': item.vat,
      'الإجمالي': item.total
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "التقرير التفصيلي");
    XLSX.writeFile(workbook, `تقرير_المصروفات_${selectedMonth}.xlsx`);
  };

  const formatMoney = (amount: number) => 
    amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-7xl mx-auto pb-12 animate-fade-in text-right" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 print:hidden">
        <div>
           <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
             <Calendar className="text-indigo-600" />
             التقرير الشهري للمصروفات والرواتب
           </h2>
           <p className="text-slate-500 text-sm font-bold mt-1">تحليل شامل لكافة المخرجات المالية (مشتريات، مصاريف، رواتب، سلف)</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
           <span className="text-xs font-black text-slate-400 px-3 border-l border-slate-100">فترة التقرير</span>
           <input 
             type="month" 
             value={selectedMonth}
             onChange={(e) => setSelectedMonth(e.target.value)}
             className="outline-none text-slate-700 font-black bg-transparent px-2"
           />
           <div className="flex items-center gap-2 mr-2">
               <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-all font-black text-xs">
                  <FileSpreadsheet size={16} /> Excel
               </button>
               <button onClick={() => window.print()} className="bg-slate-800 text-white p-2.5 rounded-xl hover:bg-slate-900 transition-all">
                 <Printer size={18} />
               </button>
           </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start relative">
        <div className="flex-1 w-full">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-2 print:border-black">
                <table className="w-full text-right border-collapse">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-200 print:bg-white print:border-black">
                        <tr>
                            <th className="p-5 border-l border-slate-100 print:border-black">البيان (المصدر المالي)</th>
                            <th className="p-5 text-center border-l border-slate-100 print:border-black">الصافي (قيمة البند)</th>
                            <th className="p-5 text-center border-l border-slate-100 print:border-black">الضريبة المضافة</th>
                            <th className="p-5 text-center bg-slate-100/50 print:bg-white print:border-black">الإجمالي الكلي</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {isLoading ? (
                            <tr><td colSpan={4} className="p-20 text-center"><Loader2 className="animate-spin inline-block text-indigo-600" size={40} /></td></tr>
                        ) : reportData.length === 0 ? (
                            <tr><td colSpan={4} className="p-20 text-center text-slate-400 font-bold">لا توجد بيانات مسجلة لهذا الشهر</td></tr>
                        ) : (
                            reportData.map((item, idx) => (
                                <tr key={idx} className={`hover:bg-slate-50/50 transition-colors border-b border-slate-100 print:border-black ${item.type !== 'supplier' ? 'bg-indigo-50/20 font-black' : ''}`}>
                                    <td className="p-4 flex items-center gap-3">
                                      {item.type === 'expense' && <PieChart size={16} className="text-purple-600" />}
                                      {item.type === 'salary' && <Banknote size={16} className={item.method === 'cash' ? 'text-orange-600' : 'text-blue-600'} />}
                                      {item.type === 'loan' && <Wallet size={16} className={item.method === 'cash' ? 'text-orange-600' : 'text-blue-600'} />}
                                      {item.type === 'supplier' && <Building size={16} className="text-slate-400" />}
                                      <div>
                                          <p className="text-slate-800">{item.name}</p>
                                          {item.method && <span className="text-[9px] opacity-60 uppercase">Deducted from {item.method} fund</span>}
                                      </div>
                                    </td>
                                    <td className="p-4 text-center font-mono text-slate-600">{formatMoney(item.net)}</td>
                                    <td className="p-4 text-center font-mono text-slate-400">{item.vat > 0 ? formatMoney(item.vat) : '-'}</td>
                                    <td className={`p-4 text-center font-mono font-black ${item.type === 'supplier' ? 'text-slate-900 bg-slate-50/30' : 'text-indigo-700 bg-indigo-50/30'} print:bg-white`}>{formatMoney(item.total)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    <tfoot className="bg-slate-900 text-white font-black border-t-2 border-slate-900 print:bg-white print:text-black print:border-black">
                        <tr>
                            <td className="p-6 text-lg">الإجمالي العام لجميع المخرجات</td>
                            <td className="p-6 text-center font-mono">{formatMoney(reportData.reduce((sum, i) => sum + i.net, 0))}</td>
                            <td className="p-6 text-center font-mono">{formatMoney(reportData.reduce((sum, i) => sum + i.vat, 0))}</td>
                            <td className="p-6 text-center font-mono text-2xl bg-indigo-600 print:bg-white">
                                {formatMoney(overallTotal)}
                                <span className="text-xs mr-2 opacity-70">ر.س</span>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>

        <div className="w-full lg:w-80 shrink-0 print:hidden">
            <div className="bg-white rounded-[2rem] shadow-xl border-2 border-slate-900 p-8 text-center sticky top-24">
                <div className="bg-indigo-50 text-indigo-700 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Calculator size={32} />
                </div>
                <h3 className="text-lg font-black text-slate-800 mb-6 border-b border-slate-100 pb-4">
                    خلاصة المصاريف والرواتب
                </h3>
                
                <div className="text-4xl font-black text-slate-900 font-mono mb-2">
                    {formatMoney(overallTotal)}
                </div>
                <p className="text-[10px] text-slate-400 mb-8 font-black uppercase tracking-widest">Total Monthly Outgoings</p>

                <div className="space-y-4 text-right">
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-2"><Building size={14} className="text-slate-400" /><span className="text-[11px] font-black text-slate-500">المشتريات:</span></div>
                        <span className="text-xs font-black text-slate-800 font-mono">{formatMoney(reportData.filter(r => r.type === 'supplier').reduce((s, r) => s + r.total, 0))}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-purple-50/50 rounded-xl">
                        <div className="flex items-center gap-2"><PieChart size={14} className="text-purple-400" /><span className="text-[11px] font-black text-purple-600">المصاريف:</span></div>
                        <span className="text-xs font-black text-purple-800 font-mono">{formatMoney(reportData.filter(r => r.type === 'expense').reduce((s, r) => s + r.total, 0))}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-orange-50/50 rounded-xl">
                        <div className="flex items-center gap-2"><Banknote size={14} className="text-orange-400" /><span className="text-[11px] font-black text-orange-600">إجمالي الكاش:</span></div>
                        <span className="text-xs font-black text-orange-800 font-mono">{formatMoney(reportData.filter(r => r.method === 'cash').reduce((s, r) => s + r.total, 0))}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50/50 rounded-xl">
                        <div className="flex items-center gap-2"><CreditCard size={14} className="text-blue-400" /><span className="text-[11px] font-black text-blue-600">إجمالي الحوالات:</span></div>
                        <span className="text-xs font-black text-blue-800 font-mono">{formatMoney(reportData.filter(r => r.method === 'transfer').reduce((s, r) => s + r.total, 0))}</span>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-dashed border-slate-200 opacity-30">
                    <span className="text-[10px] font-black tracking-widest">MIRFAD ACCOUNTING SYSTEM</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyPurchasesReport;
