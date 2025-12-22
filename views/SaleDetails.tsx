import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Printer, MapPin, Phone, QrCode } from 'lucide-react';
import { Sale } from '../types';
import { supabase } from '../services/supabaseClient';

const SaleDetails: React.FC = () => {
  // NOTE: The current implementation focuses on Daily Closings, not individual Sales invoices.
  // This view is kept for legacy support if you decide to re-enable individual sales.
  const { id } = useParams();
  const navigate = useNavigate();
  const [sale, setSale] = useState<Sale | null>(null);

  // Fallback to avoid error since we don't store individual sales in DB in current logic
  // If you add a sales table later, uncomment this:
  /*
  useEffect(() => {
    const fetchSale = async () => {
        const { data } = await supabase.from('sales').select('*').eq('id', id).single();
        if (data) setSale(data);
    };
    fetchSale();
  }, [id]);
  */

  if (!sale) return <div className="flex flex-col items-center justify-center h-screen"><p className="text-slate-500 mb-4">الفاتورة غير موجودة (النظام يعمل بنظام الإقفال اليومي حالياً)</p><button onClick={() => navigate('/sales')} className="text-blue-600 hover:underline">العودة</button></div>;

  const grossAmount = sale.amount;
  const netAmount = grossAmount / 1.15;
  const vatAmount = grossAmount - netAmount;
  const formatMoney = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8">
      <div className="w-full max-w-[210mm] mb-6 flex justify-between items-center px-4 print:hidden">
        <button onClick={() => navigate('/sales')} className="flex items-center gap-2 text-slate-600 hover:bg-white hover:shadow px-4 py-2 rounded-lg transition-all"><ArrowRight size={18} /><span>رجوع</span></button>
        <button onClick={() => window.print()} className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow-lg hover:bg-indigo-700 flex items-center gap-2 font-bold"><Printer size={18} /><span>طباعة الفاتورة</span></button>
      </div>
      {/* Rest of the Invoice UI... */}
    </div>
  );
};

export default SaleDetails;