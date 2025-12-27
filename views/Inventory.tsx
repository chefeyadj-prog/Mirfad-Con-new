
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Package, Search, RefreshCw, FileDown, Trash2, X, CheckSquare, Square, Save, Edit } from 'lucide-react';
import { Product } from '../types';
import DateFilter, { DateRange } from '../components/DateFilter';
import { supabase } from '../services/supabaseClient';
import { logAction } from '../services/auditLogService';
import { useAuth } from '../context/AuthContext';
import { round } from '../utils/mathUtils';

const Inventory: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ label: 'الكل', start: null, end: null });
  
  // Selection State
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Add/Edit Product State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    sku: '',
    category: 'عام',
    quantity: 0,
    cost: 0,
    price: 0
  });

  const fetchProducts = async () => {
      const { data } = await supabase.from('products').select('*').order('createdAt', { ascending: false });
      if (data) setProducts(data);
  };

  useEffect(() => {
    fetchProducts();
    const channel = supabase.channel('inventory-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchProducts)
        .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const normalizeText = (text: string) => {
    return text.trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[^\w\s\u0600-\u06FF]/g, '').replace(/\s+/g, ' ');
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesDate = true;
    if (dateRange.start && dateRange.end && p.createdAt) {
        const pDate = new Date(p.createdAt);
        matchesDate = pDate >= dateRange.start && pDate <= dateRange.end;
    }
    return matchesSearch && matchesDate;
  });

  const calculateTotalInventoryValue = () => round(filteredProducts.reduce((sum, p) => sum + round(p.cost * p.quantity), 0));

  // Selection Logic
  const handleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    }
  };

  const handleSelectProduct = (id: string) => {
    if (selectedProductIds.includes(id)) {
      setSelectedProductIds(selectedProductIds.filter(pid => pid !== id));
    } else {
      setSelectedProductIds([...selectedProductIds, id]);
    }
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const initiateDelete = (id: string) => {
    setProductToDelete(id);
    setIsBulkDelete(false);
    setDeletePassword('');
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  const initiateBulkDelete = () => {
    if (selectedProductIds.length === 0) return;
    setIsBulkDelete(true);
    setProductToDelete(null);
    setDeletePassword('');
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (deletePassword === '1234') {
        if (isBulkDelete) {
            // Log Details
            await logAction(
                user,
                'delete',
                'المخزون',
                `حذف جماعي لعدد ${selectedProductIds.length} منتجات من المخزون`
            );

            // Bulk Delete
            await supabase.from('products').delete().in('id', selectedProductIds);
            setSelectedProductIds([]); // Clear selection
        } else if (productToDelete) {
            const product = products.find(p => p.id === productToDelete);
            if (product) {
                await logAction(
                    user,
                    'delete',
                    'المخزون',
                    `حذف منتج ${product.name} (SKU: ${product.sku}) - الكمية كانت ${product.quantity}`
                );
            }
            // Single Delete
            await supabase.from('products').delete().eq('id', productToDelete);
        }
        setIsDeleteModalOpen(false);
        setProductToDelete(null);
        setIsBulkDelete(false);
    } else {
        setDeleteError('كلمة المرور غير صحيحة');
    }
  };

  const openAddModal = () => {
      setNewProduct({ name: '', sku: '', category: 'عام', quantity: 0, cost: 0, price: 0 });
      setEditingProductId(null);
      setIsAddModalOpen(true);
  };

  const initiateEdit = (product: Product) => {
      setNewProduct({
          name: product.name,
          sku: product.sku,
          category: product.category,
          quantity: product.quantity,
          cost: product.cost,
          price: product.price
      });
      setEditingProductId(product.id);
      setIsAddModalOpen(true);
  };

  const handleSaveProduct = async () => {
      if (!newProduct.name || !newProduct.sku) {
          alert('يرجى تعبئة اسم المنتج والرمز (SKU) على الأقل');
          return;
      }

      const productData = {
          name: newProduct.name,
          sku: newProduct.sku,
          category: newProduct.category || 'عام',
          quantity: Number(newProduct.quantity) || 0,
          cost: Number(newProduct.cost) || 0,
          price: 0, // Default to 0 as it's hidden
      };

      if (editingProductId) {
          const { error } = await supabase.from('products').update(productData).eq('id', editingProductId);
          if (error) {
              alert('حدث خطأ أثناء تحديث المنتج: ' + error.message);
          } else {
              await logAction(
                  user,
                  'update',
                  'المخزون',
                  `تعديل منتج: ${productData.name} (SKU: ${productData.sku})`
              );
              setIsAddModalOpen(false);
              setNewProduct({ name: '', sku: '', category: 'عام', quantity: 0, cost: 0, price: 0 });
              setEditingProductId(null);
          }
      } else {
          const productToSave = {
              id: `PROD-${Date.now()}`,
              ...productData,
              createdAt: new Date().toISOString()
          };

          const { error } = await supabase.from('products').insert(productToSave);

          if (error) {
              alert('حدث خطأ أثناء حفظ المنتج: ' + error.message);
          } else {
              await logAction(
                  user,
                  'create',
                  'المخزون',
                  `إضافة منتج جديد: ${productToSave.name} (SKU: ${productToSave.sku})، الكمية: ${productToSave.quantity}`
              );
              setIsAddModalOpen(false);
              setNewProduct({ name: '', sku: '', category: 'عام', quantity: 0, cost: 0, price: 0 });
          }
      }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">المخزون والمنتجات</h2>
           <p className="text-slate-500 text-sm mt-1">يتم دمج المنتجات المتشابهة تلقائياً لمنع التكرار</p>
        </div>
        <div className="flex gap-2">
            {selectedProductIds.length > 0 && (
              <button 
                onClick={initiateBulkDelete}
                className="bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-200 transition-colors animate-fade-in"
              >
                <Trash2 size={18} />
                <span>حذف المحدد ({selectedProductIds.length})</span>
              </button>
            )}
            <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-2 rounded-lg flex items-center gap-2 hidden md:flex">
                <span className="text-sm font-bold">قيمة المخزون:</span>
                <span className="font-mono text-lg">{calculateTotalInventoryValue().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <button className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-2">
                <FileDown size={18} />
                <span className="hidden md:inline">تصدير</span>
            </button>
            <button 
                onClick={openAddModal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
                <Package size={18} />
                <span>منتج جديد</span>
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث باسم المنتج أو الرمز (SKU)..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-600 placeholder:text-slate-400"
            />
          </div>
          <DateFilter onFilterChange={setDateRange} initialLabel="الكل" />
        </div>
        <table className="w-full text-right">
          <thead className="bg-slate-50 text-slate-500 text-sm">
            <tr>
              <th className="p-4 w-12 text-center">
                <input 
                  type="checkbox" 
                  checked={filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
              </th>
              <th className="p-4 font-medium">SKU</th>
              <th className="p-4 font-medium">اسم المنتج</th>
              <th className="p-4 font-medium">التصنيف</th>
              <th className="p-4 font-medium text-center">الكمية</th>
              <th className="p-4 font-medium">سعر التكلفة</th>
              <th className="p-4 font-medium text-slate-600">الضريبة (15%)</th>
              <th className="p-4 font-medium">إجمالي القيمة</th>
              <th className="p-4 font-medium text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProducts.map((product) => (
              <tr key={product.id} className={`hover:bg-slate-50 transition-colors ${selectedProductIds.includes(product.id) ? 'bg-indigo-50/50' : ''}`}>
                <td className="p-4 text-center">
                  <input 
                    type="checkbox" 
                    checked={selectedProductIds.includes(product.id)}
                    onChange={() => handleSelectProduct(product.id)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                </td>
                <td className="p-4 text-slate-500 font-mono text-xs">{product.sku}</td>
                <td className="p-4 font-medium text-slate-800">{product.name}</td>
                <td className="p-4 text-slate-500 text-sm">
                    <span className="bg-slate-100 px-2 py-1 rounded text-xs">{product.category}</span>
                </td>
                <td className={`p-4 font-bold text-center ${product.quantity < 5 ? 'text-red-600 bg-red-50 rounded' : 'text-slate-700'}`}>
                    {product.quantity}
                </td>
                <td className="p-4 text-slate-600">
                    {Number(product.cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="p-4 text-slate-500 font-mono text-sm">
                    {round(Number(product.cost) * 0.15).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="p-4 font-bold text-slate-800">
                    {round(Number(product.quantity) * Number(product.cost)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="p-4 text-center flex justify-center gap-2">
                    <button 
                        onClick={() => initiateEdit(product)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="تعديل المنتج"
                    >
                        <Edit size={18} />
                    </button>
                    <button 
                        onClick={() => initiateDelete(product.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف المنتج"
                    >
                        <Trash2 size={18} />
                    </button>
                </td>
              </tr>
            ))}
            {filteredProducts.length === 0 && (
                <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                        {products.length === 0 ? "لا توجد منتجات." : "لا توجد منتجات مطابقة للبحث أو الفترة المحددة."}
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Add/Edit Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Package size={20} className="text-blue-600" />
                        {editingProductId ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد'}
                    </h3>
                    <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-red-500"><X size={20} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">اسم المنتج <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-600"
                            value={newProduct.name}
                            onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                            placeholder="مثال: آيفون 15 برو"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">رمز المنتج (SKU) <span className="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-600 font-mono"
                                value={newProduct.sku}
                                onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
                                placeholder="PROD-001"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">التصنيف</label>
                            <input 
                                type="text" 
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-600"
                                value={newProduct.category}
                                onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                                placeholder="عام"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">الكمية</label>
                            <input 
                                type="number" 
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-600"
                                value={newProduct.quantity}
                                onChange={(e) => setNewProduct({...newProduct, quantity: Number(e.target.value)})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">سعر التكلفة</label>
                            <input 
                                type="number" 
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-600"
                                value={newProduct.cost}
                                onChange={(e) => setNewProduct({...newProduct, cost: Number(e.target.value)})}
                            />
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                    <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">إلغاء</button>
                    <button onClick={handleSaveProduct} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-md transition-colors">
                        <Save size={18} />
                        <span>{editingProductId ? 'حفظ التعديلات' : 'حفظ المنتج'}</span>
                    </button>
                </div>
            </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800">تأكيد {isBulkDelete ? 'الحذف الجماعي' : 'حذف المنتج'}</h3>
                <button onClick={() => setIsDeleteModalOpen(false)} className="text-slate-400 hover:text-red-500">
                    <X size={20} />
                </button>
            </div>
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                <AlertTriangle size={24} />
              </div>
              <p className="text-slate-500 text-sm mb-6">
                {isBulkDelete 
                  ? `هل أنت متأكد من حذف ${selectedProductIds.length} من المنتجات المحددة؟ لا يمكن التراجع عن هذا الإجراء.` 
                  : "هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء."
                }
              </p>
              
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
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg font-bold shadow-lg shadow-red-200 transition-colors"
                >
                  {isBulkDelete ? 'حذف الجميع' : 'حذف نهائي'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
