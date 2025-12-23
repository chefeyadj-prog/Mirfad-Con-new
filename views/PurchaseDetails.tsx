
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Printer, FileSpreadsheet, Calendar, Building, Calculator, Paperclip, FileText, Edit, CreditCard, X, Lock, Ban, Tag } from 'lucide-react';
import { Purchase } from '../types';
import { supabase } from '../services/supabaseClient';
import { round } from '../utils/mathUtils';

const PurchaseDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState<Purchase | null>(null);

  // Auth State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const fetchPurchase = async () => {
        if (!id) return;
        const { data } = await supabase.from('purchases').select('*').eq('id', id).single();
        if (data) setPurchase(data);
    };
    fetchPurchase();
  }, [id]);

  const verifyAndEdit = () => {
    if (authPassword === '1234') {
        setIsAuthModalOpen(false);
        navigate(`/purchases/edit/${id}`);
    } else {
        setAuthError('كلمة المرور غير صحيحة');
    }
  };

  const handleBack = () => {
      navigate('/purchases');
  };

  if (!purchase) return <div className="flex flex-col items-center justify-center h-96"><p className="text-slate-500 mb-4">جاري التحميل...</p></div>;

  const currency = purchase.currency || 'SAR';
  const items = purchase.items || [];
  const discountAmount = purchase.discountAmount || 0;
  const isTaxExempt = purchase.isTaxExempt === true;
  
  // Calculations
  const itemsSubTotal = round(items.reduce((sum, item) => sum + round(item.quantity * item.unitPrice), 0));
  const taxableAmount = round(Math.max(0, itemsSubTotal - discountAmount));
  const totalTax = isTaxExempt ? 0 : round(taxableAmount * 0.15);
  const grandTotal = purchase.amount;
  
  const formatMoney = (amount: number) => amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const getPaymentMethodName = (method?: string) => { switch(method) { case 'cash': return 'نقدي'; case 'transfer': return 'حوالة'; case 'credit': return 'آجل'; default: return 'آجل'; } };

  return (
    <div className="max-w-6xl mx-auto pb-10 px-4">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
            <button onClick={handleBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors bg-white border border-slate-200 shadow-sm"><ArrowRight size={20} /></button>
            <h2 className="text-2xl font-bold text-slate-800 border-r-2 border-slate-300 pr-4 mr-2">{purchase.partyName}</h2>
            {isTaxExempt && (
                <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold border border-orange-200 flex items-center gap-1">
                    <Ban size={12} />
                    معفى من الضريبة
                </span>
            )}
        </div>
        <div className="flex gap-3">
             <button 
                onClick={() => { setAuthPassword(''); setAuthError(''); setIsAuthModalOpen(true); }} 
                className="px-4 py-2 bg-white border border-blue-600 text-blue-700 rounded-lg flex items-center gap-2 hover:bg-blue-50 font-medium transition-colors"
             >
                <Edit size={18} />
                <span>تعديل</span>
             </button>
             <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 text-white rounded-lg flex items-center gap-2 hover:bg-slate-900 shadow-md transition-colors"><Printer size={18} /><span>طباعة</span></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-40 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-2 h-full bg-blue-600"></div>
             <div className="flex justify-between items-start"><span className="text-slate-500 font-medium text-sm">الإجمالي النهائي</span><div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Calculator size={20} /></div></div>
             <div><h3 className="text-2xl font-bold text-slate-800 dir-ltr" dir="ltr">{formatMoney(grandTotal)} <span className="text-sm text-slate-500">{currency}</span></h3></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-40">
             <div className="flex justify-between items-start"><span className="text-slate-500 font-medium text-sm">تاريخ الفاتورة</span><div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Calendar size={20} /></div></div>
             <div><h3 className="text-xl font-bold text-slate-800 font-mono">{purchase.date}</h3></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-40">
             <div className="flex justify-between items-start"><span className="text-slate-500 font-medium text-sm">رقم الفاتورة</span><div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><FileText size={20} /></div></div>
             <div><h3 className="text-xl font-bold text-slate-800 font-mono mb-1">{purchase.invoiceNumber || purchase.id}</h3><span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full border border-slate-200 flex items-center gap-1 w-fit"><CreditCard size={10} />{getPaymentMethodName(purchase.paymentMethod)}</span></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-40">
             <div className="flex justify-between items-start"><span className="text-slate-500 font-medium text-sm">اسم الشركة</span><div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><Building size={20} /></div></div>
             <div><h3 className="text-lg font-bold text-slate-800 leading-tight mb-1">{purchase.partyName}</h3><p className="text-xs text-slate-400">الرقم الضريبي: {purchase.taxNumber || 'غير متوفر'}</p></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-8">
        <table className="w-full text-right"><thead className="bg-slate-50 border-b border-slate-100">
            <tr>
                <th className="py-4 px-6 text-slate-500 font-medium text-sm">الكود</th>
                <th className="py-4 px-6 text-slate-500 font-medium text-sm">اسم الصنف</th>
                <th className="py-4 px-6 text-slate-500 font-medium text-sm">الكمية</th>
                <th className="py-4 px-6 text-slate-500 font-medium text-sm">السعر</th>
                {!isTaxExempt && <th className="py-4 px-6 text-slate-500 font-medium text-sm">الإجمالي الفرعي</th>}
                <th className="py-4 px-6 text-slate-500 font-medium text-sm">الإجمالي</th>
            </tr>
            </thead>
        <tbody className="divide-y divide-slate-100">
            {items.map((item, index) => { 
                const amount = round(item.quantity * item.unitPrice); 
                return (
                <tr key={index}>
                    <td className="py-4 px-6 text-slate-500 font-mono text-xs">{item.code || '-'}</td>
                    <td className="py-4 px-6 font-medium text-slate-700">{item.description}</td>
                    <td className="py-4 px-6 text-slate-600">{item.quantity}</td>
                    <td className="py-4 px-6 text-slate-600">{item.unitPrice.toFixed(2)}</td>
                    <td className="py-4 px-6 font-bold text-slate-800" colSpan={isTaxExempt ? 2 : 2}>{amount.toFixed(2)}</td>
                </tr>
                ) 
            })}
        </tbody>
        <tfoot className="bg-slate-50 border-t-2 border-slate-100">
            <tr>
                <td colSpan={5} className="py-3 px-6 text-left text-slate-500 font-bold border-l border-slate-100">المجموع الفرعي (Subtotal)</td>
                <td className="py-3 px-6 font-bold text-slate-700">{formatMoney(itemsSubTotal)}</td>
            </tr>
            {discountAmount > 0 && (
                <tr className="text-red-600 bg-red-50/10">
                    <td colSpan={5} className="py-2 px-6 text-left font-bold border-l border-slate-100">
                        الخصم (Discount)
                    </td>
                    <td className="py-2 px-6 font-bold">-{formatMoney(discountAmount)}</td>
                </tr>
            )}
            {!isTaxExempt && (
                <>
                  <tr className="bg-indigo-50/10">
                      <td colSpan={5} className="py-2 px-6 text-left font-bold text-slate-600 border-l border-slate-100">المبلغ الخاضع للضريبة (Net Taxable)</td>
                      <td className="py-2 px-6 font-bold text-indigo-700">{formatMoney(taxableAmount)}</td>
                  </tr>
                  <tr>
                      <td colSpan={5} className="py-2 px-6 text-left text-slate-500 font-bold border-l border-slate-100">ضريبة القيمة المضافة (15%)</td>
                      <td className="py-2 px-6 font-bold text-slate-600">{formatMoney(totalTax)}</td>
                  </tr>
                </>
            )}
            <tr className="bg-indigo-600 text-white">
                <td colSpan={5} className="py-4 px-6 text-left font-bold text-lg border-l border-indigo-700">الإجمالي النهائي المستحق (Grand Total)</td>
                <td className="py-4 px-6 font-black text-2xl">{formatMoney(grandTotal)} <span className="text-sm font-normal">{currency}</span></td>
            </tr>
        </tfoot>
        </table>
      </div>

      {/* Auth Modal for Editing */}
      {isAuthModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-sm overflow-hidden animate-scale-in">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Lock size={18} className="text-slate-500" />
                        تأكيد الصلاحية للتعديل
                      </h3>
                      <button onClick={() => setIsAuthModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                  </div>
                  <div className="p-6">
                      <p className="text-sm text-slate-500 mb-4 text-center">لتعديل هذه الفاتورة، يرجى إدخال رمز المرور.</p>
                      <input 
                        type="password" 
                        autoFocus
                        className={`w-full p-3 border rounded-lg text-center font-mono text-lg outline-none mb-2 ${authError ? 'border-red-500 bg-red-50' : 'border-slate-300 focus:border-indigo-500'}`}
                        placeholder="****"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && verifyAndEdit()}
                      />
                      {authError && <p className="text-xs text-red-500 text-center mb-4">{authError}</p>}
                      <button 
                        onClick={verifyAndEdit}
                        className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                      >
                        تحقق ومتابعة
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default PurchaseDetails;
