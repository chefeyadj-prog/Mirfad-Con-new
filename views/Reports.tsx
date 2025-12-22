
import React, { useState } from 'react';
import { Sparkles, FileText, Loader2, Download, Table } from 'lucide-react';
import { generateReportAnalysis } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import DateFilter, { DateRange, getThisMonthRange } from '../components/DateFilter';
import { round } from '../utils/mathUtils';
import * as XLSX from 'xlsx';

const Reports: React.FC = () => {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(getThisMonthRange());

  // ... rest of component logic remains same ...
  const handleGenerateAIReport = async () => {
    setLoading(true);
    
    // Fetch data for context
    const { data: sales } = await supabase.from('dailyClosings').select('*');
    const { data: purchases } = await supabase.from('purchases').select('*');
    const { data: products } = await supabase.from('products').select('*');
    const { data: custody } = await supabase.from('custody').select('*');

    const dataContext = JSON.stringify({
      totalSales: sales?.reduce((sum, s) => sum + (s.grossSales || s.totalSystem || 0), 0) || 0,
      totalPurchases: purchases?.reduce((sum, p) => sum + p.amount, 0) || 0,
      inventoryValue: products?.reduce((sum, p) => sum + (p.cost * p.quantity), 0) || 0,
      lowStockProducts: products?.filter(p => p.quantity < 5).map(p => p.name) || [],
      openCustodyAmount: custody?.filter(c => c.status === 'active').reduce((sum, c) => sum + c.amount, 0) || 0,
    });

    const result = await generateReportAnalysis(dataContext);
    setAnalysis(result);
    setLoading(false);
  };

  const handleDownloadTaxReport = async () => {
    setExporting(true);
    try {
        let query = supabase.from('purchases').select('*').order('date', { ascending: true });
        
        if (dateRange.start && dateRange.end) {
            query = query.gte('date', dateRange.start.toISOString().split('T')[0])
                         .lte('date', dateRange.end.toISOString().split('T')[0]);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (!data || data.length === 0) {
            alert("لا توجد بيانات مشتريات للفترة المختارة");
            return;
        }

        // Format data for Excel
        const excelData = data.map(p => {
            const isTaxExempt = p.isTaxExempt === true;
            const total = Number(p.amount) || 0;
            const net = isTaxExempt ? total : round(total / 1.15);
            const vat = isTaxExempt ? 0 : round(total - net);

            return {
                'المورد': p.partyName,
                'التاريخ': p.date,
                'رقم الفاتورة': p.invoiceNumber || p.id,
                'الرقم الضريبي': p.taxNumber || 'غير مسجل',
                'المبلغ قبل الضريبة': net,
                'الضريبة (15%)': vat,
                'الإجمالي': total
            };
        });

        // Create Excel Workbook
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "تقرير الضريبة");

        // Set column widths for better readability
        const wscols = [
            { wch: 25 }, // Supplier
            { wch: 15 }, // Date
            { wch: 15 }, // Inv No
            { wch: 20 }, // Tax No
            { wch: 18 }, // Net
            { wch: 15 }, // VAT
            { wch: 15 }, // Total
        ];
        worksheet['!cols'] = wscols;

        // Download file
        const fileName = `تقرير_الضريبة_${dateRange.label.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);

    } catch (error: any) {
        console.error("Export Error:", error);
        alert("حدث خطأ أثناء استخراج التقرير: " + error.message);
    } finally {
        setExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2 text-center md:text-right">التقارير والتحليلات</h2>
          <p className="text-slate-500 text-center md:text-right">استخراج البيانات المالية وتحليل الأداء بالذكاء الاصطناعي</p>
        </div>
        <div className="flex items-center gap-3">
             <DateFilter onFilterChange={setDateRange} />
        </div>
      </div>
      {/* ... cards ... */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-lg flex flex-col items-center justify-center text-center">
                <Sparkles size={40} className="mb-3 text-indigo-200" />
                <h3 className="text-lg font-bold mb-2">المستشار المالي الذكي</h3>
                <p className="text-sm opacity-80 mb-6">تحليل شامل للمخزون والمبيعات والمشتريات لتقديم نصائح استراتيجية</p>
                <button 
                onClick={handleGenerateAIReport}
                disabled={loading}
                className="w-full bg-white text-indigo-700 py-2.5 rounded-xl font-bold hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 disabled:opacity-70 shadow-sm"
                >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
                {loading ? 'جاري التحليل...' : 'بدء التحليل الذكي'}
                </button>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-4">
                    <Table size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">تقرير ضريبة المشتريات</h3>
                <p className="text-sm text-slate-500 mb-6 px-4">توليد ملف Excel جاهز لتقديم الإقرارات الضريبية للفترة المحددة</p>
                <button 
                    onClick={handleDownloadTaxReport}
                    disabled={exporting}
                    className="w-full bg-orange-600 text-white py-2.5 rounded-xl font-bold hover:bg-orange-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70 shadow-md shadow-orange-100"
                >
                    {exporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                    {exporting ? 'جاري التجهيز...' : 'تحميل تقرير الضريبة (Excel)'}
                </button>
            </div>
      </div>
      {/* ... rest of component ... */}
    </div>
  );
};

export default Reports;
