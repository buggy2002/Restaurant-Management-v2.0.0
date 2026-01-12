'use client';

import { useActionState, useEffect, useState } from 'react';
import {
  saveMenuItem,
  getMenuItems,
  deleteMenuItem,
  getRegisteredIngredients
} from '@/app/actions';
import { Trash2, Plus, Pencil, X, Utensils, Search, ChefHat } from 'lucide-react';
import Loading from '@/components/Loading';

interface Ingredient {
  name: string;
  qty: number;
  unit?: string;
}

interface MenuItem {
  name: string;
  price: number;
  ingredients?: Ingredient[];
}

// Helper function to format quantity with appropriate unit
const formatQuantity = (amount: number, unit?: string): string => {
  if (unit === 'ฟอง') return `${amount.toLocaleString()} ฟอง`;

  // Handle weight units (default to g if no unit provided for existing data)
  if (amount >= 1000 && (unit === 'g' || unit === 'kg' || !unit)) {
    const kilos = amount / 1000;
    return `${kilos.toLocaleString()} กิโลกรัม`;
  }
  return `${amount.toLocaleString()} ${unit === 'g' || !unit ? 'กรัม' : unit === 'kg' ? 'กิโลกรัม' : unit}`;
};

interface RegisteredItem {
  name: string;
  quantity: number;
  unit: string;
  price: number;
  user: string;
  date: string;
}

const initialState = {
  message: '',
  errors: {},
};

