
import React, { useState, useEffect } from 'react';
import { Phone, Building, Plus, X, Save, AlertCircle, FileText, Hash, Edit, Trash2, AlertTriangle, Banknote, CreditCard, Loader2, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Supplier } from '../types';
import { supabase } from '../services/supabaseClient';
import { logAction } from '../services/auditLogService';
import { useAuth } from '../context/AuthContext';

const Suppliers: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSuppliers = async () => {
    // الترتيب حسب الرصيد تنازلياً (الأعلى أولاً) ثم حسب الاسم للحالات المتساوية
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .order('balance', { ascending: false })
      .order('name', { ascending: true });
      
    if (data) setSuppliers(data);
  };

  useEffect(() => {
    fetchSuppliers();
    const channel = supabase.channel('suppliers-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, fetchSuppliers)
        .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Data States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', tax: '', code: '' });
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('transfer');
  
  // Status States
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const openAddModal = () => {
      setEditingId(null);
      setFormData({ name: '', phone: '', tax: '', code: '' });
      setErrorMsg('');
      setIsModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
      setEditingId(supplier.id);
      setFormData({ name: supplier.name, phone: supplier.phone, tax: supplier.taxNumber || '', code: supplier.code || '' });
      setErrorMsg('');
      setIsModalOpen(true);
  };

  const openPayModal = (supplier: Supplier) => {
      if (supplier.balance <= 0) {
          alert('رصيد المورد صفر، لا توجد مستحقات للدفع.');
          return;
      }
      setSelectedSupplier(supplier);
      setPaymentMethod('transfer');
      setIsPayModalOpen(true);
  };

  const handleSaveSupplier = async () => {
    setErrorMsg('');
    const trimmedName = formData.name.trim();

    if (!trimmedName) {
        setErrorMsg('يرجى إدخال اسم المورد');
        return;
    }

    const nameExists = suppliers.some(s => s.name.toLowerCase() === trimmedName.toLowerCase() && s.id !== editingId);
    if (nameExists) {
        setErrorMsg('هذا المورد موجود مسبقاً في القائمة!');
        return;
    }

    setIsLoading(true);
    if (editingId) {
        const { error } = await supabase.from('suppliers').update({
            name: trimmedName,
            phone: formData.phone,
            taxNumber: formData.tax,
            code: formData.code
        }).eq('id', editingId);

        if (!error) {
            await logAction(user, 'update', 'الموردين', `تعديل بيانات المورد: ${trimmedName}`);
            setIsModalOpen(false);
        } else {
            setErrorMsg('فشل التحديث');
        }
    } else {
        const newSupplier: Supplier = {
            id: `SUP-${Date.now()}`,
            name: trimmedName,
            phone: formData.phone,
            balance: 0,
            taxNumber: formData.tax,
            code: formData.code || String(Math.floor(100 + Math.random() * 900))
        };
        const { error } = await supabase.from('suppliers').insert(newSupplier);
        if (!error) {
            await logAction(user, 'create', 'الموردين', `إضافة مورد جديد: ${trimmedName}`);
            setIsModalOpen(false);
        } else {
            setErrorMsg('فشل الحفظ');
        }
    }
    setIsLoading(false);
  };

  const handleProcessPayment = async () => {
    if (!selectedSupplier) return;
    setIsLoading(true);
    
    try {
        // 1. تحديث كافة فواتير المشتريات الآجلة لهذا المورد
        const { error: purError } = await supabase
            .from('purchases')
            .update({ paymentMethod: paymentMethod })
            .eq('partyName', selectedSupplier.name)
            .eq('paymentMethod', 'credit');

        if (purError) throw purError;

        // 2. تصفير رصيد المورد
        const { error: supError } = await supabase
            .from('suppliers')
            .update({ balance: 0 })
            .eq('id', selectedSupplier.id);

        if (supError) throw supError;

        await logAction(
            user, 
            'update', 
            'الموردين', 
            `دفع مستحقات المورد ${selectedSupplier.name} بقيمة ${selectedSupplier.balance} ريال عبر ${paymentMethod === 'cash' ? 'نقدي' : 'حوالة'}`
        );

        setSuccessMsg(`تمت تصفية حساب ${selectedSupplier.name} بنجاح.`);
        setIsPayModalOpen(false);
        setTimeout(() => setSuccessMsg(''), 3000);
        fetchSuppliers();
    } catch (err: any) {
        alert('حدث خطأ أثناء معالجة الدفع: ' + err.message);
    } finally {
        setIsLoading(false);
    }
  };

  const initiateDelete = (id: string) => {
      setItemToDelete(id);
      setDeletePassword('');
      setDeleteError('');
      setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
      if (deletePassword === '1234') {
          if (itemToDelete) {
              const supplier = suppliers.find(s => s.id === itemToDelete);
              if (supplier) {
                  await logAction(user, 'delete', 'الموردين', `حذف المورد: ${supplier.name}`);
              }
              await supabase.from('suppliers').delete().eq('id', itemToDelete);
          }
          setIsDeleteModalOpen(false);
          setItemToDelete(null);
      } else {
          setDeleteError('كلمة المرور غير صحيحة');
      }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">قائمة الموردين</h2>
          <p className="text-sm text-slate-500 mt-1">إدارة الحسابات والأرصدة المستحقة للموردين</p>
        </div>
        <button 
            onClick={openAddModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
        >
            <Plus size={18} />
            <span>إضافة مورد جديد</span>
        </button>
      </div>

      {successMsg && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl flex items-center gap-3 animate-fade-in">
           <CheckCircle2 size={24} />
           <p className="font-bold">{successMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.map((supplier) => (
            <div key={supplier.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 left-0 bg-indigo-500 text-white text-[10px] px-2 py-1 rounded-br-lg font-mono z-10 tracking-widest">
                    {supplier.code || 'NO-CODE'}
                </div>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditModal(supplier)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit size={16} />
                    </button>
                    <button onClick={() => initiateDelete(supplier.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={16} />
                    </button>
                </div>
                <div className="flex items-start justify-between mb-4 mt-2">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <Building size={24} />
                    </div>
                    <div className="text-left">
                         <span className="block text-xs text-slate-400 mb-1">الرصيد المستحق</span>
                         <span className={`text-lg font-bold ${supplier.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {Number(supplier.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-slate-500 font-normal">ر.س</span>
                         </span>
                    </div>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2 truncate pr-2" title={supplier.name}>{supplier.name}</h3>
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <Phone size={14} className="text-slate-300" />
                        <span>{supplier.phone || 'غير مسجل'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <FileText size={14} className="text-slate-300" />
                        <span className="font-mono text-xs">{supplier.taxNumber || 'لا يوجد رقم ضريبي'}</span>
                    </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-50 flex gap-2">
                    <button 
                        onClick={() => navigate(`/suppliers/${supplier.id}`)} 
                        className="flex-1 py-2 text-xs font-bold border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        كشف حساب
                    </button>
                    <button 
                        onClick={() => openPayModal(supplier)}
                        disabled={supplier.balance <= 0}
                        className="flex-1 py-2 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        دفع المستحقات
                    </button>
                </div>
            </div>
        ))}
        {suppliers.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                لا يوجد موردين مضافين حالياً
            </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800">{editingId ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500"><X size={20} /></button>
                </div>
                <div className="p-6 space-y-4">
                    {errorMsg && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100"><AlertCircle size={16} />{errorMsg}</div>}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">اسم المورد / الشركة <span className="text-red-500">*</span></label>
                        <input type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-600" placeholder="اسم المورد" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">كود المورد</label>
                            <input type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-600" placeholder="مثال: 200" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">رقم الهاتف</label>
                            <input type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-600" placeholder="05xxxxxxxx" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">الرقم الضريبي</label>
                        <input type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-600" placeholder="3xxxxxxxxxxxxxx" value={formData.tax} onChange={(e) => setFormData({...formData, tax: e.target.value})} />
                    </div>
                </div>
                <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                    <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">إلغاء</button>
                    <button 
                        onClick={handleSaveSupplier} 
                        disabled={isLoading}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-md transition-colors disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        <span>{editingId ? 'حفظ التعديلات' : 'حفظ المورد'}</span>
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Pay Dues Modal */}
      {isPayModalOpen && selectedSupplier && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Banknote size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-1">دفع مستحقات المورد</h3>
                    <p className="text-slate-500 text-sm mb-6">{selectedSupplier.name}</p>
                    
                    <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
                        <span className="text-slate-500 text-sm block mb-1">المبلغ المراد سداده</span>
                        <span className="text-3xl font-black text-indigo-700 font-mono">
                            {selectedSupplier.balance.toLocaleString()} <span className="text-lg font-bold">ر.س</span>
                        </span>
                    </div>

                    <div className="space-y-3 mb-8">
                        <p className="text-xs font-bold text-slate-400 text-right mr-1">اختر طريقة الدفع:</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => setPaymentMethod('transfer')}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${paymentMethod === 'transfer' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}`}
                            >
                                <CreditCard size={24} />
                                <span className="font-bold">حوالة بنكية</span>
                            </button>
                            <button 
                                onClick={() => setPaymentMethod('cash')}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${paymentMethod === 'cash' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}`}
                            >
                                <Banknote size={24} />
                                <span className="font-bold">نقدي (كاش)</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => setIsPayModalOpen(false)}
                            className="flex-1 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-colors"
                        >
                            إلغاء
                        </button>
                        <button 
                            onClick={handleProcessPayment}
                            disabled={isLoading}
                            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                            <span>تأكيد السداد</span>
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-4 leading-relaxed px-4 text-center">
                        * سيتم تصفية رصيد المورد وتعديل فواتير المشتريات الآجلة المرتبطة به إلى وسيلة الدفع المختارة.
                    </p>
                </div>
            </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><AlertTriangle size={24} /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">تأكيد حذف المورد</h3>
              <p className="text-slate-500 text-sm mb-6">سيتم حذف المورد وسجله بالكامل. لا يمكن التراجع عن هذا الإجراء.</p>
              <div className="mb-4 text-right">
                <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور</label>
                <input type="password" className={`w-full p-2 border rounded-lg text-center font-mono outline-none bg-white text-slate-600 ${deleteError ? 'border-red-500 bg-red-50' : 'border-slate-300 focus:border-indigo-500'}`} placeholder="****" autoFocus value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmDelete()} />
                {deleteError && <p className="text-xs text-red-500 mt-1">{deleteError}</p>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors">إلغاء</button>
                <button onClick={confirmDelete} className="flex-1 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg font-bold shadow-lg shadow-red-200 transition-colors">حذف نهائي</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
