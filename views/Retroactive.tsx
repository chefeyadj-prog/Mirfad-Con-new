
import React, { useState, useRef, useEffect } from 'react';
import { History, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Table, Save, Trash2, Download, AlertTriangle, Banknote, CreditCard, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';
import { logAction } from '../services/auditLogService';
import { useAuth } from '../context/AuthContext';
import { Supplier } from '../types';
import { round } from '../utils/mathUtils';

const REQUIRED_HEADERS = ['المورد', 'التاريخ', 'رقم الفاتورة', 'الرقم الضريبي', 'المبلغ قبل الضريبة', 'الضريبة', 'الاجمالي'];

const Retroactive: React.FC = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // New state for global payment method
  const [globalPaymentMethod, setGlobalPaymentMethod] = useState<'cash' | 'transfer' | 'credit'>('credit');

  useEffect(() => {
    const fetchSuppliers = async () => {
      const { data } = await supabase.from('suppliers').select('*');
      if (data) setSuppliers(data);
    };
    fetchSuppliers();
  }, []);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([REQUIRED_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "retroactive_purchases_template.xlsx");
  };

  const formatExcelDate = (value: any) => {
    if (value === undefined || value === null || value === '') return '';
    
    try {
      if (value instanceof Date) {
        if (isNaN(value.getTime())) return '';
        return value.toISOString().split('T')[0];
      }
      if (typeof value === 'number') {
        const date = new Date(Math.round((value - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
      }
      const strDate = String(value).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(strDate)) return strDate.split(' ')[0];
      return strDate;
    } catch (e) {
      console.error("Date formatting error:", e);
      return String(value);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = (file: File) => {
    setIsUploading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setPreviewData([]);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true, dateNF: 'yyyy-mm-dd' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (rows.length === 0) throw new Error('الملف فارغ');

        const headers = rows[0].map(h => String(h || '').trim());
        const missingHeaders = REQUIRED_HEADERS.filter(rh => !headers.includes(rh));

        if (missingHeaders.length > 0) {
            setErrorMsg(`فشل التحقق: الأعمدة التالية مفقودة (${missingHeaders.join('، ')})`);
            setIsUploading(false);
            return;
        }

        const json = XLSX.utils.sheet_to_json(worksheet);
        const mapped = json.map((row: any) => ({
          supplier: String(row['المورد'] || '').trim(),
          date: formatExcelDate(row['التاريخ']),
          invoiceNo: String(row['رقم الفاتورة'] || '').trim(),
          taxNo: String(row['الرقم الضريبي'] || '').trim(),
          netAmount: Number(row['المبلغ قبل الضريبة'] || 0),
          vatAmount: Number(row['الضريبة'] || 0),
          totalAmount: Number(row['الاجمالي'] || 0),
        })).filter(r => r.supplier !== '' || r.totalAmount > 0);

        if (mapped.length === 0) {
            setErrorMsg('لا توجد بيانات صالحة في الملف');
        } else {
            setPreviewData(mapped);
        }
      } catch (err: any) {
        setErrorMsg('حدث خطأ أثناء قراءة الملف: ' + (err.message || 'تنسيق غير مدعوم'));
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const saveToDatabase = async () => {
    if (previewData.length === 0) return;
    setIsUploading(true);
    setErrorMsg('');
    
    try {
      const timestamp = Date.now();
      
      const purchaseRecords = previewData.map((item, index) => ({
        id: `RETRO-${timestamp}-${index}-${Math.floor(Math.random() * 100000)}`,
        date: item.date,
        partyName: item.supplier,
        invoiceNumber: String(item.invoiceNo),
        taxNumber: String(item.taxNo),
        amount: Number(item.totalAmount),
        description: `أثر رجعي - مستورد من ملف Excel`,
        paymentMethod: globalPaymentMethod,
        status: 'received',
        isTaxExempt: Number(item.vatAmount) === 0,
        skipInventory: true
      }));

      const { error } = await supabase.from('purchases').insert(purchaseRecords);
      
      if (error) {
          throw new Error(error.message);
      }

      // Update supplier balances only if payment method is "Credit"
      if (globalPaymentMethod === 'credit') {
        for (const record of purchaseRecords) {
          const supplier = suppliers.find(s => s.name === record.partyName);
          if (supplier) {
            const newBalance = round(supplier.balance + record.amount);
            await supabase.from('suppliers').update({ balance: newBalance }).eq('id', supplier.id);
          }
        }
      }

      await logAction(
        user, 
        'create', 
        'الأثر الرجعي', 
        `رفع ملف مشتريات بأثر رجعي [Batch:${timestamp}] يحتوي على ${previewData.length} سجل - طريقة الدفع: ${globalPaymentMethod}`
      );
      
      setSuccessMsg(`تم استيراد ${previewData.length} فاتورة بنجاح بنظام (${globalPaymentMethod === 'cash' ? 'نقدي' : globalPaymentMethod === 'transfer' ? 'حوالة' : 'آجل'}).`);
      setPreviewData([]);
    } catch (err: any) {
      console.error("Save Error:", err);
      setErrorMsg('حدث خطأ أثناء الحفظ: ' + (err.message || 'خطأ في قاعدة البيانات'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <History className="text-indigo-600" size={28} />
            الأثر الرجعي (Retroactive Adjustments)
          </h2>
          <p className="text-slate-500 text-sm mt-1">استيراد المشتريات التاريخية وتعديل الأرصدة عبر Excel</p>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={downloadTemplate}
             className="px-4 py-2 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg flex items-center gap-2 transition-colors border border-slate-200"
           >
             <Download size={18} />
             <span>تحميل النموذج</span>
           </button>
           <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
           >
              {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
              <span>رفع الملف</span>
           </button>
           <input 
             type="file" 
             ref={fileInputRef} 
             className="hidden" 
             accept=".xlsx, .xls" 
             onChange={handleFileSelect} 
           />
        </div>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl flex items-center gap-3 animate-fade-in shadow-sm">
          <CheckCircle2 size={24} className="shrink-0" />
          <p className="font-bold">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3 animate-fade-in shadow-sm">
          <AlertTriangle size={24} className="shrink-0" />
          <div>
            <p className="font-bold">فشل في معالجة البيانات</p>
            <p className="text-sm opacity-90">{errorMsg}</p>
          </div>
        </div>
      )}

      {previewData.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-scale-in">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
             <h3 className="font-bold text-slate-700 flex items-center gap-2 shrink-0">
               <Table size={18} className="text-indigo-500" />
               معاينة البيانات قبل الاعتماد ({previewData.length} سجل)
             </h3>

             {/* Payment Method Selector */}
             <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-slate-200 shadow-sm shrink-0">
                <span className="text-xs font-bold text-slate-400 mr-3">طريقة دفع الفواتير:</span>
                <button 
                    onClick={() => setGlobalPaymentMethod('credit')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${globalPaymentMethod === 'credit' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <Clock size={14} /> آجل
                </button>
                <button 
                    onClick={() => setGlobalPaymentMethod('cash')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${globalPaymentMethod === 'cash' ? 'bg-green-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <Banknote size={14} /> نقدي
                </button>
                <button 
                    onClick={() => setGlobalPaymentMethod('transfer')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${globalPaymentMethod === 'transfer' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <CreditCard size={14} /> حوالة
                </button>
             </div>

             <div className="flex gap-2 mr-auto">
                <button 
                    onClick={() => setPreviewData([])}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                >
                    إلغاء
                </button>
                <button 
                onClick={saveToDatabase}
                disabled={isUploading}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                >
                {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                تأكيد الحفظ النهائي
                </button>
             </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-500 font-bold">
                <tr className="border-b border-slate-100">
                  <th className="p-4">المورد</th>
                  <th className="p-4">التاريخ</th>
                  <th className="p-4">رقم الفاتورة</th>
                  <th className="p-4">قبل الضريبة</th>
                  <th className="p-4">الضريبة</th>
                  <th className="p-4">الاجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-800">{row.supplier}</td>
                    <td className="p-4 text-slate-600 font-mono">{row.date}</td>
                    <td className="p-4 text-slate-500 font-mono">{row.invoiceNo}</td>
                    <td className="p-4 text-slate-600">{row.netAmount.toLocaleString()}</td>
                    <td className="p-4 text-slate-600">{row.vatAmount.toLocaleString()}</td>
                    <td className="p-4 font-bold text-indigo-600">{row.totalAmount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : !successMsg && (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
           <div className="w-24 h-24 bg-indigo-50 text-indigo-400 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <FileSpreadsheet size={48} />
           </div>
           <h3 className="text-xl font-bold text-slate-700 mb-3">رفع بيانات المشتريات التاريخية</h3>
           <p className="max-w-md text-center text-sm leading-relaxed px-6">
              يجب أن يحتوي الملف على الأعمدة التالية تماماً:
              <br />
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-indigo-600 font-bold text-xs dir-rtl">
                {REQUIRED_HEADERS.map(h => <span key={h} className="bg-white p-2 rounded shadow-sm border border-slate-100">{h}</span>)}
              </div>
           </p>
        </div>
      )}
    </div>
  );
};

export default Retroactive;
