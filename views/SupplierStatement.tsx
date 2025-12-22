
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Printer, FileText, Phone, Building, Eye } from 'lucide-react';
import { Supplier, Purchase } from '../types';
import { supabase } from '../services/supabaseClient';

const SupplierStatement: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [transactions, setTransactions] = useState<Purchase[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        if (!id) return;
        const { data: sData } = await supabase.from('suppliers').select('*').eq('id', id).single();
        if (sData) setSupplier(sData);

        // Get purchases where partyName matches supplier name (Legacy logic) or we could add supplierId to purchase table
        if (sData) {
            const { data: pData } = await supabase.from('purchases').select('*').eq('partyName', sData.name).order('date', { ascending: false });
            if (pData) setTransactions(pData);
        }
    };
    fetchData();
  }, [id]);

  if (!supplier) return <div className="flex flex-col items-center justify-center h-screen"><p className="text-slate-500 mb-4">جاري تحميل بيانات المورد...</p></div>;

  const totalCreditPurchases = transactions.filter(t => t.paymentMethod === 'credit').reduce((sum, t) => sum + t.amount, 0);
  const totalCashPurchases = transactions.filter(t => t.paymentMethod === 'cash' || t.paymentMethod === 'transfer').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-8 print:hidden">
         <div className="flex items-center gap-4"><button onClick={() => navigate('/suppliers')} className="p-2 bg-white border border-slate-200 rounded-full text-slate-500 hover:bg-slate-50 transition-colors"><ArrowRight size={20} /></button><h2 className="text-2xl font-bold text-slate-800">كشف حساب مورد</h2></div>
         <button onClick={() => window.print()} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-md transition-colors"><Printer size={18} /><span>طباعة الكشف</span></button>
      </div>

      <div className="bg-white shadow-lg print:shadow-none p-10 rounded-xl min-h-[297mm] print:p-0 print:w-full">
         <div className="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
            <div><h1 className="text-3xl font-bold text-slate-800 mb-2">كشف حساب</h1><p className="text-slate-500 font-medium">Statement of Account</p></div>
            <div className="text-left bg-slate-50 p-4 rounded-lg border border-slate-100"><h3 className="font-bold text-slate-700 flex items-center gap-2 justify-end">{supplier.name} <Building size={18} /></h3><p className="text-sm text-slate-500 mt-2">{supplier.phone}</p></div>
         </div>
         <div className="grid grid-cols-3 gap-6 mb-10">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center"><p className="text-slate-500 text-sm mb-1">الرصيد الحالي</p><p className="text-2xl font-bold text-slate-800">{Number(supplier.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center"><p className="text-slate-500 text-sm mb-1">مشتريات آجل</p><p className="text-xl font-bold text-slate-700">{totalCreditPurchases.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center"><p className="text-slate-500 text-sm mb-1">مشتريات نقدي</p><p className="text-xl font-bold text-slate-700">{totalCashPurchases.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
         </div>
         <div className="overflow-hidden border border-slate-200 rounded-lg">
            <table className="w-full text-right"><thead className="bg-slate-100 text-slate-600 text-sm border-b border-slate-200">
                <tr>
                    <th className="p-4 font-bold">التاريخ</th>
                    <th className="p-4 font-bold">رقم المرجع</th>
                    <th className="p-4 font-bold">البيان</th>
                    <th className="p-4 font-bold">النوع</th>
                    <th className="p-4 font-bold">المبلغ</th>
                    <th className="p-4 font-bold text-center">عرض</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
                {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                        <td className="p-4 font-mono text-slate-600">{t.date}</td>
                        <td className="p-4 font-medium text-slate-800">{t.invoiceNumber || t.id}</td>
                        <td className="p-4 text-slate-500 max-w-xs truncate">{t.description || 'مشتريات'}</td>
                        <td className="p-4"><span className={`px-2 py-1 rounded text-xs ${t.paymentMethod === 'credit' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{t.paymentMethod === 'credit' ? 'آجل' : 'نقدي'}</span></td>
                        <td className="p-4 font-mono font-bold text-slate-800">{t.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-4 text-center">
                            <button 
                                onClick={() => navigate(`/purchases/${t.id}`)}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="عرض الفاتورة"
                            >
                                <Eye size={18} />
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody></table>
         </div>
      </div>
    </div>
  );
};

export default SupplierStatement;
