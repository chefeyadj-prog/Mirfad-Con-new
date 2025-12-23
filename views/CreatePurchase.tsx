
import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Plus, Trash2, Save, Paperclip, CheckCircle, Loader2, Info, Search, ChevronDown, UserPlus, AlertTriangle, AlertCircle, FileSpreadsheet, Download, Layers, X, FileImage, Tag } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { analyzeInvoiceImage, ImageDataInput } from '../services/geminiService';
import { Supplier, Purchase, InvoiceItem, Product } from '../types';
import { supabase } from '../services/supabaseClient';
import { logAction } from '../services/auditLogService';
import { useAuth } from '../context/AuthContext';
import { round, calculateTax } from '../utils/mathUtils';
import * as XLSX from 'xlsx';

const CreatePurchase: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryProducts, setInventoryProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  
  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
        const { data: sData } = await supabase.from('suppliers').select('*');
        if (sData) setSuppliers(sData);
        
        const { data: pData } = await supabase.from('products').select('*');
        if (pData) setInventoryProducts(pData);

        const { data: purData } = await supabase.from('purchases').select('*');
        if (purData) setPurchases(purData);
    };
    fetchData();
  }, []);

  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const supplierDropdownRef = useRef<HTMLDivElement>(null);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState('SAR');
  const [taxNumber, setTaxNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'transfer'>('credit');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSuccessMsg, setAnalysisSuccessMsg] = useState('');
  const [analysisErrorMsg, setAnalysisErrorMsg] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [skipInventory, setSkipInventory] = useState(false);

  const [items, setItems] = useState<InvoiceItem[]>([{ id: '1', code: '', description: '', quantity: 1, unitPrice: 0 }]);

  useEffect(() => {
    if (id && purchases.length > 0) {
      const purchaseToEdit = purchases.find((p) => p.id === id);
      if (purchaseToEdit) {
        setInvoiceNumber(purchaseToEdit.invoiceNumber || purchaseToEdit.id);
        setDate(purchaseToEdit.date);
        const supplier = suppliers.find(s => s.name === purchaseToEdit.partyName);
        if (supplier) setSupplierId(supplier.id);
        setCurrency(purchaseToEdit.currency || 'SAR');
        setTaxNumber(purchaseToEdit.taxNumber || '');
        setPaymentMethod(purchaseToEdit.paymentMethod || 'credit');
        setDiscountAmount(purchaseToEdit.discountAmount || 0);
        if (purchaseToEdit.items && purchaseToEdit.items.length > 0) setItems(purchaseToEdit.items);
        setSkipInventory(purchaseToEdit.skipInventory || false);
      }
    }
  }, [id, purchases, suppliers]);

  useEffect(() => {
    const selected = suppliers.find(s => s.id === supplierId);
    if (selected) {
        setSupplierSearchTerm(selected.name);
        setTaxNumber(selected.taxNumber || '');
    }
  }, [supplierId, suppliers]);

  useEffect(() => {
    if (invoiceNumber && supplierId) {
        const currentSupplier = suppliers.find(s => s.id === supplierId);
        if (currentSupplier) {
            const exists = purchases.some(p => {
                if (id && p.id === id) return false;
                return (p.invoiceNumber === invoiceNumber || p.id === invoiceNumber) && p.partyName === currentSupplier.name;
            });
            setDuplicateWarning(exists ? `رقم الفاتورة مسجل مسبقاً للمورد (${currentSupplier.name})` : null);
        }
    } else {
        setDuplicateWarning(null);
    }
  }, [invoiceNumber, supplierId, id, suppliers, purchases]);

  const filteredSuppliers = suppliers.filter(s => {
      const term = supplierSearchTerm.toLowerCase();
      return s.name.toLowerCase().includes(term) || (s.phone && s.phone.includes(term)) || (s.code && s.code.includes(term)) || (s.taxNumber && s.taxNumber.includes(term));
  });

  const selectSupplier = (supplier: Supplier) => {
      setSupplierId(supplier.id);
      setSupplierSearchTerm(supplier.name);
      setTaxNumber(supplier.taxNumber || "");
      setIsSupplierDropdownOpen(false);
  };

  const handleAddItem = () => setItems([...items, { id: Date.now().toString(), code: '', description: '', quantity: 1, unitPrice: 0 }]);
  const handleRemoveItem = (id: string) => { if (items.length > 1) setItems(items.filter(item => item.id !== id)); };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    let updatedItems = items.map(item => item.id === id ? { ...item, [field]: value } : item);
    if (field === 'code') {
        const code = value as string;
        const product = inventoryProducts.find(p => p.sku.toLowerCase() === code.toLowerCase());
        if (product) updatedItems = updatedItems.map(item => item.id === id ? { ...item, description: product.name, unitPrice: product.cost } : item);
    }
    setItems(updatedItems);
  };

  const handleAttachClick = () => fileInputRef.current?.click();
  
  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
  });

  const normalizeArabicText = (text: string) => text.trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[^\w\s\u0600-\u06FF]/g, '').replace(/\s+/g, ' ');

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      setAttachedFiles(prev => [...prev, ...newFiles]);
      analyzeFiles([...attachedFiles, ...newFiles]); 
    }
    if (fileInputRef.current) fileInputRef.current.value = ''; 
  };

  const removeAttachedFile = (index: number) => {
      const updatedFiles = attachedFiles.filter((_, i) => i !== index);
      setAttachedFiles(updatedFiles);
  };

  const analyzeFiles = async (filesToAnalyze: File[]) => {
      setIsAnalyzing(true);
      setAnalysisSuccessMsg('');
      setAnalysisErrorMsg('');
      
      try {
        const imagesData: ImageDataInput[] = await Promise.all(
            filesToAnalyze.map(async (file) => ({
                base64: await fileToBase64(file),
                mimeType: file.type
            }))
        );

        const analysisResult = await analyzeInvoiceImage(imagesData);
        
        if (analysisResult) {
          if (analysisResult.invoiceNumber) setInvoiceNumber(analysisResult.invoiceNumber);
          if (analysisResult.date) setDate(analysisResult.date);
          if (analysisResult.taxNumber) setTaxNumber(analysisResult.taxNumber);
          if (analysisResult.currency) setCurrency(analysisResult.currency.toUpperCase().includes('USD') ? 'USD' : 'SAR');
          
          if (analysisResult.supplierName) {
             const detectedNameRaw = analysisResult.supplierName;
             const detectedNameNorm = normalizeArabicText(detectedNameRaw);
             const matchedSupplier = suppliers.find(s => {
                 const storedNameNorm = normalizeArabicText(s.name);
                 return storedNameNorm === detectedNameNorm || (storedNameNorm.length > 3 && detectedNameNorm.includes(storedNameNorm)) || (detectedNameNorm.length > 3 && storedNameNorm.includes(detectedNameNorm));
             });
             
             if (matchedSupplier) {
               setSupplierId(matchedSupplier.id);
               setSupplierSearchTerm(matchedSupplier.name); 
             } else {
               const newSupplierId = `SUP-${Date.now()}`;
               const newSupplier: Supplier = {
                 id: newSupplierId,
                 name: detectedNameRaw,
                 phone: '',
                 balance: 0,
                 taxNumber: analysisResult.taxNumber || '',
                 code: String(Math.floor(200 + Math.random() * 800))
               };
               const { error } = await supabase.from('suppliers').insert(newSupplier);
               if (!error) {
                   setSuppliers(prev => [...prev, newSupplier]);
                   setSupplierId(newSupplierId);
                   setSupplierSearchTerm(detectedNameRaw); 
               }
             }
          }
          
          if (analysisResult.items && analysisResult.items.length > 0) {
            setItems(analysisResult.items.map((item, index) => ({ id: `auto-${Date.now()}-${index}`, code: '', description: item.description, quantity: Number(item.quantity) || 1, unitPrice: Number(item.unitPrice) || 0 })));
            setAnalysisSuccessMsg('تم تحليل الفاتورة واستخراج البيانات بنجاح!');
          }
        } else {
            setAnalysisErrorMsg('تعذر تحليل الفاتورة. يرجى التأكد من جودة الصورة.');
        }
      } catch (error) { 
          setAnalysisErrorMsg("حدث خطأ غير متوقع أثناء المعالجة."); 
      } finally { 
          setIsAnalyzing(false); 
      }
  };

  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        if (jsonData.length > 0) {
             setItems(jsonData.map((row: any, index: number) => ({
                id: `xls-${Date.now()}-${index}`,
                code: String(row['كود'] || row['Code'] || row['SKU'] || ''),
                description: String(row['اسم الصنف'] || row['Description'] || row['الوصف'] || row['البيان'] || row['المادة'] || row['Item Name'] || ''),
                quantity: Number(row['الكمية'] || row['Qty'] || row['Quantity'] || row['العدد'] || 1),
                unitPrice: Number(row['السعر'] || row['Price'] || row['Cost'] || row['التكلفة'] || 0)
             })));
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const calculateRowTotal = (item: InvoiceItem) => round(item.quantity * item.unitPrice);
  
  const subTotal = round(items.reduce((sum, item) => sum + round(item.quantity * item.unitPrice), 0));
  const taxableAmount = round(Math.max(0, subTotal - discountAmount)); 
  const vatRate = 0.15;
  const vatTotal = round(taxableAmount * vatRate);
  const grandTotal = round(taxableAmount + vatTotal);

  const handleSave = async () => {
    if (!invoiceNumber || !supplierId || items.length === 0) {
      alert("يرجى تعبئة الحقول الإجبارية (رقم الفاتورة، المورد، والأصناف)");
      return;
    }

    const selectedSupplier = suppliers.find(s => s.id === supplierId);
    
    const purchaseData: any = {
      date,
      invoiceNumber,
      partyName: selectedSupplier?.name || '',
      description: `فاتورة مشتريات #${invoiceNumber}`,
      amount: grandTotal,
      discountAmount,
      taxNumber,
      currency,
      paymentMethod,
      status: 'received',
      items: items.map(i => ({...i, id: undefined})),
      skipInventory
    };

    let error;

    if (id) {
       const { error: err } = await supabase.from('purchases').update(purchaseData).eq('id', id);
       error = err;
       if (!error) {
           await logAction(user, 'update', 'المشتريات', `تعديل فاتورة مشتريات ${invoiceNumber}`);
       }
    } else {
       purchaseData.id = `PUR-${Date.now()}`;
       purchaseData.createdAt = new Date().toISOString();
       const { error: err } = await supabase.from('purchases').insert(purchaseData);
       error = err;

       if (!error) {
           if (!skipInventory) {
               for (const item of items) {
                   const product = inventoryProducts.find(p => 
                       (item.code && p.sku === item.code) || 
                       (p.name === item.description)
                   );

                   if (product) {
                       const newQty = product.quantity + item.quantity;
                       await supabase.from('products').update({ 
                           quantity: newQty, 
                           cost: item.unitPrice
                       }).eq('id', product.id);
                   } else {
                       if (item.code && item.description) {
                           await supabase.from('products').insert({
                               id: `PROD-${Date.now()}-${Math.floor(Math.random()*1000)}`,
                               sku: item.code,
                               name: item.description,
                               quantity: item.quantity,
                               cost: item.unitPrice,
                               price: round(item.unitPrice * 1.3),
                               category: 'عام',
                               createdAt: new Date().toISOString()
                           });
                       }
                   }
               }
           }
           
           if (paymentMethod === 'credit' && selectedSupplier) {
               const newBalance = round(selectedSupplier.balance + grandTotal);
               await supabase.from('suppliers').update({ balance: newBalance }).eq('id', selectedSupplier.id);
           }

           await logAction(user, 'create', 'المشتريات', `إضافة فاتورة مشتريات ${invoiceNumber} بقيمة ${grandTotal}`);
       }
    }

    if (error) {
        alert("حدث خطأ أثناء الحفظ: " + error.message);
    } else {
        navigate('/purchases');
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/purchases')} className="p-2 bg-white border border-slate-200 rounded-full text-slate-500 hover:bg-slate-50 transition-colors shadow-sm">
                    <ArrowRight size={20} />
                </button>
                <h2 className="text-2xl font-bold text-slate-800">{id ? 'تعديل فاتورة مشتريات' : 'إضافة فاتورة مشتريات جديدة'}</h2>
            </div>
            <div className="flex gap-3">
                 <button 
                    onClick={handleSave}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 shadow-md"
                 >
                    <Save size={18} />
                    <span>حفظ الفاتورة</span>
                 </button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                             <Paperclip size={18} className="text-indigo-600" />
                             المرفقات والذكاء الاصطناعي
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">ارفع صورة الفاتورة ليقوم النظام باستخراج البيانات تلقائياً</p>
                    </div>
                    {isAnalyzing && <div className="text-indigo-600 text-sm flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> جاري التحليل...</div>}
                </div>

                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer" onClick={handleAttachClick}>
                    <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,.pdf" onChange={handleFileChange} />
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <FileImage size={24} />
                    </div>
                    <p className="text-slate-600 font-medium">اضغط لرفع صور الفاتورة</p>
                    <p className="text-xs text-slate-400 mt-1">يدعم JPG, PNG (الحد الأقصى 5MB)</p>
                </div>
                
                {attachedFiles.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {attachedFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg text-sm text-slate-700">
                                <span className="max-w-[150px] truncate">{file.name}</span>
                                <button onClick={(e) => { e.stopPropagation(); removeAttachedFile(idx); }} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                            </div>
                        ))}
                    </div>
                )}

                {analysisSuccessMsg && <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2"><CheckCircle size={16} />{analysisSuccessMsg}</div>}
                {analysisErrorMsg && <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2"><AlertCircle size={16} />{analysisErrorMsg}</div>}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
                <div>
                    <h3 className="font-bold text-slate-800 mb-4">خيارات الاستيراد</h3>
                    <button 
                        onClick={() => excelInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 border border-slate-200 p-3 rounded-lg hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-colors text-slate-600 mb-3"
                    >
                        <FileSpreadsheet size={18} />
                        <span>استيراد من Excel</span>
                        <input type="file" ref={excelInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleExcelImport} />
                    </button>
                    <button className="w-full flex items-center justify-center gap-2 border border-slate-200 p-3 rounded-lg hover:bg-slate-50 transition-colors text-slate-600">
                        <Download size={18} />
                        <span>تحميل نموذج Excel</span>
                    </button>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                     <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${skipInventory ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                            {skipInventory && <CheckCircle size={14} className="text-white" />}
                        </div>
                        <input type="checkbox" className="hidden" checked={skipInventory} onChange={() => setSkipInventory(!skipInventory)} />
                        <span className="text-sm font-medium">عدم إضافة الأصناف للمخزون</span>
                     </label>
                     <p className="text-xs text-slate-400 mt-1 mr-7">عند التفعيل، لن يتم زيادة كميات المنتجات في المخزون.</p>
                </div>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-6">
            <h3 className="font-bold text-slate-800 mb-6 border-b border-slate-100 pb-2">بيانات الفاتورة الأساسية</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">رقم الفاتورة <span className="text-red-500">*</span></label>
                    <input 
                        type="text" 
                        className={`w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 ${duplicateWarning ? 'border-orange-300 focus:ring-orange-200' : 'border-slate-300'}`}
                        value={invoiceNumber} 
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="INV-001"
                    />
                    {duplicateWarning && <p className="text-xs text-orange-600 mt-1 flex items-center gap-1"><AlertTriangle size={12} /> {duplicateWarning}</p>}
                </div>
                
                <div className="relative" ref={supplierDropdownRef}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">المورد <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <input 
                            type="text" 
                            className="w-full p-2 pl-8 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                            value={supplierSearchTerm}
                            onChange={(e) => { setSupplierSearchTerm(e.target.value); setIsSupplierDropdownOpen(true); }}
                            onFocus={() => setIsSupplierDropdownOpen(true)}
                            placeholder="ابحث عن مورد..."
                        />
                        <ChevronDown size={16} className="absolute left-2 top-3 text-slate-400" />
                    </div>
                    {isSupplierDropdownOpen && (
                        <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                            {filteredSuppliers.length > 0 ? filteredSuppliers.map(s => (
                                <div key={s.id} onClick={() => selectSupplier(s)} className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0">
                                    <div className="font-bold text-slate-800">{s.name}</div>
                                    <div className="text-xs text-slate-500">{s.phone} {s.taxNumber && `| ضريبي: ${s.taxNumber}`}</div>
                                </div>
                            )) : (
                                <div className="p-3 text-center text-slate-500 text-sm">
                                    لا يوجد نتائج.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ الفاتورة</label>
                    <input 
                        type="date" 
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        value={date} 
                        onChange={(e) => setDate(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">الرقم الضريبي للمورد</label>
                    <input 
                        type="text" 
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        value={taxNumber} 
                        onChange={(e) => setTaxNumber(e.target.value)}
                        placeholder="3xxxxxxxxxxxxxx"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">طريقة الدفع</label>
                    <select 
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                    >
                        <option value="credit">آجل (Credit)</option>
                        <option value="cash">نقدي (Cash)</option>
                        <option value="transfer">حوالة بنكية (Transfer)</option>
                    </select>
                </div>
                <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1">العملة</label>
                     <select 
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                    >
                        <option value="SAR">ريال سعودي (SAR)</option>
                        <option value="USD">دولار أمريكي (USD)</option>
                    </select>
                </div>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
             <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                 <h3 className="font-bold text-slate-800">الأصناف</h3>
                 <button onClick={handleAddItem} className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1">
                     <Plus size={16} /> إضافة صنف
                 </button>
             </div>
             <table className="w-full text-right">
                <thead className="bg-white text-slate-500 text-sm border-b border-slate-100">
                    <tr>
                        <th className="p-4 w-12">#</th>
                        <th className="p-4 w-32">كود الصنف</th>
                        <th className="p-4">اسم الصنف / الوصف</th>
                        <th className="p-4 w-24">الكمية</th>
                        <th className="p-4 w-32">سعر الوحدة</th>
                        <th className="p-4 w-32">الإجمالي</th>
                        <th className="p-4 w-12"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {items.map((item, index) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                            <td className="p-4 text-slate-400 text-sm">{index + 1}</td>
                            <td className="p-4">
                                <input 
                                    type="text" 
                                    className="w-full p-1 border border-slate-200 rounded focus:border-indigo-500 outline-none text-sm" 
                                    value={item.code} 
                                    onChange={(e) => updateItem(item.id, 'code', e.target.value)}
                                    placeholder="SKU" 
                                />
                            </td>
                            <td className="p-4">
                                <input 
                                    type="text" 
                                    className="w-full p-1 border border-slate-200 rounded focus:border-indigo-500 outline-none text-sm" 
                                    value={item.description} 
                                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                    placeholder="اسم المنتج" 
                                />
                            </td>
                            <td className="p-4">
                                <input 
                                    type="number" 
                                    className="w-full p-1 border border-slate-200 rounded focus:border-indigo-500 outline-none text-sm text-center" 
                                    value={item.quantity} 
                                    onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                                    min="1"
                                />
                            </td>
                            <td className="p-4">
                                <input 
                                    type="number" 
                                    className="w-full p-1 border border-slate-200 rounded focus:border-indigo-500 outline-none text-sm text-center" 
                                    value={item.unitPrice} 
                                    onChange={(e) => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                                    min="0" step="0.01"
                                />
                            </td>
                            <td className="p-4 font-bold text-slate-700">
                                {calculateRowTotal(item).toFixed(2)}
                            </td>
                            <td className="p-4 text-center">
                                <button onClick={() => handleRemoveItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-100">
                    <tr>
                        <td colSpan={5} className="p-4 text-left font-bold text-slate-600 border-l border-slate-100">المجموع الفرعي (Subtotal)</td>
                        <td colSpan={2} className="p-4 font-bold text-slate-800 text-lg">{subTotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td colSpan={5} className="p-4 text-left font-bold text-slate-600 border-l border-slate-100">
                             الخصم (Discount)
                        </td>
                        <td colSpan={2} className="p-4">
                             <input 
                                type="number" 
                                className="w-32 p-1 border border-slate-300 rounded bg-white text-slate-800 font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-center font-mono" 
                                value={discountAmount === 0 ? '' : discountAmount} 
                                onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                                placeholder="0.00"
                             />
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={5} className="p-4 text-left font-bold text-slate-600 border-l border-slate-100">ضريبة القيمة المضافة (15%)</td>
                        <td colSpan={2} className="p-4 font-bold text-slate-600">{vatTotal.toFixed(2)}</td>
                    </tr>
                    <tr className="bg-indigo-50">
                        <td colSpan={5} className="p-4 text-left font-bold text-indigo-900 border-l border-indigo-100">الإجمالي النهائي (Grand Total)</td>
                        <td colSpan={2} className="p-4 font-bold text-indigo-700 text-xl font-mono">{grandTotal.toFixed(2)} <span className="text-sm font-normal">{currency}</span></td>
                    </tr>
                </tfoot>
             </table>
        </div>
    </div>
  );
};

export default CreatePurchase;
