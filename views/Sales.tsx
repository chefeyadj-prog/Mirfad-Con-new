
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Search, Lock, Calendar, Calculator, Coins, FileText, Banknote, ArrowRight, Eye, Edit, X, CreditCard, Server, Trash2, AlertTriangle, CheckCircle2, Save, Tag, Info, Gift, TrendingUp, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DailyClosing } from '../types';
import DateFilter, { DateRange } from '../components/DateFilter';
import { supabase } from '../services/supabaseClient';
import { logAction } from '../services/auditLogService';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import { round, calculateNetFromGross } from '../utils/mathUtils';
import * as XLSX from 'xlsx';

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

const Sales: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasFeature } = usePermissions();
  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ label: 'الكل', start: null, end: null });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [selectedClosingForEdit, setSelectedClosingForEdit] = useState<DailyClosing | null>(null);

  const [closingDate, setClosingDate] = useState(new Date().toISOString().split('T')[0]);
  const [cashDenominations, setCashDenominations] = useState({ 500: '', 200: '', 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' });
  const [terminalInputs, setTerminalInputs] = useState<Record<string, Record<string, string>>>({});
  const [posInputs, setPosInputs] = useState({ cash: '', mada: '', visa: '', master: '', amex: '', gcci: '', discount: '', tips: '' });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [closingToDelete, setClosingToDelete] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  const fetchClosings = async () => {
    try {
      const { data } = await supabase.from('dailyClosings').select('*').order('date', { ascending: false });
      if (data) setClosings(data);
    } catch (err) { console.error("Error fetching closings:", err); }
  };

  useEffect(() => {
    fetchClosings();
    const channel = supabase.channel('sales-live-v16')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dailyClosings' }, fetchClosings)
        .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const initialTerminals: Record<string, Record<string, string>> = {};
    FIXED_TERMINAL_IDS.forEach(id => { initialTerminals[id] = { mada: '', visa: '', master: '', amex: '', gcci: '' }; });
    setTerminalInputs(initialTerminals);
  }, []);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);

  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
    } else {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      }
    }
  };

  const renderSortIcon = (key: string) => {
    if (sortKey !== key) return '⇅';
    if (sortDirection === 'asc') return '↑';
    if (sortDirection === 'desc') return '↓';
    return '⇅';
  };

  const totalCashActualVal: number = round(Object.entries(cashDenominations).reduce<number>((sum, [denom, count]) => sum + (Number(denom) * (Number(count) || 0)), 0));
  const totalCardActualVal: number = round(Object.values(terminalInputs).reduce<number>((sum: number, term: any) => sum + (Number(term.mada)||0) + (Number(term.visa)||0) + (Number(term.master)||0) + (Number(term.amex)||0) + (Number(term.gcci)||0), 0) );
  const totalActualVal: number = round(totalCashActualVal + totalCardActualVal);

  const totalPosCash: number = Number(posInputs.cash) || 0;
  const totalPosCredits: number = round((Number(posInputs.mada) || 0) + (Number(posInputs.visa) || 0) + (Number(posInputs.master) || 0) + (Number(posInputs.amex) || 0) + (Number(posInputs.gcci) || 0));
  const discountSystem: number = Number(posInputs.discount) || 0;
  const tipsAmountVal: number = Number(posInputs.tips) || 0;

  const totalSystemNet: number = round(totalPosCash + totalPosCredits);
  const grossBeforeDiscount: number = round(totalSystemNet + discountSystem);
  const netBeforeDiscount: number = calculateNetFromGross(grossBeforeDiscount);
  const vatBeforeDiscount: number = round(grossBeforeDiscount - netBeforeDiscount);
  const netRevenueFinal: number = round(totalSystemNet - tipsAmountVal);
  const totalVariance: number = round(totalActualVal - totalSystemNet);

  const handleTerminalChange = (termId: string, cardType: string, value: string) => {
      setTerminalInputs(prev => ({ ...prev, [termId]: { ...prev[termId], [cardType]: value } }));
  };

  const handleDenomChange = (denom: string, val: string) => setCashDenominations(prev => ({...prev, [denom]: val}));
  const handlePosChange = (field: string, val: string) => setPosInputs(prev => ({...prev, [field]: val}));

  const handleSaveClosing = async () => {
    if (totalSystemNet === 0 && totalCashActualVal === 0) { alert("يرجى إدخال بيانات الإقفال أولاً"); return; }
    const formattedTerminalDetails: Record<string, Record<string, number>> = {};
    Object.entries(terminalInputs).forEach(([termId, cards]: [string, any]) => {
        formattedTerminalDetails[termId] = { mada: Number(cards.mada) || 0, visa: Number(cards.visa) || 0, master: Number(cards.master) || 0, amex: Number(cards.amex) || 0, gcci: Number(cards.gcci) || 0 };
    });
    const closingData = { date: closingDate, createdAt: new Date().toISOString(), cashActual: totalCashActualVal, cardActual: totalCardActualVal, totalActual: totalActualVal, cashSystem: totalPosCash, cardSystem: totalPosCredits, totalSystem: totalSystemNet, variance: totalVariance, netSales: netBeforeDiscount, vatAmount: vatBeforeDiscount, discountAmount: discountSystem, grossSales: totalSystemNet, tips: tipsAmountVal, details: { cashDenominations: Object.fromEntries(Object.entries(cashDenominations).map(([k, v]) => [k, Number(v) || 0])), posInputs: Object.fromEntries(Object.entries(posInputs).map(([k, v]) => [k, Number(v) || 0])), terminalDetails: formattedTerminalDetails } };
    try {
      if (editingId) { await supabase.from('dailyClosings').update(closingData).eq('id', editingId); await logAction(user, 'update', 'المبيعات', `تعديل إقفال بتاريخ ${closingDate}`); }
      else { await supabase.from('dailyClosings').insert({ id: `CLOSE-${Date.now()}`, ...closingData }); await logAction(user, 'create', 'المبيعات', `تسجيل إقفال جديد بتاريخ ${closingDate}`); }
      setShowClosingModal(false);
      resetForm();
    } catch (err) { alert("حدث خطأ أثناء حفظ البيانات في النظام"); }
  };

  const resetForm = () => {
    setEditingId(null);
    setClosingDate(new Date().toISOString().split('T')[0]);
    setCashDenominations({ 500: '', 200: '', 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' });
    const initialTerminals: Record<string, Record<string, string>> = {};
    FIXED_TERMINAL_IDS.forEach(id => { initialTerminals[id] = { mada: '', visa: '', master: '', amex: '', gcci: '' }; });
    setTerminalInputs(initialTerminals);
    setPosInputs({ cash: '', mada: '', visa: '', master: '', amex: '', gcci: '', discount: '', tips: '' });
  };

  const filteredClosings = useMemo(() => {
    let result = closings.filter(c => {
      const matchesSearch = c.date.includes(searchTerm) || c.id.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesDate = true;
      if (dateRange.start && dateRange.end) { const cDate = new Date(c.date); matchesDate = cDate >= dateRange.start && cDate <= dateRange.end; }
      return matchesSearch && matchesDate;
    });

    if (sortKey && sortDirection) {
      result = [...result].sort((a: any, b: any) => {
        let valA, valB;
        if (sortKey === 'grossBefore') {
          valA = (a.totalSystem || 0) + (a.discountAmount || 0);
          valB = (b.totalSystem || 0) + (b.discountAmount || 0);
        } else if (sortKey === 'netIncome') {
          valA = (a.totalSystem || 0) - (a.tips || 0);
          valB = (b.totalSystem || 0) - (b.tips || 0);
        } else {
          valA = a[sortKey];
          valB = b[sortKey];
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [closings, searchTerm, dateRange, sortKey, sortDirection]);

  const totalsSummary = useMemo(() => {
    return filteredClosings.reduce((acc, c) => {
      const gBefore = (c.totalSystem || 0) + (c.discountAmount || 0);
      const nIncome = (c.totalSystem || 0) - (c.tips || 0);
      return {
        grossBefore: acc.grossBefore + gBefore,
        discount: acc.discount + (c.discountAmount || 0),
        totalSystem: acc.totalSystem + (c.totalSystem || 0),
        tips: acc.tips + (c.tips || 0),
        netIncome: acc.netIncome + nIncome,
        cashActual: acc.cashActual + (c.cashActual || 0),
        cardActual: acc.cardActual + (c.cardActual || 0),
        variance: acc.variance + (c.variance || 0)
      };
    }, {
      grossBefore: 0, discount: 0, totalSystem: 0, tips: 0, netIncome: 0, cashActual: 0, cardActual: 0, variance: 0
    });
  }, [filteredClosings]);

  const exportToExcel = () => {
    if (filteredClosings.length === 0) {
        alert("لا توجد بيانات للتصدير");
        return;
    }

    const excelData = filteredClosings.map(c => {
        const grossBefore = (c.totalSystem || 0) + (c.discountAmount || 0);
        const netIncome = (c.totalSystem || 0) - (c.tips || 0);
        return {
            'التاريخ': c.date,
            'الإجمالي قبل الخصم': grossBefore,
            'الخصومات': c.discountAmount,
            'الإجمالي بعد الخصم': c.totalSystem,
            'المكافآت': c.tips,
            'صافي الدخل': netIncome,
            'النقد الفعلي': c.cashActual,
            'الشبكة الفعلية': c.cardActual,
            'العجز / الزيادة': c.variance
        };
    });

    excelData.push({
        'التاريخ': 'الإجمالي الكلي',
        'الإجمالي قبل الخصم': totalsSummary.grossBefore,
        'الخصومات': totalsSummary.discount,
        'الإجمالي بعد الخصم': totalsSummary.totalSystem,
        'المكافآت': totalsSummary.tips,
        'صافي الدخل': totalsSummary.netIncome,
        'النقد الفعلي': totalsSummary.cashActual,
        'الشبكة الفعلية': totalsSummary.cardActual,
        'العجز / الزيادة': totalsSummary.variance
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Z-Reports");

    const wscols = [
        { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    ];
    worksheet['!cols'] = wscols;

    const fileName = `سجل_الإقفالات_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const verifyAndEdit = () => {
    if (authPassword === '1234') {
        if (selectedClosingForEdit) {
            setEditingId(selectedClosingForEdit.id);
            setClosingDate(selectedClosingForEdit.date);
            if (selectedClosingForEdit.details) {
                const toStr = (obj: any) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === 0 ? '' : String(v)]));
                if (selectedClosingForEdit.details.cashDenominations) setCashDenominations(prev => ({ ...prev, ...toStr(selectedClosingForEdit.details.cashDenominations) }));
                
                if (selectedClosingForEdit.details.terminalDetails) {
                    const loaded: Record<string, Record<string, string>> = {};
                    FIXED_TERMINAL_IDS.forEach(id => { loaded[id] = { mada: '', visa: '', master: '', amex: '', gcci: '' }; });
                    Object.entries(selectedClosingForEdit.details.terminalDetails).forEach(([id, saved]: [string, any]) => {
                        loaded[id] = toStr(saved);
                    });
                    setTerminalInputs(loaded);
                }
                if (selectedClosingForEdit.details.posInputs) setPosInputs(prev => ({ ...prev, ...toStr(selectedClosingForEdit.details.posInputs) }));
            }
            setShowClosingModal(true);
        }
        setIsAuthModalOpen(false);
    } else setAuthError('كلمة المرور غير صحيحة');
  };

  const confirmDelete = async () => {
    if (deletePassword === '1234') {
        if (closingToDelete) {
            try {
              const closing = closings.find(c => c.id === closingToDelete);
              if (closing) await logAction(user, 'delete', 'المبيعات', `حذف إقفال يومي بتاريخ ${closing.date}`);
              await supabase.from('dailyClosings').delete().eq('id', closingToDelete);
            } catch (err) { console.error("Error during deletion:", err); }
        }
        setIsDeleteModalOpen(false);
        setClosingToDelete(null);
    } else setDeleteError('كلمة المرور غير صحيحة');
  };

  return (
    <div className="font-cairo bg-slate-50 min-h-screen">
      <div className="max-w-[1600px] mx-auto p-4 text-right" dir="rtl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Lock className="text-indigo-600" size={26} /> 
                    سجل الإقفالات اليومية (Z-Reports)
                </h2>
                <p className="text-slate-500 text-sm mt-1">متابعة مبيعات النظام ومطابقتها مع الجرد الفعلي (Realtime)</p>
            </div>
            {hasFeature('sales', 'canAdd') && (
                <button
                  onClick={() => { resetForm(); setShowClosingModal(true); }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-md transition-colors font-black text-sm"
                >
                    <Plus size={18} />
                    <span>تسجيل إقفال جديد</span>
                </button>
            )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-50">
                <div className="relative w-full max-w-md">
                    <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="بحث بالتاريخ..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-base font-bold text-slate-700 placeholder:text-slate-400 text-center"
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {hasFeature('sales', 'canExport') && (
                        <button 
                            onClick={exportToExcel}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors font-black text-sm"
                        >
                            <FileSpreadsheet size={18} />
                            <span>تصدير Excel</span>
                        </button>
                    )}
                    {hasFeature('sales', 'canFilter') && <DateFilter onFilterChange={setDateRange} />}
                </div>
            </div>

            {hasFeature('sales', 'showList') ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-center text-base">
                        <thead className="bg-white text-slate-600 border-b border-slate-100">
                            <tr className="font-black">
                                <th onClick={() => handleSort('date')} className="p-4 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors text-center border-l border-slate-50">التاريخ {renderSortIcon('date')}</th>
                                <th onClick={() => handleSort('grossBefore')} className="p-4 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors text-center">الإجمالي قبل الخصم {renderSortIcon('grossBefore')}</th>
                                <th onClick={() => handleSort('discountAmount')} className="p-4 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors text-center">الخصومات {renderSortIcon('discountAmount')}</th>
                                <th onClick={() => handleSort('totalSystem')} className="p-4 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors text-center">الإجمالي بعد الخصم {renderSortIcon('totalSystem')}</th>
                                <th onClick={() => handleSort('tips')} className="p-4 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors text-center">المكافآت {renderSortIcon('tips')}</th>
                                <th onClick={() => handleSort('netIncome')} className="p-4 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors text-center">صافي الدخل {renderSortIcon('netIncome')}</th>
                                <th onClick={() => handleSort('cashActual')} className="p-4 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors text-center">النقد الفعلي {renderSortIcon('cashActual')}</th>
                                <th onClick={() => handleSort('cardActual')} className="p-4 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors text-center">الشبكة الفعلية {renderSortIcon('cardActual')}</th>
                                <th onClick={() => handleSort('variance')} className="p-4 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors text-center">العجز / الزيادة {renderSortIcon('variance')}</th>
                                <th className="p-4 whitespace-nowrap text-center border-r border-slate-50">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredClosings.map((closing) => {
                            const grossBefore = (closing.totalSystem || 0) + (closing.discountAmount || 0);
                            const netIncome = (closing.totalSystem || 0) - (closing.tips || 0);
                            return (
                                <tr key={closing.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-black text-slate-800 whitespace-nowrap text-center border-l border-slate-50">{closing.date}</td>
                                    <td className="p-4 font-black text-slate-700 font-mono text-center">{formatCurrency(grossBefore)}</td>
                                    <td className="p-4 font-black text-red-700 font-mono text-center">{formatCurrency(closing.discountAmount)}</td>
                                    <td className="p-4 font-black text-blue-800 bg-blue-50/20 font-mono text-center">{formatCurrency(closing.totalSystem)}</td>
                                    <td className="p-4 font-black text-blue-600 font-mono text-center">{formatCurrency(closing.tips)}</td>
                                    <td className="p-4 font-black text-indigo-800 font-mono text-center">{formatCurrency(netIncome)}</td>
                                    <td className="p-4 font-black text-slate-700 font-mono text-center">{formatCurrency(closing.cashActual)}</td>
                                    <td className="p-4 font-black text-slate-700 font-mono text-center">{formatCurrency(closing.cardActual)}</td>
                                    <td className="p-4 whitespace-nowrap text-center">
                                        <span className={`inline-flex items-center justify-center px-4 py-1.5 rounded-full text-sm font-black font-mono min-w-[110px] ${closing.variance === 0 ? 'bg-slate-100 text-slate-500' : closing.variance > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {closing.variance > 0 ? '+' : ''}{formatCurrency(closing.variance)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center border-r border-slate-50">
                                        <div className="flex justify-center gap-2">
                                            {hasFeature('sales', 'canView') && <button onClick={() => navigate(`/sales/${closing.id}`)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Eye size={22} /></button>}
                                            {hasFeature('sales', 'canEdit') && <button onClick={() => { setSelectedClosingForEdit(closing); setIsAuthModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Edit size={22} /></button>}
                                            {hasFeature('sales', 'canDelete') && <button onClick={() => { setClosingToDelete(closing.id); setIsDeleteModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={22} /></button>}
                                        </div>
                                    </td>
                                </tr>
                            );
                            })}
                        </tbody>
                        {hasFeature('sales', 'showGrandTotal') && (
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                <tr className="font-black text-slate-900 text-lg text-center">
                                    <td className="p-5 text-center border-l border-slate-200">الإجمالي الكلي</td>
                                    <td className="p-5 font-mono text-center">{formatCurrency(totalsSummary.grossBefore)}</td>
                                    <td className="p-5 font-mono text-red-800 text-center">{formatCurrency(totalsSummary.discount)}</td>
                                    <td className="p-5 font-mono text-blue-900 bg-blue-100/30 text-center">{formatCurrency(totalsSummary.totalSystem)}</td>
                                    <td className="p-5 font-mono text-blue-700 text-center">{formatCurrency(totalsSummary.tips)}</td>
                                    <td className="p-5 font-mono text-indigo-900 text-center">{formatCurrency(totalsSummary.netIncome)}</td>
                                    <td className="p-5 font-mono text-center">{formatCurrency(totalsSummary.cashActual)}</td>
                                    <td className="p-5 font-mono text-center">{formatCurrency(totalsSummary.cardActual)}</td>
                                    <td className="p-5 whitespace-nowrap text-center">
                                        <span className={`inline-flex items-center justify-center px-5 py-2 rounded-full font-black font-mono min-w-[130px] ${totalsSummary.variance === 0 ? 'bg-slate-200 text-slate-600' : totalsSummary.variance > 0 ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                            {totalsSummary.variance > 0 ? '+' : ''}{formatCurrency(totalsSummary.variance)}
                                        </span>
                                    </td>
                                    <td className="border-r border-slate-200" />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            ) : (
                <div className="p-20 text-center text-slate-400 font-bold bg-slate-50/50">عذراً، لا تملك صلاحية عرض سجل الإقفالات.</div>
            )}
        </div>
      </div>

      {showClosingModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-hidden text-right" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1200px] h-[95vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-l from-indigo-900 to-indigo-700 text-white p-4 flex justify-between items-center shrink-0 border-b border-white/10">
              <div className="flex items-center gap-3">
                <button className="bg-white/10 p-2 rounded-lg hover:bg-white/20 transition-colors" onClick={() => setShowClosingModal(false)} aria-label="Close"><ArrowRight size={22} /></button>
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    {editingId ? 'تعديل تقرير الإقفال' : 'تسجيل إقفال يومي جديد'}
                    <FileText size={22} className="text-indigo-200" />
                  </h3>
                  <p className="text-indigo-100 text-xs mt-1">مطابقة مبيعات النظام مع الجرد الفعلي</p>
                </div>
              </div>
              <div className="bg-white/10 px-4 py-2 rounded-lg flex items-center gap-2 border border-white/20">
                <span className="font-bold text-xs">تاريخ الإقفال:</span>
                <input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} className="bg-transparent border-none text-white font-bold text-sm focus:ring-0 cursor-pointer" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-4 space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2"><Coins size={18} className="text-indigo-600" /> أولاً: الجرد الفعلي للنقد (العهدة)</div>
                    </div>
                    <div className="p-4 space-y-2">
                      {[500, 200, 100, 50, 20, 10, 5, 1].map(denom => (
                        <div key={denom} className="flex items-center justify-between gap-3">
                          <div className="w-14 font-bold text-slate-600 bg-slate-100 py-1 px-2 rounded text-center text-xs">{denom}</div>
                          <input type="number" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-center font-bold text-slate-800 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 placeholder:text-slate-300" placeholder="العدد" value={(cashDenominations as any)[denom]} onChange={(e) => handleDenomChange(String(denom), e.target.value)} />
                          <div className="w-20 text-left font-mono text-xs font-bold text-slate-500">{(Number(denom) * (Number((cashDenominations as any)[denom]) || 0)).toFixed(2)}</div>
                        </div>
                      ))}
                      <div className="pt-4 border-t border-slate-100 flex justify-between items-center bg-indigo-50/40 p-3 rounded-lg">
                        <span className="text-xs font-bold text-slate-700">إجمالي النقد الموجود:</span>
                        <span className="text-lg font-bold text-indigo-700 font-mono">{formatCurrency(totalCashActualVal)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 flex items-center gap-2 text-sm"><Calculator size={18} className="text-indigo-600" /> الملخص المالي</div>
                    <div className="p-4 space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 block">صافي المبيعات (Net Sales)</label>
                        <div className="bg-slate-100 p-2 rounded-lg font-bold text-right font-mono text-slate-800 text-sm border border-slate-200">{formatCurrency(netBeforeDiscount)}</div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 block">ضريبة 15% (VAT)</label>
                        <div className="bg-slate-100 p-2 rounded-lg font-bold text-right font-mono text-slate-800 text-sm border border-slate-200">{formatCurrency(vatBeforeDiscount)}</div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-indigo-600 block">الإجمالي قبل الخصم</label>
                        <div className="bg-indigo-50/60 border border-indigo-100 p-2 rounded-lg font-bold text-right font-mono text-indigo-900 text-sm">{formatCurrency(grossBeforeDiscount)}</div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-red-600 block">قيمة الخصم (Discount)</label>
                        <input type="number" className="w-full text-center bg-red-50/40 border border-red-200 rounded-lg p-2 font-bold text-red-700 outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 text-sm placeholder:text-red-300" value={posInputs.discount} onChange={(e) => handlePosChange('discount', e.target.value)} placeholder="0.00" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 block">الإجمالي بعد الخصم</label>
                        <div className="bg-slate-100 p-2 rounded-lg font-bold text-right font-mono text-slate-800 text-sm border border-slate-200">{formatCurrency(totalSystemNet)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-emerald-50 border-b border-emerald-100 font-bold text-emerald-900 flex items-center gap-2 text-sm"><TrendingUp size={18} /> صافي الدخل</div>
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-center text-slate-600 font-bold text-xs">
                        <span>الإجمالي بعد الخصم</span>
                        <span className="font-mono">{formatCurrency(totalSystemNet)}</span>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-blue-600 flex items-center gap-1"><Gift size={12} /> المكافآت (Tips)</label>
                        <input type="number" className="w-full text-center bg-blue-50/40 border border-blue-200 rounded-lg p-2 font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-sm placeholder:text-blue-300" value={posInputs.tips} onChange={(e) => handlePosChange('tips', e.target.value)} placeholder="0.00" />
                      </div>
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-center shadow-md">
                        <span className="block text-[11px] font-bold text-indigo-300 mb-1">صافي الإيراد النهائي</span>
                        <span className="text-2xl font-bold font-mono text-white">{formatCurrency(netRevenueFinal)}</span>
                        <div className="mt-1 text-[10px] text-slate-400 font-bold tracking-widest italic">Checked &amp; Verified</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 flex flex-col">
                      <div className="flex items-center gap-2 text-sm"><Server size={18} className="text-indigo-600" /> ثانياً: إدخال مبيعات أجهزة الشبكة</div>
                      <span className="text-[11px] text-slate-500 font-medium mr-6">قم بتسجيل مبالغ الشبكة لكل جهاز على حدة، سيتم جمعها تلقائياً</span>
                    </div>
                    <div className="p-4 overflow-x-auto">
                      <table className="w-full text-center border-collapse text-sm">
                        <thead>
                          <tr className="text-indigo-700 font-bold border-b border-slate-100 bg-indigo-50/40">
                            <th className="p-3 w-28 text-center">رقم الجهاز</th>
                            <th className="p-3 text-center">مدى</th>
                            <th className="p-3 text-center">فيزا</th>
                            <th className="p-3 text-center">ماستر</th>
                            <th className="p-3 text-center">أمريكان</th>
                            <th className="p-3 text-center">الخليج</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {FIXED_TERMINAL_IDS.map(termId => (
                            <tr key={termId} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 font-mono font-bold text-slate-700 bg-slate-50 border-l text-center">{termId}</td>
                              {['mada', 'visa', 'master', 'amex', 'gcci'].map(card => (
                                <td key={card} className="p-2">
                                  <input type="number" className="w-full border border-slate-200 rounded-lg p-2 text-center font-bold text-slate-700 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm placeholder:text-slate-300" value={terminalInputs[termId]?.[card] || ''} onChange={(e) => handleTerminalChange(termId, card, e.target.value)} placeholder="0" />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                          <tr className="text-slate-700">
                            <td className="p-3 text-sm text-center">الإجمالي</td>
                            {['mada', 'visa', 'master', 'amex', 'gcci'].map(card => (
                              <td key={card} className="p-3 font-mono text-sm text-indigo-700 text-center">{formatCurrency(Object.values(terminalInputs).reduce<number>((s: number, t: any) => s + (Number(t[card]) || 0), 0))}</td>
                            ))}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 flex flex-col">
                      <div className="flex items-center gap-2 text-sm"><CheckCircle2 size={18} className="text-indigo-600" /> ثالثاً: جدول المطابقة (فعلي vs نظام)</div>
                      <span className="text-[11px] text-slate-500 font-medium mr-6">مقارنة الإجمالي الفعلي (من الجدول أعلاه) مع تقرير النظام</span>
                    </div>
                    <div className="p-4">
                      <table className="w-full text-right text-sm">
                        <thead>
                          <tr className="text-slate-500 font-bold text-xs border-b border-slate-200">
                            <th className="pb-3 w-44">طريقة الدفع</th>
                            <th className="pb-3 text-center">الفعلي</th>
                            <th className="pb-3 text-center text-indigo-700 bg-indigo-50/30">النظام / Z</th>
                            <th className="pb-3 text-center">الفارق</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr className="bg-white">
                            <td className="p-4 font-bold text-slate-800 flex items-center gap-2"><Banknote size={18} className="text-green-600" /> النقد (Cash)</td>
                            <td className="p-4 text-center">
                              <div className="font-mono font-bold text-green-700">{formatCurrency(totalCashActualVal)}</div>
                              <div className="text-[10px] text-slate-400 font-medium mt-1">يتم حسابه من الجرد يمين الشاشة</div>
                            </td>
                            <td className="p-4 bg-indigo-50/30 border-x border-indigo-100">
                              <input type="number" className="w-full text-center font-bold text-indigo-700 text-sm border border-indigo-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 placeholder:text-indigo-300" value={posInputs.cash} onChange={(e) => handlePosChange('cash', e.target.value)} placeholder="مبيعات الكاش في النظام" />
                            </td>
                            <td className={`p-4 text-center font-mono font-bold ${(totalCashActualVal - totalPosCash) === 0 ? 'text-slate-300' : (totalCashActualVal - totalPosCash) < 0 ? 'text-red-600' : 'text-green-700'}`}>
                              {totalCashActualVal - totalPosCash === 0 ? '-' : formatCurrency(totalCashActualVal - totalPosCash)}
                            </td>
                          </tr>
                          <tr className="bg-white">
                            <td className="p-4 font-bold text-slate-800 flex items-center gap-2"><Tag size={18} className="text-red-500" /> الخصومات (Discounts)</td>
                            <td className="p-4 text-center text-slate-300">-</td>
                            <td className="p-4 bg-indigo-50/30 border-x border-indigo-100">
                              <input type="number" className="w-full text-center font-bold text-indigo-700 text-sm border border-indigo-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 placeholder:text-indigo-300" value={posInputs.discount} onChange={(e) => handlePosChange('discount', e.target.value)} placeholder="0.00" />
                            </td>
                            <td className="p-4 text-center text-slate-300">-</td>
                          </tr>
                          {['mada', 'visa', 'master', 'amex', 'gcci'].map(key => {
                            const act: number = Object.values(terminalInputs).reduce<number>((s: number, t: any) => s + (Number(t[key]) || 0), 0);
                            const sys: number = Number((posInputs as any)[key]) || 0;
                            const diff: number = round(act - sys);
                            return (
                              <tr key={key} className="hover:bg-slate-50/40 transition-colors">
                                <td className="p-3 pr-8 text-slate-700 font-medium">{CARD_LABELS[key]}</td>
                                <td className="p-3 text-center font-mono text-slate-600 font-bold">{act === 0 ? '-' : formatCurrency(act)}</td>
                                <td className="p-3 bg-indigo-50/20 border-x border-indigo-100">
                                  <input type="number" className="w-full text-center font-bold text-indigo-700 text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 placeholder:text-indigo-300" value={(posInputs as any)[key]} onChange={(e) => handlePosChange(key, e.target.value)} placeholder="مبيعات الشبكة في النظام" />
                                </td>
                                <td className={`p-3 text-center font-mono font-bold ${diff === 0 ? 'text-slate-300' : diff < 0 ? 'text-red-600' : 'text-green-700'}`}>
                                  {diff === 0 ? '-' : formatCurrency(diff)}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-slate-50 font-bold text-sm border-t border-slate-200">
                            <td className="p-4 text-slate-800">إجمالي الشبكة</td>
                            <td className="p-4 text-center font-mono text-slate-800">{formatCurrency(totalCardActualVal)}</td>
                            <td className="p-4 text-center bg-indigo-50 text-indigo-900 border-x border-indigo-100 font-mono">{formatCurrency(totalPosCredits)}</td>
                            <td className={`p-4 text-center font-mono ${round(totalCardActualVal - totalPosCredits) === 0 ? 'text-green-700' : 'text-red-600'}`}>{formatCurrency(totalCardActualVal - totalPosCredits)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className={`p-5 rounded-xl border flex flex-col md:flex-row justify-between items-center shadow-sm ${totalVariance === 0 ? 'bg-indigo-50 border-indigo-100' : totalVariance > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="text-center md:text-right mb-4 md:mb-0">
                      <h4 className={`font-bold text-lg mb-1 ${totalVariance === 0 ? 'text-indigo-900' : totalVariance > 0 ? 'text-green-900' : 'text-red-900'}`}>العجز / الزيادة الكلي</h4>
                      <p className="text-xs font-medium text-slate-500">الفرق النهائي بين إجمالي الفعلي ومجموع إجمالي النظام</p>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className={`text-3xl font-bold font-mono ${totalVariance === 0 ? 'text-slate-500' : totalVariance > 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {totalVariance > 0 ? '+' : ''}{formatCurrency(totalVariance)}
                      </span>
                      <span className="text-sm font-bold text-slate-400">ر.س</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-white flex flex-col md:flex-row gap-3 shrink-0">
              <button onClick={handleSaveClosing} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md transition-colors flex items-center justify-center gap-2 text-sm" >
                <Lock size={18} /> {editingId ? 'حفظ التعديلات النهائية' : 'حفظ وإقفال اليومية'}
              </button>
              <button onClick={() => setShowClosingModal(false)} className="px-8 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors text-sm" > إلغاء </button>
            </div>
          </div>
        </div>
      )}
      
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-sm overflow-hidden border border-slate-200 text-right">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">تأكيد صلاحية المدير</h3>
              <button onClick={() => setIsAuthModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6">
              <p className="text-slate-500 text-sm text-center mb-5 font-medium">يرجى إدخل رمز المرور للسماح بتعديل بيانات الإقفال المسجلة.</p>
              <input type="password" autoFocus className={`w-full p-3 border rounded-lg text-center font-mono text-lg outline-none mb-2 ${authError ? 'border-red-500 bg-red-50' : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'}`} placeholder="****" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && verifyAndEdit()} />
              {authError && <p className="text-xs text-red-500 mt-2 text-center font-bold">{authError}</p>}
              <button onClick={verifyAndEdit} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-bold mt-4 hover:bg-indigo-700 shadow-md transition-colors">تحقق ومتابعة التعديل</button>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-red-100 text-right">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><AlertTriangle size={28} /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">حذف الإقفال؟</h3>
              <p className="text-slate-500 text-sm mb-6 font-medium">أنت على وشك حذف هذا الإقفال نهائياً. لا يمكن التراجع عن هذه الخطوة.</p>
              <div className="mb-4 text-right">
                <label className="block text-xs font-bold text-slate-700 mb-1">كلمة مرور المدير</label>
                <input type="password" className={`w-full p-2.5 border rounded-lg text-center font-mono outline-none bg-white text-slate-700 ${deleteError ? 'border-red-500 bg-red-50' : 'border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'}`} placeholder="****" autoFocus value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmDelete()} />
                {deleteError && <p className="text-xs text-red-500 mt-1 font-bold text-center">{deleteError}</p>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold transition-colors">إلغاء</button>
                <button onClick={confirmDelete} className="flex-1 py-2.5 text-white bg-red-600 hover:bg-red-700 rounded-lg font-bold shadow-md transition-colors">حذف الآن</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
