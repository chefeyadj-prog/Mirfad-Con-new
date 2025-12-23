
import React, { useState, useEffect } from 'react';
import { Calendar, Printer, Filter, Building, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { Purchase } from '../types';
import * as XLSX from 'xlsx';

interface SupplierSummary {
  supplierName: string;
  totalNet: number;
  totalVat: number;
  grandTotal: number;
}

const MonthlyPurchasesReport: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [summaryData, setSummaryData] = useState<SupplierSummary[]>([]);
  const [overallTotal, setOverallTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    // Calculate start and end date of the selected month
    const [year, month] = selectedMonth.split('-');
    const startDate = `${year}-${month}-01`;
    // Create date object to find last day of month
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const endDate = `${year}-${month}-${lastDay}`;

    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);

    if (data) {
      processData(data);
    }
    setIsLoading(false);
  };

  const processData = (purchases: Purchase[]) => {
    const grouped: Record<string, SupplierSummary> = {};

    purchases.forEach(p => {
      const name = p.partyName || 'مورد غير محدد';
      
      // Calculate amounts based on tax exemption
      let net = 0;
      let vat = 0;
      let total = p.amount;

      if (p.isTaxExempt) {
        net = total;
        vat = 0;
      } else {
        net = total / 1.15;
        vat = total - net;
      }

      if (!grouped[name]) {
        grouped[name] = {
          supplierName: name,
          totalNet: 0,
          totalVat: 0,
          grandTotal: 0
        };
      }

      grouped[name].totalNet += net;
      grouped[name].totalVat += vat;
      grouped[name].grandTotal += total;
    });

    const result = Object.values(grouped).sort((a, b) => b.grandTotal - a.grandTotal);
    setSummaryData(result);
    setOverallTotal(result.reduce((sum, item) => sum + item.grandTotal, 0));
  };

  const exportToExcel = () => {
    if (summaryData.length === 0) {
      alert("لا توجد بيانات لتصديرها");
      return;
    }

    const excelData = summaryData.map(item => ({
      'المورد': item.supplierName,
      'الإجمالي (بدون ضريبة)': item.totalNet,
      'إجمالي الضريبة': item.totalVat,
      'إجمالي الفواتير': item.grandTotal
    }));

    // Add totals
    excelData.push({
      'المورد': 'الإجمالي الكلي',
      'الإجمالي (بدون ضريبة)': summaryData.reduce((s, i) => s + i.totalNet, 0),
      'إجمالي الضريبة': summaryData.reduce((s, i) => s + i.totalVat, 0),
      'إجمالي الفواتير': overallTotal
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "تقرير مشتريات");

    const wscols = [
      { wch: 30 }, // المورد
      { wch: 20 }, // صافي
      { wch: 15 }, // ضريبة
      { wch: 20 }, // إجمالي
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `تقرير_مشتريات_${selectedMonth}.xlsx`);
  };

  const formatMoney = (amount: number) => 
    amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 print:hidden">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Calendar className="text-indigo-600" />
             تقرير إجمالي المشتريات الشهري
           </h2>
           <p className="text-slate-500 text-sm mt-1">ملخص المشتريات حسب المورد للشهر المحدد</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
           <span className="text-sm font-bold text-slate-600 pl-2 border-l border-slate-200 ml-2">اختر الشهر:</span>
           <input 
             type="month" 
             value={selectedMonth}
             onChange={(e) => setSelectedMonth(e.target.value)}
             className="outline-none text-slate-700 font-mono bg-transparent"
           />
           <div className="flex items-center gap-2 mr-2">
               <button 
                onClick={exportToExcel}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors font-bold text-sm"
               >
                  <FileSpreadsheet size={18} />
                  <span>Excel</span>
               </button>
               <button 
                 onClick={() => window.print()}
                 className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-900 transition-colors"
                 title="طباعة"
               >
                 <Printer size={20} />
               </button>
           </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Main Table */}
        <div className="flex-1 w-full">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-2 print:border-black">
                <table className="w-full text-right border-collapse">
                    <thead className="bg-slate-50 text-slate-800 text-sm border-b-2 border-slate-200 print:bg-white print:border-black">
                        <tr>
                            <th className="p-4 border font-bold border-slate-200 print:border-black">المورد</th>
                            <th className="p-4 border font-bold border-slate-200 print:border-black">الإجمالي (باستثناء ضريبة القيمة المضافة)</th>
                            <th className="p-4 border font-bold border-slate-200 print:border-black">إجمالي ضريبة القيمة المضافة</th>
                            <th className="p-4 border font-bold border-slate-200 print:border-black">إجمالي الفواتير</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {isLoading ? (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-500">جاري التحميل...</td></tr>
                        ) : summaryData.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-500">لا توجد بيانات لهذا الشهر</td></tr>
                        ) : (
                            summaryData.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 print:hover:bg-white">
                                    <td className="p-3 border border-slate-200 font-bold text-slate-800 print:border-black">{item.supplierName}</td>
                                    <td className="p-3 border border-slate-200 font-mono text-slate-600 print:border-black">{formatMoney(item.totalNet)}</td>
                                    <td className="p-3 border border-slate-200 font-mono text-slate-600 print:border-black">{formatMoney(item.totalVat)}</td>
                                    <td className="p-3 border border-slate-200 font-mono font-bold text-slate-900 bg-slate-50 print:bg-white print:border-black">{formatMoney(item.grandTotal)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 print:bg-white print:border-black">
                        <tr>
                            <td className="p-3 border border-slate-300 print:border-black">الإجمالي الكلي</td>
                            <td className="p-3 border border-slate-300 print:border-black font-mono">
                                {formatMoney(summaryData.reduce((sum, i) => sum + i.totalNet, 0))}
                            </td>
                            <td className="p-3 border border-slate-300 print:border-black font-mono">
                                {formatMoney(summaryData.reduce((sum, i) => sum + i.totalVat, 0))}
                            </td>
                            <td className="p-3 border border-slate-300 print:border-black font-mono text-lg">
                                {formatMoney(overallTotal)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>

        {/* Summary Box (Matches the image style) */}
        <div className="w-full lg:w-80 shrink-0 print:hidden">
            <div className="bg-white rounded-xl shadow-lg border-2 border-slate-800 p-6 text-center sticky top-24">
                <h3 className="text-lg font-bold text-slate-800 mb-6 border-b pb-4">
                    إجمالي المشتريات شهر ({selectedMonth.split('-')[1]} / {selectedMonth.split('-')[0]})
                </h3>
                
                <div className="text-4xl font-bold text-slate-900 font-mono mb-8">
                    {formatMoney(overallTotal)}
                </div>

                <div className="w-16 h-12 border-2 border-green-600 mx-auto transform rotate-3"></div>
            </div>
        </div>

        {/* Print Only Summary Box */}
        <div className="hidden print:block absolute top-10 left-10 border-2 border-black p-6 text-center w-80 bg-white z-10">
             <h3 className="text-lg font-bold text-black mb-6 border-b border-black pb-4">
                إجمالي المشتريات شهر ({selectedMonth.split('-')[1]} / {selectedMonth.split('-')[0]})
            </h3>
            <div className="text-3xl font-bold text-black font-mono">
                {formatMoney(overallTotal)}
            </div>
        </div>

      </div>
    </div>
  );
};

export default MonthlyPurchasesReport;