export default function MenuPage() {
  const [state, dispatch] = useActionState(saveMenuItem, initialState);
  const [registeredIngredients, setRegisteredIngredients] = useState<RegisteredItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);



  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState<Ingredient[]>([]);

  // Ingredient Selector State
  const [ingName, setIngName] = useState('');
  const [ingQty, setIngQty] = useState('');
  const [ingUnit, setIngUnit] = useState('g'); // Default to grams

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  const loadRegistryItems = async () => {
    const items = await getRegisteredIngredients();
    // For the selector, we just need unique names from the registry
    // But since registry items might be added multiple times for same name (history),
    // we take the latest or unique list.
    const unique = items.reduce((acc: Record<string, RegisteredItem>, item: RegisteredItem) => {
      acc[item.name] = item;
      return acc;
    }, {});
    setRegisteredIngredients(Object.values(unique));
  };

  const loadMenu = () => {
    getMenuItems().then(setMenuItems);
  };



  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      await loadRegistryItems();
      loadMenu();
      setIsLoading(false);
    };
    initData();
  }, [state]);

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name);
    setPrice(String(item.price));
    setSelectedIngredients(item.ingredients || []);
    setIsModalOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setName('');
    setPrice('');
    setSelectedIngredients([]);
    setIsModalOpen(false);
  };

  const handleDelete = async (name: string) => {
    if (confirm(`คุณต้องการลบเมนู "${name}" ใช่หรือไม่?`)) {
      await deleteMenuItem(name);
      loadMenu();
    }
  };

  const handleAddIngredient = () => {
    if (!ingName || !ingQty) return;

    // Check if exists
    const exists = selectedIngredients.find(i => i.name === ingName);
    if (exists) {
      alert('วัตถุดิบนี้มีอยู่แล้ว');
      return;
    }

    // Convert to grams if unit is kg
    const qtyInBaseUnit = ingUnit === 'kg'
      ? Number(ingQty) * 1000
      : Number(ingQty);

    setSelectedIngredients([...selectedIngredients, { name: ingName, qty: qtyInBaseUnit, unit: ingUnit === 'kg' ? 'g' : ingUnit }]);
    setIngName('');
    setIngQty('');
    setIngUnit('g'); // Reset to grams
  };

  const removeIngredient = (index: number) => {
    const newIngredients = selectedIngredients.filter((_, i) => i !== index);
    setSelectedIngredients(newIngredients);
  };

  const filteredItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto mt-6 p-4 relative">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/50 z-100 flex items-center justify-center backdrop-blur-sm">
          <Loading />
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col gap-4 mb-8 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <ChefHat className="w-8 h-8 mr-3 text-orange-500" />
            รายการเมนูอาหาร
          </h1>
          <p className="text-gray-500 text-sm mt-1">สร้างสรรค์เมนูและจัดการสูตรอาหารของคุณ</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center shadow-md transition-transform transform active:scale-95 self-end md:self-auto"
        >
          <Plus className="w-5 h-5 mr-2" />
          เพิ่มเมนูใหม่
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาเมนู..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-800"
          />
        </div>
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border-2 border-dashed border-gray-200">
            <Utensils className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>ไม่พบรายการเมนู</p>
          </div>
        ) : (
          filteredItems.map((item, index) => (
            <div key={`${item.name}-${index}`} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              {/* Header - Static */}
              <div className="flex justify-between items-center p-5">
                <div className="flex items-center gap-3 flex-1">
                  <h3 className="font-bold text-gray-900 text-lg">{item.name}</h3>
                  <span className="font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-lg text-sm">฿{item.price.toLocaleString()}</span>
                </div>
              </div>

              {/* Content - Ingredients - Always Visible */}
              <div className="px-5 pb-4 border-t border-gray-100 pt-4 bg-gray-50">
                <p className="text-xs text-gray-500 mb-3 uppercase font-semibold tracking-wider">วัตถุดิบ:</p>
                <div className="space-y-2 mb-4">
                  {item.ingredients && item.ingredients.length > 0 ? (
                    item.ingredients.map((ing: Ingredient, i: number) => (
                      <div key={i} className="flex justify-between items-center bg-white p-2 rounded-lg border border-gray-200">
                        <span className="text-sm text-gray-700 font-medium">{ing.name}</span>
                        <span className="text-sm text-gray-600">{formatQuantity(ing.qty, ing.unit)}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 italic">ไม่ได้ระบุ</span>
                  )}
                </div>
              </div>

              {/* Action Buttons - Always Visible */}
              <div className="flex justify-end px-5 pb-4 gap-2 border-t border-gray-100 pt-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(item);
                  }}
                  className="flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Pencil className="w-4 h-4 mr-1.5" />
                  แก้ไข
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item.name);
                  }}
                  className="flex items-center px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  ลบ
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {
        isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
              <div className={`px-6 py-4 border-b flex justify-between items-center ${editingItem ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
                <h2 className={`font-bold flex items-center text-lg ${editingItem ? 'text-blue-700' : 'text-orange-700'}`}>
                  {editingItem ? <Pencil className="w-5 h-5 mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
                  {editingItem ? 'แก้ไขเมนู' : 'เพิ่มเมนูใหม่'}
                </h2>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-400 hover:text-gray-600 bg-white p-1 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <form action={(formData) => {
                  dispatch(formData);
                  if (!editingItem) {
                    setName('');
                    setPrice('');
                    setSelectedIngredients([]);
                  }
                  setIsModalOpen(false);
                }} className="space-y-5">
                  {editingItem && <input type="hidden" name="originalName" value={editingItem.name} />}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อเมนู</label>
                    <input
                      type="text"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full rounded-lg border-gray-300 text-gray-800 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2.5 border text-sm"
                      placeholder="เช่น ข้าวกะเพราไก่ไข่ดาว"
                    />
                    {state?.errors?.name && <p className="text-red-500 text-xs mt-1">{state.errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ราคาขาย (บาท)</label>
                    <input
                      type="number"
                      name="price"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      required
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border-gray-300 text-gray-800 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-2.5 border text-sm"
                      placeholder="0.00"
                    />
                    {state?.errors?.price && <p className="text-red-500 text-xs mt-1">{state.errors.price}</p>}
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">สูตรอาหาร (วัตถุดิบ)</label>

                    {/* Ingredient Selector */}
                    <div className="flex gap-2 mb-3">
                      <select
                        value={ingName}
                        onChange={(e) => setIngName(e.target.value)}
                        className="flex-1 rounded-lg border-gray-300 text-gray-600 text-sm p-2 border focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="">เลือกวัตถุดิบ...</option>
                        {registeredIngredients.map((item) => (
                          <option key={item.name} value={item.name}>{item.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={ingQty}
                        onChange={(e) => setIngQty(e.target.value)}
                        placeholder="0"
                        className="w-20 rounded-lg border-gray-300 text-gray-600 text-sm p-2 border focus:ring-orange-500 focus:border-orange-500"
                      />
                      <select
                        value={ingUnit}
                        onChange={(e) => setIngUnit(e.target.value)}
                        className="w-28 rounded-lg border-gray-300 text-gray-600 text-sm p-2 border focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="g">กรัม</option>
                        <option value="kg">กิโลกรัม</option>
                        <option value="ฟอง">ฟอง</option>
                      </select>
                      <button type="button" onClick={handleAddIngredient} className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-lg">
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Added Ingredients List */}
                    <div className="bg-gray-50 rounded-lg p-3 min-h-[100px] border border-gray-200">
                      {selectedIngredients.length === 0 ? (
                        <p className="text-gray-400 text-xs text-center py-4">ยังไม่มีวัตถุดิบในสูตร</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedIngredients.map((ing, idx) => (
                            <div key={`${ing.name}-${idx}`} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200 shadow-sm">
                              <span className="text-sm text-gray-700 font-medium">{ing.name}</span>
                              <div className="flex items-center">
                                <span className="text-xs text-gray-500 mr-2 bg-gray-100 px-2 py-0.5 rounded-full">{formatQuantity(ing.qty, ing.unit)}</span>
                                <button type="button" onClick={() => removeIngredient(idx)} className="text-gray-400 hover:text-red-500">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <input type="hidden" name="ingredients" value={JSON.stringify(selectedIngredients)} />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="flex-1 py-2.5 px-4 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 shadow-sm transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      className={`flex-1 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${editingItem ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' : 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500'}`}
                    >
                      {editingItem ? 'บันทึกการแก้ไข' : 'สร้างเมนูใหม่'}
                    </button>
                  </div>

                  {state?.message && (
                    <div className={`p-3 rounded-lg text-sm text-center ${state.message.includes('สำเร็จ') || state.message.includes('เรียบร้อย') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {state.message}
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
