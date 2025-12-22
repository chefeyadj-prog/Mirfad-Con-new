
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Truck, Eye, Trash2, AlertTriangle, CreditCard, Banknote, Clock, Edit, X, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Purchase, Supplier, Product } from '../types';
import DateFilter, { DateRange, getThisMonthRange } from '../components/DateFilter';
import StatCard from '../components/StatCard';
import { supabase } from '../services/supabaseClient';
import { logAction } from '../services/auditLogService';
import { useAuth } from '../context/AuthContext';
import { round } from '../utils/mathUtils';

// Helper for formatting currency
const formatCurrency = (amount: number) => amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Helper for payment method labels and icons
const getPaymentMethodLabel = (method?: string) => {
  switch (method) {
    case 'cash': return { label: 'نقدي', color: 'bg-green-100 text-green-700', icon: Banknote };
    case 'transfer': return { label: 'حوالة', color: 'bg-blue-100 text-blue-700', icon: CreditCard };
    case 'credit': return { label: 'آجل', color: 'bg-orange-100 text-orange-700', icon: Clock };
    default: return { label: 'آجل', color: 'bg-orange-100 text-orange-700', icon: Clock };
  }
};

const Purchases: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>(getThisMonthRange());

  // Sorting State
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  // Deletion State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Auth State for Editing
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);

  const fetchPurchases = async () => {
    const { data } = await supabase.from('purchases').select('*').order('date', { ascending: false });
    if (data) setPurchases(data);
  };

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('*');
    if (data) setSuppliers(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*');
    if (data) setProducts(data);
  };

  useEffect(() => {
    fetchPurchases();
    fetchSuppliers();
    fetchProducts();

    const channel = supabase.channel('purchases-list-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, fetchPurchases)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, fetchSuppliers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchProducts)
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, []);

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

  const initiateEdit = (id: string) => {
    setPendingEditId(id);
    setAuthPassword('');
    setAuthError('');
    setIsAuthModalOpen(true);
  };

  const verifyAndEdit = () => {
    if (authPassword === '1234') {
      setIsAuthModalOpen(false);
      navigate(`/purchases/edit/${pendingEditId}`);
    } else {
      setAuthError('كلمة المرور غير صحيحة');
    }
  };

  const initiateDelete = (id: string) => {
    setPurchaseToDelete(id);
    setDeletePassword('');
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (deletePassword === '1234') {
      if (purchaseToDelete) {
        const p = purchases.find(p => p.id === purchaseToDelete);
        if (p) {
          await logAction(user, 'delete', 'المشتريات', `حذف فاتورة مشتريات #${p.invoiceNumber || p.id}`);
        }
        await supabase.from('purchases').delete().eq('id', purchaseToDelete);
      }
      setIsDeleteModalOpen(false);
      setPurchaseToDelete(null);
    } else {
      setDeleteError('كلمة المرور غير صحيحة');
    }
  };

  const filteredPurchases = useMemo(() => {
    let result = purchases.filter(p => {
      const searchLower = searchTerm.toLowerCase();
      const relatedSupplier = suppliers.find(s => s.name === p.partyName);
      const supplierPhone = relatedSupplier?.phone || '';
      const supplierCode = relatedSupplier?.code || '';

      const matchesSearch = 
          p.partyName.toLowerCase().includes(searchLower) ||
          (p.invoiceNumber || '').toLowerCase().includes(searchLower) ||
          p.id.toLowerCase().includes(searchLower) ||
          supplierPhone.includes(searchLower) ||
          supplierCode.includes(searchLower);
      
      let matchesDate = true;
      if (dateRange.start && dateRange.end) {
          const pDate = new Date(p.date);
          matchesDate = pDate >= dateRange.start && pDate <= dateRange.end;
      }

      return matchesSearch && matchesDate;
    });

    if (sortKey && sortDirection) {
      result = [...result].sort((a: any, b: any) => {
        const valA = a[sortKey] || '';
        const valB = b[sortKey] || '';
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [purchases, searchTerm, dateRange, suppliers, sortKey, sortDirection]);

  // Calculate Totals based on filtered data
  const totals = useMemo(() => {
    return filteredPurchases.reduce((acc, p) => {
      const amount = p.amount || 0;
      if (p.paymentMethod === 'cash') acc.cash += amount;
      else if (p.paymentMethod === 'transfer') acc.transfer += amount;
      else acc.credit += amount;
      acc.grandTotal += amount;
      return acc;
    }, { cash: 0, transfer: 0, credit: 0, grandTotal: 0 });
  }, [filteredPurchases]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">إدارة المشتريات</h2>
        <Link 
          to="/purchases/new"
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} />
          <span>فاتورة مشتريات جديدة</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard 
          title="إجمالي المشتريات (كاش)" 
          value={`${formatCurrency(totals.cash)}`} 
          icon={Banknote} 
          color="green" 
        />
        <StatCard 
          title="إجمالي المشتريات (آجل)" 
          value={`${formatCurrency(totals.credit)}`} 
          icon={Clock} 
          color="orange" 
        />
        <StatCard 
          title="إجمالي المشتريات (حوالة)" 
          value={`${formatCurrency(totals.transfer)}`} 
          icon={CreditCard} 
          color="blue" 
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث (رقم الفاتورة، اسم المورد، رقم الهاتف، الكود)..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-slate-600 placeholder:text-slate-400 text-center"
              dir="rtl"
            />
          </div>
          <DateFilter onFilterChange={setDateRange} />
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-center">
            <thead className="bg-slate-50 text-slate-500 text-sm">
              <tr>
                <th onClick={() => handleSort('invoiceNumber')} className="p-4 font-bold text-center cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap">
                  رقم الطلب {renderSortIcon('invoiceNumber')}
                </th>
                <th onClick={() => handleSort('partyName')} className="p-4 font-bold text-center cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap">
                  المورد {renderSortIcon('partyName')}
                </th>
                <th onClick={() => handleSort('date')} className="p-4 font-bold text-center cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap">
                  التاريخ {renderSortIcon('date')}
                </th>
                <th onClick={() => handleSort('description')} className="p-4 font-bold text-center cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap">
                  الوصف {renderSortIcon('description')}
                </th>
                <th onClick={() => handleSort('amount')} className="p-4 font-bold text-center cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap">
                  التكلفة {renderSortIcon('amount')}
                </th>
                <th onClick={() => handleSort('paymentMethod')} className="p-4 font-bold text-center cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap">
                  طريقة الدفع {renderSortIcon('paymentMethod')}
                </th>
                <th onClick={() => handleSort('status')} className="p-4 font-bold text-center cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap">
                  الحالة {renderSortIcon('status')}
                </th>
                <th className="p-4 font-bold text-center whitespace-nowrap">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPurchases.map((purchase) => {
                const paymentInfo = getPaymentMethodLabel(purchase.paymentMethod);
                const PaymentIcon = paymentInfo.icon;
                return (
                <tr key={purchase.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-slate-600 font-mono text-sm text-center">{purchase.invoiceNumber || purchase.id}</td>
                  <td className="p-4 font-medium text-slate-800 text-center">{purchase.partyName}</td>
                  <td className="p-4 text-slate-500 text-center">{purchase.date}</td>
                  <td className="p-4 text-slate-500 max-w-xs truncate text-center">{purchase.description}</td>
                  <td className="p-4 font-bold text-slate-800 text-center font-mono">
                    {formatCurrency(purchase.amount)} ر.س
                  </td>
                  <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${paymentInfo.color}`}>
                          <PaymentIcon size={12} /> {paymentInfo.label}
                      </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      purchase.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      <Truck size={12} /> {purchase.status === 'received' ? 'تم الاستلام' : 'قيد الطلب'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => navigate(`/purchases/${purchase.id}`)}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="عرض التفاصيل"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => initiateEdit(purchase.id)}
                        className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="تعديل الفاتورة"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        type="button"
                        onClick={() => initiateDelete(purchase.id)}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف الفاتورة"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
              {filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                      {purchases.length === 0 ? "لا توجد مشتريات مسجلة" : "لا توجد نتائج مطابقة للبحث"}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr className="font-black text-slate-800">
                    <td colSpan={4} className="p-4 text-center text-lg">إجمالي الصفحة</td>
                    <td className="p-4 text-center font-mono text-indigo-700 text-lg bg-indigo-50/50">
                      {formatCurrency(totals.grandTotal)} ر.س
                    </td>
                    <td colSpan={3}></td>
                </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><AlertTriangle size={24} /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">تأكيد حذف الفاتورة</h3>
              <p className="text-slate-500 text-sm mb-6">هل أنت متأكد من حذف هذه الفاتورة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.</p>
              <div className="mb-4 text-right">
                <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور</label>
                <input 
                  type="password" 
                  className={`w-full p-2 border rounded-lg text-center font-mono outline-none bg-white text-slate-600 ${deleteError ? 'border-red-500 bg-red-50' : 'border-slate-300 focus:border-indigo-500'}`} 
                  placeholder="****" 
                  autoFocus 
                  value={deletePassword} 
                  onChange={(e) => setDeletePassword(e.target.value)} 
                />
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

      {/* Auth Modal for Editing */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
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

export default Purchases;
