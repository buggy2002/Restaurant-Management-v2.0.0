'use client';

import { useEffect, useState, useTransition, useRef, useCallback } from 'react';
import {
  addMultipleRegisteredIngredients,
  getRegisteredIngredients,
  getStockNames,
  updateRegisteredIngredient,
  deleteRegisteredIngredient
} from '@/app/actions';
import { Plus, Clock, Save, X, ShoppingCart, Edit, ClipboardList } from 'lucide-react';
import Loading from '@/components/Loading';

interface RegisteredItem {
  _id?: string;
  tempId?: number;
  rowIndex?: number;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  user: string;
  date: string;
}

// Helper function to format quantity with appropriate unit
const formatQuantity = (amount: number, unit: string): string => {
  if (unit === 'ฟอง') return `${amount.toLocaleString()} ฟอง`;

  // Handle weight units
  if (amount >= 1000 && (unit === 'g' || unit === 'kg')) {
    const kilos = amount / 1000;
    return `${kilos.toLocaleString()} กิโลกรัม`;
  }
  return `${amount.toLocaleString()} ${unit === 'g' ? 'กรัม' : unit === 'kg' ? 'กิโลกรัม' : unit}`;
};

export default function IngredientsRegistryPage() {
  const [ingredients, setIngredients] = useState<RegisteredItem[]>([]);
  const [stockNames, setStockNames] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // UI State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RegisteredItem | null>(null);

  // Form State
  const [nameInput, setNameInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('g'); // Default to grams
  const [priceInput, setPriceInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Edit Form State
  const [editNameInput, setEditNameInput] = useState('');
  const [editQuantityInput, setEditQuantityInput] = useState('');
  const [editQuantityUnit, setEditQuantityUnit] = useState('g');
  const [editPriceInput, setEditPriceInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Refs for focus management
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Pending Items for Bulk Add
  const [pendingItems, setPendingItems] = useState<RegisteredItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const loadIngredients = useCallback(async () => {
    const allItems = await getRegisteredIngredients();
    setIngredients(allItems as RegisteredItem[]);
  }, []);

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      await loadIngredients();
      await getStockNames().then(setStockNames);
      setIsLoading(false);
    };
    initData();

    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser(user.name || user.username || 'Unknown');
      } catch (e) {
        console.error('Error parsing user', e);
      }
    }
  }, [loadIngredients]);

  useEffect(() => {
    if (isAddModalOpen && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [isAddModalOpen]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNameInput(value);
    if (value.length > 0) {
      const filtered = stockNames.filter(name =>
        name.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (name: string) => {
    setNameInput(name);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const addToPendingList = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!nameInput || !quantityInput || !priceInput) {
      setMessage({ text: 'กรุณากรอกข้อมูลให้ครบถ้วน', type: 'error' });
      return;
    }

    // Convert to grams if unit is kg
    const quantityInGrams = quantityUnit === 'kg'
      ? Number(quantityInput) * 1000
      : Number(quantityInput);

    const newItem: RegisteredItem = {
      name: nameInput,
      quantity: quantityInGrams,
      unit: quantityUnit === 'kg' ? 'g' : quantityUnit,
      price: Number(priceInput),
      user: currentUser,
      date: new Date().toISOString(),
      tempId: Date.now(),
    };

    setPendingItems([...pendingItems, newItem]);

    // Reset form
    setNameInput('');
    setQuantityInput('');
    setQuantityUnit('g');
    setPriceInput('');
    setMessage({ text: `เพิ่ม "${nameInput}" แล้ว!`, type: 'success' });
    setTimeout(() => setMessage(null), 2000);
    setTimeout(() => nameInputRef.current?.focus(), 100);
  };

  const removeFromPending = (tempId: number) => {
    setPendingItems(pendingItems.filter(item => item.tempId !== tempId));
  };

  const handleSaveAll = () => {
    if (pendingItems.length === 0) return;

    startTransition(async () => {
      const formData = new FormData();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const itemsPayload = JSON.stringify(pendingItems.map(({ tempId, ...rest }) => rest));
      formData.append('items', itemsPayload);
      const result = await addMultipleRegisteredIngredients(null, formData);

      if (result?.success) {
        setMessage({ text: result.message, type: 'success' });
        setPendingItems([]);
        loadIngredients();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ text: result?.message || 'เกิดข้อผิดพลาด', type: 'error' });
      }
    });
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addToPendingList();
    }
  };

  const handleEditItem = (item: RegisteredItem) => {
    setEditingItem(item);
    setEditNameInput(item.name);
    if (item.unit === 'ฟอง') {
      setEditQuantityInput(item.quantity.toString());
      setEditQuantityUnit('ฟอง');
    } else if (item.quantity >= 1000) {
      setEditQuantityInput((item.quantity / 1000).toString());
      setEditQuantityUnit('kg');
    } else {
      setEditQuantityInput(item.quantity.toString());
      setEditQuantityUnit('g');
    }
    setEditPriceInput(item.price.toString());
    setIsEditModalOpen(true);
  };

  const handleUpdateSubmit = async () => {
    if (!editingItem) return;

    const quantityValue = parseFloat(editQuantityInput);
    const priceValue = parseFloat(editPriceInput);

    if (isNaN(quantityValue) || quantityValue <= 0 || isNaN(priceValue) || priceValue < 0) {
      setMessage({ text: 'กรุณากรอกข้อมูลให้ครบถ้วน', type: 'error' });
      setTimeout(() => setMessage(null), 2000);
      return;
    }

    setIsUpdating(true);

    const formData = new FormData();
    formData.append('originalDate', editingItem.date);
    formData.append('originalName', editingItem.name);
    formData.append('name', editNameInput);
    formData.append('quantity', (editQuantityUnit === 'kg' ? quantityValue * 1000 : quantityValue).toString());
    formData.append('unit', editQuantityUnit === 'kg' ? 'g' : editQuantityUnit);
    formData.append('price', priceValue.toString());
    formData.append('user', currentUser);

    try {
      const result = await updateRegisteredIngredient(null, formData);

      if (result?.success) {
        setMessage({ text: result.message, type: 'success' });
        setIsEditModalOpen(false);
        setEditingItem(null);
        loadIngredients();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ text: result?.message || 'เกิดข้อผิดพลาด', type: 'error' });
      }
    } catch (error) {
      console.error('Update error:', error);
      setMessage({ text: 'เกิดข้อผิดพลาดในการอัปเดต', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (item: RegisteredItem) => {
    if (!confirm(`คุณต้องการลบ "${item.name}" ใช่หรือไม่?`)) return;

    startTransition(async () => {
      const result = await deleteRegisteredIngredient(item.date, item.name);
      if (result?.success) {
        setMessage({ text: result.message, type: 'success' });
        loadIngredients();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ text: result?.message || 'เกิดข้อผิดพลาด', type: 'error' });
      }
    });
  };

  // const totalPendingPrice = pendingItems.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="max-w-6xl mx-auto mt-4 md:mt-6 p-2 md:p-4 relative">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/50 z-100 flex items-center justify-center backdrop-blur-sm">
          <Loading />
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <ClipboardList className="w-8 h-8 mr-3 text-blue-600" />
            ลงทะเบียนข้อมูลวัตถุดิบ
          </h1>
          <p className="text-gray-500 text-sm">จัดการฐานข้อมูลวัตถุดิบหลัก (ไม่เก็บสลิป)</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center shadow-md transition-transform transform active:scale-95"
        >
          <Plus className="w-5 h-5 mr-2" />
          ลงทะเบียนใหม่
        </button>
      </div>

      {/* Message Toast */}
      {message && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'} animate-fade-in-down`}>
          {message.text}
        </div>
      )}

      {/* Content Area */}
      <div className="space-y-8">

        {/* Pending Items (Basket) */}
        {pendingItems.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-blue-200 overflow-hidden animate-fade-in">
            <div className="bg-blue-50 px-6 py-3 border-b border-blue-100 flex justify-between items-center">
              <div className="flex items-center text-blue-800 font-semibold">
                <ShoppingCart className="w-5 h-5 mr-2" />
                รายการที่รอการลงทะเบียน <span className="ml-2 bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full">{pendingItems.length}</span>
              </div>
            </div>

            <table className="hidden md:table min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">ชื่อ</th>
                  <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">ปริมาณ</th>
                  <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">ราคา</th>
                  <th className="px-6 py-2"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {pendingItems.map((item) => (
                  <tr key={item.tempId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{formatQuantity(item.quantity, item.unit)}</td>
                    <td className="px-6 py-3 text-sm text-gray-900 font-medium">฿{item.price.toLocaleString()}</td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => item.tempId && removeFromPending(item.tempId)} className="text-gray-400 hover:text-red-500 transition-colors bg-gray-100 p-1 rounded-full">
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile View for Pending */}
            <div className="md:hidden divide-y divide-gray-100">
              {pendingItems.map((item) => (
                <div key={item.tempId} className="p-4 flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-900 text-base">{item.name}</div>
                    <div className="text-gray-500 text-sm">ปริมาณ: {formatQuantity(item.quantity, item.unit)} | ราคา: ฿{item.price.toLocaleString()}</div>
                  </div>
                  <button onClick={() => item.tempId && removeFromPending(item.tempId)} className="text-gray-400 hover:text-red-500 p-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 px-4 py-4 md:px-6 md:py-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={handleSaveAll}
                disabled={isPending}
                className="w-full md:w-auto flex justify-center py-2.5 px-8 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-green-600 hover:bg-green-700 focus:outline-none disabled:opacity-70 transition-all transform active:scale-[0.98]"
              >
                {isPending ? (
                  <span className="flex items-center"><Clock className="w-4 h-4 mr-2 animate-spin" /> กำลังบันทึก...</span>
                ) : (
                  <span className="flex items-center"><Save className="w-4 h-4 mr-2" /> ยืนยันการลงทะเบียน</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* History List - Registered Ingredients */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b bg-linear-to-r from-blue-50 to-gray-50">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-gray-700">วัตถุดิบที่ลงทะเบียนไว้</h2>
              <div className="text-sm text-gray-500">ทั้งหมด {ingredients.length} รายการ</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">ชื่อวัตถุดิบ</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">ปริมาณ/หน่วย</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">ราคาล่าสุด</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">วิเคราะห์ต้นทุน</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">จัดการ</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {ingredients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-400 italic">ยังไม่มีการลงทะเบียนวัตถุดิบ</td>
                  </tr>
                ) : (
                  ingredients.map((item, idx) => {
                    const costPerUnit = item.price / item.quantity;
                    const isPiece = item.unit === 'ฟอง';

                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                          <div className="text-xs text-gray-400">{new Date(item.date).toLocaleDateString('th-TH')}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatQuantity(item.quantity, item.unit)}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-700">
                          ฿{item.price.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-center">
                            <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold shadow-xs border border-green-100">
                              ฿{costPerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} / {isPiece ? 'ฟอง' : 'กรัม'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleEditItem(item)}
                              className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                              title="แก้ไข"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                              title="ลบ"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-110 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <Plus className="w-5 h-5 mr-2 text-blue-600" /> เพิ่มรายการใหม่
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 border rounded-full p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อวัตถุดิบ</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameInput}
                  onChange={handleNameChange}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  autoComplete="off"
                  className="w-full rounded-lg border-gray-300 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border text-base"
                  placeholder="พิมพ์ชื่อ..."
                />
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute z-50 w-full text-gray-500 bg-white border border-gray-200 rounded-lg mt-1 shadow-xl max-h-40 overflow-auto">
                    {suggestions.map((name, index) => (
                      <li
                        key={index}
                        onMouseDown={() => selectSuggestion(name)}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-50 last:border-0"
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ปริมาณ</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                    min="0.1"
                    step="0.1"
                    className="flex-1 rounded-lg border-gray-300 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border text-base"
                    placeholder="0"
                  />
                  <select
                    value={quantityUnit}
                    onChange={(e) => setQuantityUnit(e.target.value)}
                    className="w-32 rounded-lg border-gray-300 text-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border text-base"
                  >
                    <option value="g">กรัม</option>
                    <option value="kg">กิโลกรัม</option>
                    <option value="ฟอง">ฟอง</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ราคา (บาท)</label>
                <input
                  type="number"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  onKeyDown={handlePriceKeyDown}
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border-gray-300 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border text-base"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t flex gap-3">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 py-2.5 px-4 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium"
              >
                เสร็จสิ้น
              </button>
              <button
                onClick={() => addToPendingList()}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
              >
                + เพิ่มรายการ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-110 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="bg-blue-50 px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">แก้ไขข้อมูล</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อวัตถุดิบ</label>
                <input
                  type="text"
                  value={editNameInput}
                  onChange={(e) => setEditNameInput(e.target.value)}
                  className="w-full rounded-lg border-gray-300 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border text-base"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ปริมาณ</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editQuantityInput}
                    onChange={(e) => setEditQuantityInput(e.target.value)}
                    className="w-full rounded-lg border-gray-300 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">หน่วย</label>
                  <select
                    value={editQuantityUnit}
                    onChange={(e) => setEditQuantityUnit(e.target.value)}
                    className="w-full rounded-lg border-gray-300 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border text-base"
                  >
                    <option value="g">กรัม (g)</option>
                    <option value="kg">กิโลกรัม (kg)</option>
                    <option value="ฟอง">ฟอง</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ราคา (บาท)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editPriceInput}
                  onChange={(e) => setEditPriceInput(e.target.value)}
                  className="w-full rounded-lg border-gray-300 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border text-base"
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t flex gap-3">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 py-2.5 px-4 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleUpdateSubmit}
                disabled={isUpdating}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                {isUpdating ? 'กำลังอัปเดต...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
