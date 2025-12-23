
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Printer, FileText, Phone, Building, Eye, FileSpreadsheet, CreditCard, Banknote, Clock } from 'lucide-react';
import { Supplier, Purchase } from '../types';
import { supabase } from '../services/supabaseClient';
import * as XLSX from 'xlsx';

const SupplierStatement: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [transactions, setTransactions] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        if (!id) return;
        const { data: sData } = await supabase.from('suppliers').select('*').eq('id', id).single();
        if (sData) {
            setSupplier(sData);
            const { data: pData } = await supabase.from('purchases').select('*').eq('partyName', sData.name).order('date', { ascending: false });
            if (pData) setTransactions(pData);
        }
        setIsLoading(false);
    };
    fetchData();
  }, [id]);

  const getPaymentInfo = (method?: string) => {
    switch (method) {
      case 'cash': return { label: 'نقدي', color: 'bg-green-100 text-green-700', icon: Banknote };
      case 'transfer': return { label: 'حوالة بنكية', color: 'bg-blue-100 text-blue-700', icon: CreditCard };
      case 'credit': return { label: 'آجل', color: 'bg-orange-100 text-orange-700', icon: Clock };
      default: return { label: 'آجل', color: 'bg-orange-100 text-orange-700', icon: Clock };
    }
  };

  const exportToExcel = () => {
    if (!supplier || transactions.length === 0) return;

    const excelData = transactions.map(t => ({
        'التاريخ': t.date,
        'رقم المرجع': t.invoiceNumber || t.id,
        'البيان': t.description || 'مشتريات',
        'وسيلة الدفع': getPaymentInfo(t.paymentMethod).label,
        'المبلغ': t.amount
    }));

    excelData.push({ 'التاريخ': 'إجمالي الرصيد المستحق حالياً', 'رقم المرجع': '', 'البيان': '', 'وسيلة الدفع': '', 'المبلغ': supplier.balance });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Statement");

    const wscols = [ { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 15 } ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `كشف_حساب_${supplier.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center h-screen"><p className="text-slate-500 font-bold">جاري تحميل بيانات المورد...</p></div>;
  if (!supplier) return <div className="flex flex-col items-center justify-center h-screen"><p className="text-red-500 font-bold">المورد غير موجود</p></div>;

  const totalCreditPurchases = transactions.filter(t => t.paymentMethod === 'credit').reduce((sum, t) => sum + t.amount, 0);
  const totalPaidPurchases = transactions.filter(t => t.paymentMethod === 'cash' || t.paymentMethod === 'transfer').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="max-w-6xl mx-auto pb-12 px-4">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 print:hidden">
         <div className="flex items-center gap-4">
            <button onClick={() => navigate('/suppliers')} className="p-2 bg-white border border-slate-200 rounded-full text-slate-500 hover:bg-slate-50 transition-colors shadow-sm">
                <ArrowRight size={22} />
            </button>
            <h2 className="text-2xl font-bold text-slate-800 border-r-4 border-indigo-600 pr-4">كشف حساب مورد</h2>
         </div>
         <div className="flex items-center gap-3">
             <button 
                onClick={exportToExcel}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-all font-bold text-sm shadow-sm"
             >
                <FileSpreadsheet size={20} />
                <span>تصدير Excel</span>
             </button>
             <button 
                onClick={() => window.print()} 
                className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 shadow-lg transition-all font-bold text-sm"
             >
                <Printer size={20} />
                <span>طباعة الكشف</span>
             </button>
         </div>
      </div>

      <div className="bg-white shadow-xl print:shadow-none p-10 rounded-2xl min-h-[297mm] print:p-0 print:w-full border border-slate-100">
         {/* Header Info */}
         <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-1">كشف حساب مورد</h1>
                <p className="text-slate-400 font-semibold uppercase tracking-widest text-xs">Statement of Account</p>
            </div>
            <div className="text-left bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <h3 className="font-bold text-xl text-slate-900 flex items-center gap-2 justify-end mb-1">
                    {supplier.name} 
                    <Building size={20} className="text-indigo-600" />
                </h3>
                <p className="text-sm font-semibold text-slate-500 mt-2 font-mono" dir="ltr">{supplier.phone}</p>
                {supplier.taxNumber && <p className="text-xs font-medium text-slate-400 mt-1">الرقم الضريبي: {supplier.taxNumber}</p>}
            </div>
         </div>

         {/* Summary Cards */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="p-6 bg-red-50 rounded-2xl border border-red-100 text-center">
                <p className="text-red-500 font-bold text-xs mb-2 uppercase">الرصيد المستحق (حالياً)</p>
                <p className="text-2xl font-bold text-red-700 font-mono">
                    {Number(supplier.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    <span className="text-sm mr-1 font-medium">ر.س</span>
                </p>
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <p className="text-slate-500 font-bold text-xs mb-2 uppercase">إجمالي المشتريات الآجلة</p>
                <p className="text-2xl font-bold text-slate-700 font-mono">
                    {totalCreditPurchases.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <p className="text-slate-500 font-bold text-xs mb-2 uppercase">إجمالي المسدد (نقدي/حوالة)</p>
                <p className="text-2xl font-bold text-slate-700 font-mono">
                    {totalPaidPurchases.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
            </div>
         </div>

         {/* Transaction Table */}
         <div className="overflow-hidden border border-slate-200 rounded-xl">
            <table className="w-full text-right">
                <thead className="bg-slate-900 text-white text-sm">
                    <tr>
                        <th className="p-4 font-bold">التاريخ</th>
                        <th className="p-4 font-bold">رقم المرجع / الفاتورة</th>
                        <th className="p-4 font-bold">البيان</th>
                        <th className="p-4 font-bold">طريقة الدفع</th>
                        <th className="p-4 font-bold">المبلغ</th>
                        <th className="p-4 font-bold text-center print:hidden">عرض</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                    {transactions.map((t) => {
                        const payInfo = getPaymentInfo(t.paymentMethod);
                        const PayIcon = payInfo.icon;
                        return (
                            <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-semibold text-slate-600 font-mono">{t.date}</td>
                                <td className="p-4 font-semibold text-slate-800 font-mono">{t.invoiceNumber || t.id}</td>
                                <td className="p-4 font-medium text-slate-500 max-w-xs truncate">{t.description || 'مشتريات'}</td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${payInfo.color}`}>
                                        <PayIcon size={14} />
                                        {payInfo.label}
                                    </span>
                                </td>
                                <td className="p-4 font-bold text-slate-900 font-mono">
                                    {t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-4 text-center print:hidden">
                                    <button 
                                        onClick={() => navigate(`/purchases/${t.id}`)}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                        title="عرض التفاصيل"
                                    >
                                        <Eye size={20} />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    {transactions.length === 0 && (
                        <tr>
                            <td colSpan={6} className="p-12 text-center text-slate-400 font-bold">
                                لا توجد حركات مسجلة لهذا المورد
                            </td>
                        </tr>
                    )}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-900">
                    <tr className="font-bold text-slate-900 text-lg">
                        <td colSpan={4} className="p-5 text-center">إجمالي رصيد المورد الحالي</td>
                        <td className="p-5 font-mono text-xl text-red-700 bg-red-50/50">
                            {Number(supplier.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="print:hidden" />
                    </tr>
                </tfoot>
            </table>
         </div>
         
         <div className="mt-12 text-center hidden print:block border-t border-slate-100 pt-6">
             <p className="text-slate-400 font-bold text-xs">تم استخراج هذا التقرير من نظام مِرفاد المحاسبي بتاريخ {new Date().toLocaleDateString('ar-SA')}</p>
         </div>
      </div>
    </div>
  );
};

export default SupplierStatement;
