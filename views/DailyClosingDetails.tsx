
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Printer, Calendar, Calculator, Coins, Banknote, CreditCard, FileText, Server, CheckCircle2, Info, Tag } from 'lucide-react';
import { DailyClosing } from '../types';
import { supabase } from '../services/supabaseClient';

const FIXED_TERMINAL_IDS = [
  '63427603', '63427604', '63427605', '64073724', '64073994', '64102585'
];

const CARD_LABELS: Record<string, string> = {
  mada: 'مدى (Mada)',
  visa: 'فيزا (Visa)',
  master: 'ماستر كارد (Master)',
  amex: 'أمريكان (Amex)',
  gcci: 'بطاقات الخليج (GCCI)'
};

const DailyClosingDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [closing, setClosing] = useState<DailyClosing | null>(null);

  useEffect(() => {
    const fetchClosing = async () => {
        if (!id) return;
        const { data } = await supabase.from('dailyClosings').select('*').eq('id', id).single();
        if (data) setClosing(data);
    };
    fetchClosing();
  }, [id]);

  if (!closing) return <div className="flex flex-col items-center justify-center h-screen"><p className="text-slate-500 mb-4">جاري تحميل التقرير...</p></div>;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const getDenomCount = (denom: string) => closing.details?.cashDenominations?.[denom] || 0;
  const getPosInput = (key: string) => closing.details?.posInputs?.[key] || 0;
  const getTerminalValue = (termId: string, key: string) => closing.details?.terminalDetails?.[termId]?.[key] || 0;

  const totalSystemNet = (closing.cashSystem || 0) + (closing.cardSystem || 0);
  const discountAmount = closing.discountAmount || 0;
  const grossBeforeDiscount = totalSystemNet + discountAmount;
  const tipsAmount = closing.tips || 0;
  const netRevenue = totalSystemNet - tipsAmount;

  return (
    <div className="max-w-[297mm] mx-auto pb-12 print:max-w-full print:pb-0">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <button onClick={() => navigate('/sales')} className="flex items-center gap-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg transition-all shadow-sm"><ArrowRight size={18} /><span>رجوع للقائمة</span></button>
        <button onClick={() => window.print()} className="bg-[#2e2a78] text-white px-8 py-2 rounded-lg shadow-lg hover:bg-[#1e1a5a] flex items-center gap-2 font-bold"><Printer size={18} /><span>طباعة التقرير</span></button>
      </div>

      <div className="bg-white shadow-xl print:shadow-none p-8 rounded-xl print:p-4 print:w-full print:text-sm border border-slate-100" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
        
        <div className="bg-[#2e2a78] text-white p-6 rounded-t-xl mb-8 flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-black mb-1 print:text-2xl">تقرير إقفال يومي (Z-Report)</h1>
                <p className="text-indigo-200 text-sm font-bold uppercase tracking-widest">Daily Reconciliation Report</p>
            </div>
            <div className="text-left">
                <div className="flex items-center gap-2 justify-end mb-1"><Calendar size={18} className="text-indigo-300" /><span className="font-black text-xl">{closing.date}</span></div>
                <p className="text-indigo-300 text-xs font-mono">REF: {closing.id}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-8">
                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-4 bg-white border-b border-slate-200 font-black text-slate-800 flex items-center gap-2"><Coins size={18} className="text-indigo-600" /> أولاً: الجرد الفعلي للنقد</div>
                    <div className="p-4 space-y-2">
                        {[500, 200, 100, 50, 20, 10, 5, 1].map(denom => {
                            const count = getDenomCount(String(denom));
                            return (<div key={denom} className="flex items-center justify-between text-sm"><div className="flex items-center gap-2"><span className="w-10 font-bold text-slate-500">{denom}</span><span className="text-slate-300">×</span><span className="font-black text-slate-700">{count > 0 ? count : '-'}</span></div><span className="font-mono text-slate-600 font-bold">{formatCurrency(Number(denom) * Number(count))}</span></div>);
                        })}
                        <div className="pt-3 border-t border-slate-200 mt-2 flex justify-between items-center text-green-700"><span className="font-black text-xs uppercase">إجمالي النقد الموجود</span><span className="font-black text-lg font-mono">{formatCurrency(closing.cashActual)}</span></div>
                    </div>
                </div>

                <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 overflow-hidden shadow-sm">
                    <div className="p-4 bg-white border-b border-indigo-100 font-black text-indigo-900 flex items-center gap-2"><Calculator size={18} /> رابعاً: تحليل المبيعات</div>
                    <div className="p-5 space-y-4 text-sm font-bold">
                        <div className="flex justify-between items-center border-b border-indigo-100/50 pb-2"><span className="text-slate-600">صافي المبيعات قبل الخصم</span><span className="text-slate-800 font-mono">{formatCurrency(closing.netSales)}</span></div>
                        <div className="flex justify-between items-center border-b border-indigo-100/50 pb-2"><span className="text-slate-600">ضريبة 15% قبل الخصم</span><span className="text-slate-800 font-mono">{formatCurrency(closing.vatAmount)}</span></div>
                        <div className="flex justify-between items-center border-b border-indigo-200 pb-2 bg-indigo-100/30 p-1 rounded"><span className="text-indigo-900">الإجمالي قبل الخصم</span><span className="text-indigo-900 font-mono">{formatCurrency(grossBeforeDiscount)}</span></div>
                        <div className="flex justify-between items-center text-red-700"><span>قيمة الخصم المسجل</span><span className="font-mono">-{formatCurrency(discountAmount)}</span></div>
                        <div className="mt-4 bg-[#2e2a78] text-white p-4 rounded-lg text-center shadow-md">
                            <span className="block text-[10px] opacity-70 font-bold uppercase mb-1">الإجمالي بعد الخصم</span>
                            <span className="text-2xl font-black font-mono">{formatCurrency(totalSystemNet)} <span className="text-xs">ر.س</span></span>
                        </div>
                    </div>
                </div>

                <div className="bg-green-50/50 rounded-xl border border-green-100 overflow-hidden shadow-sm">
                    <div className="p-4 bg-white border-b border-green-100 font-black text-green-900 flex items-center gap-2"><Banknote size={18} /> خامساً: تصفية الإيراد</div>
                    <div className="p-5 space-y-4 text-sm font-bold">
                        <div className="flex justify-between items-center border-b border-green-100/50 pb-2"><span className="text-slate-600">المكافآت / Tips</span><span className="text-blue-700 font-mono">-{formatCurrency(tipsAmount)}</span></div>
                        <div className="mt-4 bg-slate-900 text-white p-4 rounded-lg text-center shadow-lg">
                            <span className="block text-[10px] opacity-70 font-bold uppercase mb-1 text-indigo-300">صافي الإيراد النهائي</span>
                            <span className="text-2xl font-black font-mono">{formatCurrency(netRevenue)} <span className="text-xs">ر.س</span></span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-8 space-y-8">
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 font-black text-slate-800 flex items-center gap-2"><Server size={18} className="text-indigo-600" /> ثانياً: تفاصيل أجهزة الشبكة</div>
                    <table className="w-full text-center text-xs">
                        <thead className="bg-white text-slate-400 font-black uppercase"><tr className="border-b border-slate-100"><th className="p-3 text-right">رقم الجهاز</th><th className="p-3">مدى</th><th className="p-3">فيزا</th><th className="p-3">ماستر</th><th className="p-3">أمريكان</th><th className="p-3">خليج</th><th className="p-3 bg-slate-50 text-indigo-700">الإجمالي</th></tr></thead>
                        <tbody className="divide-y divide-slate-50">
                            {FIXED_TERMINAL_IDS.map(termId => {
                                const rowTotal = ['mada', 'visa', 'master', 'amex', 'gcci'].reduce((s, k) => s + getTerminalValue(termId, k), 0);
                                if (rowTotal === 0) return null;
                                return (<tr key={termId}><td className="p-3 text-right font-bold text-slate-600 font-mono">{termId}</td><td className="p-3">{formatCurrency(getTerminalValue(termId, 'mada')) !== '0.00' ? formatCurrency(getTerminalValue(termId, 'mada')) : '-'}</td><td className="p-3">{formatCurrency(getTerminalValue(termId, 'visa')) !== '0.00' ? formatCurrency(getTerminalValue(termId, 'visa')) : '-'}</td><td className="p-3">{formatCurrency(getTerminalValue(termId, 'master')) !== '0.00' ? formatCurrency(getTerminalValue(termId, 'master')) : '-'}</td><td className="p-3">{formatCurrency(getTerminalValue(termId, 'amex')) !== '0.00' ? formatCurrency(getTerminalValue(termId, 'amex')) : '-'}</td><td className="p-3">{formatCurrency(getTerminalValue(termId, 'gcci')) !== '0.00' ? formatCurrency(getTerminalValue(termId, 'gcci')) : '-'}</td><td className="p-3 font-black text-indigo-600 bg-slate-50/50">{formatCurrency(rowTotal)}</td></tr>);
                            })}
                        </tbody>
                        <tfoot className="bg-slate-50 font-black text-slate-500 border-t border-slate-200"><tr><td className="p-3 text-right">إجمالي الشبكة الفعلي</td><td colSpan={5}></td><td className="p-3 text-indigo-800 text-sm font-black">{formatCurrency(closing.cardActual)}</td></tr></tfoot>
                    </table>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 font-black text-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-indigo-600" /> ثالثاً: جدول المطابقة (فعلي vs نظام)</div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Comparison vs Z-Report</span>
                    </div>
                    <table className="w-full text-right text-sm">
                        <thead className="bg-slate-100 text-slate-500 font-black text-[10px] uppercase"><tr className="border-b border-slate-200"><th className="p-4 w-1/3">طريقة الدفع / البند</th><th className="p-4 w-1/4 text-center">الفعلي (Actual)</th><th className="p-4 w-1/4 bg-blue-50 text-blue-800 border-x border-blue-100 text-center">النظام (System)</th><th className="p-4 w-1/4 text-center">الفارق (Diff)</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            <tr className="bg-white font-bold"><td className="p-4 flex items-center gap-2 text-slate-700"><Banknote size={16} className="text-green-600" /> النقد (Cash)</td><td className="p-4 text-center text-green-700 font-mono">{formatCurrency(closing.cashActual)}</td><td className="p-4 text-center text-blue-900 font-mono bg-blue-50/30 border-x border-blue-100/50">{formatCurrency(closing.cashSystem)}</td><td className={`p-4 text-center font-mono font-black ${(closing.cashActual - closing.cashSystem) === 0 ? 'text-slate-300' : (closing.cashActual - closing.cashSystem) < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(closing.cashActual - closing.cashSystem)}</td></tr>
                            {['mada', 'visa', 'master', 'amex', 'gcci'].map((card) => {
                                const actual = Object.keys(closing.details?.terminalDetails || {}).reduce((s, id) => s + getTerminalValue(id, card), 0);
                                const system = getPosInput(card);
                                const diff = actual - system;
                                return (<tr key={card} className="text-slate-600 font-bold"><td className="p-4 pr-10">{CARD_LABELS[card]}</td><td className="p-4 text-center font-mono">{formatCurrency(actual)}</td><td className="p-4 text-center font-mono bg-blue-50/30 border-x border-blue-100/50">{formatCurrency(system)}</td><td className={`p-4 text-center font-bold font-mono ${diff === 0 ? 'text-slate-200' : diff < 0 ? 'text-red-500' : 'text-green-600'}`}>{formatCurrency(diff)}</td></tr>);
                            })}
                            <tr className="bg-red-50/50 text-red-900 font-bold"><td className="p-4 pr-10 flex items-center gap-2"><Tag size={16} /> الخصومات (Discounts)</td><td className="p-4 text-center text-slate-300">-</td><td className="p-4 text-center bg-red-100/20 border-x border-red-100 font-mono">{formatCurrency(discountAmount)}</td><td className="p-4 text-center text-slate-300">-</td></tr>
                            <tr className="bg-slate-50 font-black border-t-2 border-slate-200"><td className="p-4 text-slate-800">إجمالي الشبكة (Total Credits)</td><td className="p-4 text-center text-slate-900 font-mono text-lg">{formatCurrency(closing.cardActual)}</td><td className="p-4 text-center text-blue-800 font-mono text-lg bg-blue-100/50 border-x border-blue-200">{formatCurrency(closing.cardSystem)}</td><td className={`p-4 text-center font-mono text-lg ${(closing.cardActual - closing.cardSystem) === 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(closing.cardActual - closing.cardSystem)}</td></tr>
                        </tbody>
                    </table>
                </div>

                <div className={`p-6 rounded-2xl border-4 flex justify-between items-center shadow-lg ${closing.variance === 0 ? 'bg-green-50 border-green-200 text-green-800' : closing.variance > 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <div><h4 className="font-black text-xl mb-1">العجز / الزيادة الكلي (Net Variance)</h4><p className="text-xs font-bold opacity-70 flex items-center gap-1"><Info size={12} /> الفرق النهائي بين (إجمالي الفعلي) و(إجمالي النظام بدون الخصومات)</p></div>
                    <div className="text-4xl font-black font-mono tracking-tighter">{closing.variance > 0 ? '+' : ''}{formatCurrency(closing.variance)} <span className="text-lg">ر.س</span></div>
                </div>
            </div>
        </div>
        <div className="mt-8 text-center text-[10px] text-slate-300 font-bold uppercase tracking-widest print:mt-4">تم استخراج هذا التقرير آلياً بواسطة نظام مِرفاد المحاسبي • {new Date().toLocaleString('ar-SA')}</div>
      </div>
    </div>
  );
};

export default DailyClosingDetails;
