'use client';

import { useEffect, useState, useTransition, useRef, useCallback } from 'react';
import { addMultipleStockItems, getStockItems, getStockNames, updateStockItem } from '@/app/actions';
import { Plus, Clock, Save, X, ShoppingCart, Upload, Eye, Edit } from 'lucide-react';
import Loading from '@/components/Loading';

interface StockItem {
  _id?: string;
  tempId?: number;
  rowIndex?: number;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  user: string;
  date?: string;
  receipt?: string;
  file?: File;
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

export default function StockPage() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockNames, setStockNames] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Filter State
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // UI State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [batchFile, setBatchFile] = useState<File | null>(null); // New batch file state

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
  const [editFile, setEditFile] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Refs for focus management
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Pending Items for Bulk Add
  const [pendingItems, setPendingItems] = useState<StockItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const loadStockIds = useCallback(async () => {
    const allItems = await getStockItems();
    const filteredItems = allItems.filter((item: StockItem) => {
      if (!item.date) return false;
      return item.date.startsWith(selectedDate);
    });
    setStockItems(filteredItems);
  }, [selectedDate]);

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      await loadStockIds();
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
  }, [loadStockIds]);

  useEffect(() => {
    if (isAddModalOpen && nameInputRef.current) {
      // Small delay to allow modal to render
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

    const newItem: StockItem = {
      name: nameInput,
      quantity: quantityInGrams,
      unit: quantityUnit === 'kg' ? 'g' : quantityUnit, // If kg, we converted to g
      price: Number(priceInput),
      user: currentUser,
      tempId: Date.now(),
    };

    setPendingItems([...pendingItems, newItem]);

    // Reset form (keep modal open)
    setNameInput('');
    setQuantityInput('');
    setQuantityUnit('g'); // Reset to grams
    setPriceInput('');
    setMessage({ text: `เพิ่ม "${nameInput}" แล้ว! พร้อมเพิ่มรายการถัดไป`, type: 'success' });

    // Clear success message after 2 seconds
    setTimeout(() => setMessage(null), 2000);

    // Focus back to name input for next item
    setTimeout(() => nameInputRef.current?.focus(), 100);
  };

  const removeFromPending = (tempId: number) => {
    setPendingItems(pendingItems.filter(item => item.tempId !== tempId));
  };

  const handleSaveAll = () => {
    if (pendingItems.length === 0) return;

    startTransition(async () => {
      const formData = new FormData();

      // Append Batch File if exists
      if (batchFile) {
        formData.append('batch_file', batchFile);
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const itemsPayload = JSON.stringify(pendingItems.map(({ tempId, ...rest }) => rest));
      formData.append('items', itemsPayload);

      const result = await addMultipleStockItems(null, formData);

      if (result?.success) {
        setMessage({ text: result.message, type: 'success' });
        setPendingItems([]);
        setBatchFile(null); // Reset batch file
        loadStockIds();
        getStockNames().then(setStockNames);
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ text: result?.message || 'เกิดข้อผิดพลาด', type: 'error' });
      }
    });
  };

  // Handle Enter key in Price input to add item
  const handlePriceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addToPendingList();
    }
  };

  // Handle Edit Item
  const handleEditItem = (item: StockItem) => {
    setEditingItem(item);
    setEditNameInput(item.name);
    // Convert quantity back to appropriate unit
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
    setEditFile(null);
    setIsEditModalOpen(true);
  };

  // Handle Update Submit
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
    formData.append('originalDate', editingItem.date || '');
    formData.append('originalName', editingItem.name);
    formData.append('originalUser', editingItem.user);
    formData.append('name', editNameInput);
    formData.append('quantity', (editQuantityUnit === 'kg' ? quantityValue * 1000 : quantityValue).toString());
    formData.append('unit', editQuantityUnit === 'kg' ? 'g' : editQuantityUnit);
    formData.append('price', priceValue.toString());
    formData.append('user', editingItem.user);
    formData.append('existingReceipt', editingItem.receipt || '');

    if (editFile) {
      formData.append('file', editFile);
    }

    try {
      const result = await updateStockItem(null, formData);

      if (result?.success) {
        setMessage({ text: result.message, type: 'success' });
        setIsEditModalOpen(false);
        setEditingItem(null);
        loadStockIds();
        getStockNames().then(setStockNames);
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ text: result?.message || 'เกิดข้อผิดพลาด', type: 'error' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error('Update error:', error);
      setMessage({ text: 'เกิดข้อผิดพลาดในการอัพเดท', type: 'error' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsUpdating(false);
    }
  };

  const totalPendingPrice = pendingItems.reduce((sum, item) => sum + item.price, 0);

  // Group items by receipt for alternating colors
  const groupedItems = stockItems.reduce((acc, item, index) => {
    const prevItem = stockItems[index - 1];
    const isSameGroup = prevItem &&
      prevItem.receipt &&
      item.receipt &&
      prevItem.receipt === item.receipt;

    if (!isSameGroup) {
      acc.push([item]);
    } else {
      acc[acc.length - 1].push(item);
    }
    return acc;
  }, [] as StockItem[][]);

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
          <h1 className="text-2xl font-bold text-gray-800">เพิ่มข้อมูลวัตถุดิบ</h1>
          <p className="text-gray-500 text-sm">จัดการรายการสินค้าเข้าสต็อกวันนี้</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center shadow-md transition-transform transform active:scale-95"
        >
          <Plus className="w-5 h-5 mr-2" />
          เพิ่มรายการ
        </button>
      </div>

      {/* Message Toast (Top Center) */}
      {message && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'} animate-fade-in-down`}>
          {message.text}
        </div>
      )}

      {/* Content Area */}
      <div className="space-y-8">

        {/* Pending Items (Basket) - Only show if there are items */}
        {pendingItems.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-blue-200 overflow-hidden animate-fade-in">
            <div className="bg-blue-50 px-6 py-3 border-b border-blue-100 flex justify-between items-center">
              <div className="flex items-center text-blue-800 font-semibold">
                <ShoppingCart className="w-5 h-5 mr-2" />
                รายการที่รอการบันทึก <span className="ml-2 bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full">{pendingItems.length}</span>
              </div>
              <div className="text-sm font-medium text-blue-800">
                รวม: <span className="text-lg">฿{totalPendingPrice.toLocaleString()}</span>
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

            {/* Mobile Card View for Pending Items */}
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



            <div className="bg-gray-50 px-4 py-4 md:px-6 md:py-3 border-t border-gray-100">
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    แนบใบเสร็จรวม (ใช้ร่วมกันทุกรายการที่ไม่มีรูป)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          if (e.target.files[0].size > 10 * 1024 * 1024) {
                            alert("ไฟล์มีขนาดใหญ่เกินไป");
                            return;
                          }
                          setBatchFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                      id="batch-file-upload"
                    />
                    <label
                      htmlFor="batch-file-upload"
                      className={`flex items-center justify-center px-4 py-2 border border-dashed rounded-lg cursor-pointer transition-colors text-sm flex-1 ${batchFile ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 text-gray-500 hover:bg-white'}`}
                    >
                      {batchFile ? (
                        <>
                          <Upload className="w-4 h-4 mr-2 text-green-600" />
                          <span className="truncate">{batchFile.name}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          <span>เลือกใบเสร็จรวม</span>
                        </>
                      )}
                    </label>
                    {batchFile && (
                      <button
                        onClick={() => setBatchFile(null)}
                        className="ml-2 p-1 text-gray-400 hover:text-red-500"
                        title="ลบไฟล์"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="w-full md:w-[200px] flex justify-end items-end h-full pt-2 md:pt-6">
                  <button
                    onClick={handleSaveAll}
                    disabled={isPending}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-green-600 hover:bg-green-700 focus:outline-none disabled:opacity-70 transition-all transform active:scale-[0.98]"
                  >
                    {isPending ? (
                      <span className="flex items-center"><Clock className="w-4 h-4 mr-2 animate-spin" /> กำลังบันทึก...</span>
                    ) : (
                      <span className="flex items-center"><Save className="w-4 h-4 mr-2" /> ยืนยันการบันทึก</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
            {/* Old footer removed, integrated above */}
          </div>
        )}

        {/* History List (Full Width) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Filter Header */}
          <div className="px-6 py-4 border-b bg-linear-to-r from-blue-50 to-gray-50">
            <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
              <div className="flex flex-col md:flex-row gap-4 md:items-center flex-1">
                {/* Date Picker */}
                <div className="flex items-center gap-2">
                  {/* <Clock className="w-5 h-5 text-gray-500" /> */}
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-2 text-gray-500 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Total Items */}
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200">
                  <span className="text-sm font-medium text-gray-600">รายการทั้งหมด:</span>
                  <span className="text-lg font-bold text-blue-600">{stockItems.length}</span>
                </div>

                {/* Total Price */}
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200">
                  <span className="text-sm font-medium text-gray-600">ราคารวม:</span>
                  <span className="text-lg font-bold text-green-600">
                    {stockItems.reduce((sum, item) => sum + item.price, 0).toLocaleString()}
                  </span>
                  <span className="text-sm font-medium text-gray-600">บาท</span>
                </div>
              </div>
            </div>
          </div>

          {stockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Clock className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">ยังไม่มีรายการบันทึกในวันที่เลือก</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Group by receipt */}
              {groupedItems.map((group, groupIndex) => {
                const groupTotal = group.reduce((sum, item) => sum + item.price, 0);
                const groupReceipt = group[0].receipt;

                return (
                  <div key={groupIndex} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    {/* Group Header - Only show on desktop */}
                    <div className="hidden md:block bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <div className="grid grid-cols-6 text-xs font-medium text-gray-600 uppercase">
                        <div>เวลา</div>
                        <div>ชื่อวัตถุดิบ</div>
                        <div>ปริมาณ</div>
                        <div className="text-right">ราคา</div>
                        <div className="text-right">ผู้บันทึก</div>
                        <div className="text-right">จัดการ</div>
                      </div>
                    </div>

                    {/* Group Items */}
                    <div className="bg-white divide-y divide-gray-100">
                      {group.map((item, itemIndex) => (
                        <div key={itemIndex} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                          {/* Desktop View */}
                          <div className="hidden md:grid md:grid-cols-6 md:items-center md:gap-4">
                            <div className="text-sm text-gray-500">
                              {item.date && new Date(item.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-sm font-medium text-gray-900">{item.name}</div>
                            <div className="text-sm text-gray-600">{formatQuantity(item.quantity, item.unit)}</div>
                            <div className="text-sm font-semibold text-green-600 text-right">฿{item.price.toLocaleString()}</div>
                            <div className="text-sm text-gray-500 text-right">{item.user}</div>
                            <div className="text-right">
                              <button
                                onClick={() => handleEditItem(item)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                แก้ไข
                              </button>
                            </div>
                          </div>

                          {/* Mobile View */}
                          <div className="md:hidden">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{item.name}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {item.date && new Date(item.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} • {item.user}
                                </div>
                                <div className="text-sm text-gray-600 mt-1">ปริมาณ: {formatQuantity(item.quantity, item.unit)}</div>
                              </div>
                              <div className="font-semibold text-green-600">฿{item.price.toLocaleString()}</div>
                            </div>
                            <button
                              onClick={() => handleEditItem(item)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              แก้ไข
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Group Footer */}
                    <div className="bg-linear-to-r from-gray-50 to-blue-50 px-4 py-3 border-t border-gray-200">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium text-gray-600">
                            รวม <span className="font-bold text-blue-600">{group.length}</span> รายการ
                          </span>
                          <span className="text-sm font-medium text-gray-600">
                            ราคารวม <span className="font-bold text-green-600 text-sm"> {groupTotal.toLocaleString()}</span> <span className="text-sm font-medium text-gray-600">บาท</span>
                          </span>
                        </div>
                        {groupReceipt && (
                          <button
                            onClick={() => setPreviewImage(groupReceipt)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                          >
                            <Eye className="w-4 h-4" />
                            ดูรูปภาพ
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-scale-in overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <Plus className="w-5 h-5 mr-2 text-blue-600" /> เพิ่มรายการใหม่
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 bg-white p-1 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
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

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setNameInput('');
                  setQuantityInput('');
                  setPriceInput('');
                  setMessage(null);
                }}
                className="flex-1 py-2.5 px-4 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 shadow-sm transition-colors"
              >
                เสร็จสิ้น
              </button>
              <button
                onClick={() => addToPendingList()}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-sm transition-colors text-base"
              >
                + เพิ่มรายการ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-scale-in overflow-hidden">
            <div className="bg-blue-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <Edit className="w-5 h-5 mr-2 text-blue-600" /> แก้ไขรายการ
              </h2>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingItem(null);
                }}
                className="text-gray-400 hover:text-gray-600 bg-white p-1 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
              >
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
                  placeholder="ชื่อวัตถุดิบ"
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
                    placeholder="0"
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
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รูปใบเสร็จ {editingItem.receipt && <span className="text-green-600">(มีรูปอยู่แล้ว)</span>}
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-100 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {editFile ? editFile.name : 'อัพโหลดรูปใหม่'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                  {(editFile || editingItem.receipt) && (
                    <button
                      onClick={() => {
                        if (editingItem.receipt) {
                          setPreviewImage(editingItem.receipt);
                        }
                      }}
                      className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      title="ดูรูปปัจจุบัน"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">อัพโหลดรูปใหม่หากต้องการเปลี่ยน</p>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingItem(null);
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleUpdateSubmit}
                disabled={isUpdating}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    กำลังอัพเดท...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    บันทึกการแก้ไข
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
            {/* Close Button */}
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 p-2"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage}
              alt="Receipt Preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-gray-800 bg-black"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

    </div>
  );
}
