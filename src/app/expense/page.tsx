'use client';

import { useEffect, useState, useTransition, useRef, useCallback, useMemo } from 'react';
import Loading from '@/components/Loading';
import {
  getExpenseEvents,
  createExpenseEvent,
  updateExpenseEvent,
  deleteExpenseEvent,
  getExpenseItems,
  addExpenseItemWithReceipt,
  updateExpenseItem,
  deleteExpenseItem,
} from '@/app/actions';
import {
  Plus,
  Clock,
  Save,
  X,
  Calendar,
  Trash2,
  Edit,
  FileText,
  Receipt,
  AlertCircle,
  Wallet,
  Upload,
  Eye,
  Image as ImageIcon,
  FileSpreadsheet,
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface ExpenseEvent {
  eventId: string;
  name: string;
  date: string;
  income: number;
  createdAt: string;
}

interface ExpenseItem {
  id: string;
  eventId: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  notes: string;
  receipt?: string;
  createdAt: string;
}

// Common unit options
const UNIT_OPTIONS = ['กิโล', 'กรัม', 'ลิตร', 'ลูก', 'ถุง', 'ชุด', 'ชิ้น', 'กล่อง', 'ขวด', 'แพ็ค', 'ลัง', 'ถัง', 'วัน', 'รายการ'];

export default function ExpensePage() {
  // Data State
  const [events, setEvents] = useState<ExpenseEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ExpenseEvent | null>(null);
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  // const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // UI State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ExpenseEvent | null>(null);
  const [editingItem, setEditingItem] = useState<ExpenseItem | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'event' | 'item'; id: string; name: string } | null>(null);

  // Form State - Event
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);

  // Form State - Item
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState('');
  const [itemUnit, setItemUnit] = useState('กิโล');
  const [itemUnitCost, setItemUnitCost] = useState('');
  const [itemTotalCost, setItemTotalCost] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [itemFile, setItemFile] = useState<File | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Transitions & Messages
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Refs
  const itemNameInputRef = useRef<HTMLInputElement>(null);

  // Load events
  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    const data = await getExpenseEvents();
    setEvents(data);
    setIsLoading(false);
  }, []);

  // Load items for an event
  const loadItems = useCallback(async (eventId: string) => {
    setIsLoading(true);
    const data = await getExpenseItems(eventId);
    setExpenseItems(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Filter events by date
  const filteredEvents = useMemo(() => events.filter((event) => {
    const eventDate = new Date(event.date).toISOString().split('T')[0];
    return eventDate === filterDate;
  }), [events, filterDate]);

  // Auto-load items when event exists for the selected date
  useEffect(() => {
    if (filteredEvents.length > 0) {
      const currentEvent = filteredEvents[0];
      // setExpandedEventId(currentEvent.eventId);
      setSelectedEvent(currentEvent);
      loadItems(currentEvent.eventId);
    } else {
      // setExpandedEventId(null);
      setSelectedEvent(null);
      setExpenseItems([]);
    }
  }, [filteredEvents, filterDate, loadItems]);

  // Auto-calculate total cost when quantity or unit cost changes
  useEffect(() => {
    const qty = parseFloat(itemQuantity) || 0;
    const cost = parseFloat(itemUnitCost) || 0;
    if (qty > 0 && cost > 0) {
      setItemTotalCost((qty * cost).toFixed(2));
    }
  }, [itemQuantity, itemUnitCost]);

  // Focus item name input when modal opens
  useEffect(() => {
    if (isItemModalOpen && itemNameInputRef.current) {
      setTimeout(() => itemNameInputRef.current?.focus(), 100);
    }
  }, [isItemModalOpen]);

  // Show message toast
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // Toggle event expansion (not needed anymore but keep for compatibility)
  // const toggleEventExpansion = async (event: ExpenseEvent) => {
  //   // Component is always expanded now, but keep function for compatibility
  // };


  // Update Event
  const handleUpdateEvent = () => {
    if (!editingEvent || !eventName || !eventDate) {
      showMessage('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('eventId', editingEvent.eventId);
      formData.append('name', eventName);
      formData.append('date', eventDate);
      formData.append('income', editingEvent.income.toString());

      const result = await updateExpenseEvent(null, formData);
      if (result?.success) {
        showMessage(result.message, 'success');
        setIsEditEventModalOpen(false);
        setEditingEvent(null);
        resetEventForm();
        loadEvents();
      } else {
        showMessage(result?.message || 'เกิดข้อผิดพลาด', 'error');
      }
    });
  };

  // Delete Event/Item
  const handleDelete = () => {
    if (!deleteTarget) return;

    startTransition(async () => {
      let result;
      if (deleteTarget.type === 'event') {
        result = await deleteExpenseEvent(deleteTarget.id);
        if (result?.success) {
          // setExpandedEventId(null);
          setSelectedEvent(null);
          setExpenseItems([]);
          loadEvents();
        }
      } else {
        result = await deleteExpenseItem(deleteTarget.id);
        if (result?.success && selectedEvent) {
          loadItems(selectedEvent.eventId);
        }
      }

      if (result?.success) {
        showMessage(result.message, 'success');
      } else {
        showMessage(result?.message || 'เกิดข้อผิดพลาด', 'error');
      }
      setIsDeleteConfirmOpen(false);
      setDeleteTarget(null);
    });
  };

  // Update Item
  const handleUpdateItem = () => {
    if (!editingItem) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append('id', editingItem.id);
      formData.append('eventId', editingItem.eventId);
      formData.append('itemName', itemName);
      formData.append('quantity', itemQuantity);
      formData.append('unit', itemUnit);
      formData.append('unitCost', itemUnitCost);
      formData.append('totalCost', itemTotalCost);
      formData.append('notes', itemNotes);
      formData.append('existingReceipt', editingItem.receipt || '');
      if (editFile) {
        formData.append('file', editFile);
      }

      const result = await updateExpenseItem(null, formData);
      if (result?.success) {
        showMessage(result.message, 'success');
        setIsEditItemModalOpen(false);
        setEditingItem(null);
        resetItemForm();
        if (selectedEvent) {
          loadItems(selectedEvent.eventId);
        }
      } else {
        showMessage(result?.message || 'เกิดข้อผิดพลาด', 'error');
      }
    });
  };

  // Open edit event modal
  const openEditEvent = (event: ExpenseEvent) => {
    setEditingEvent(event);
    setEventName(event.name);
    setEventDate(event.date);
    setIsEditEventModalOpen(true);
  };

  // Open edit item modal
  const openEditItem = (item: ExpenseItem) => {
    setEditingItem(item);
    setItemName(item.itemName);
    setItemQuantity(item.quantity.toString());
    setItemUnit(item.unit);
    setItemUnitCost(item.unitCost.toString());
    setItemTotalCost(item.totalCost.toString());
    setItemNotes(item.notes);
    setIsEditItemModalOpen(true);
  };

  // Open delete confirmation
  const openDeleteConfirm = (type: 'event' | 'item', id: string, name: string) => {
    setDeleteTarget({ type, id, name });
    setIsDeleteConfirmOpen(true);
  };

  // Reset forms
  const resetEventForm = () => {
    setEventName('');
    setEventDate(new Date().toISOString().split('T')[0]);
  };

  const resetItemForm = () => {
    setItemName('');
    setItemQuantity('');
    setItemUnit('กิโล');
    setItemUnitCost('');
    setItemTotalCost('');
    setItemNotes('');
    setItemFile(null);
    setEditFile(null);
  };

  // Save single item directly (create event if needed)
  const handleSaveItem = () => {
    if (!itemName || !itemQuantity || !itemUnitCost) {
      showMessage('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
      return;
    }

    startTransition(async () => {
      let eventId = selectedEvent?.eventId;

      // If no event exists for this date, check if there's one in filteredEvents or create new
      if (!eventId) {
        // Check if there's already an event for this date
        const existingEvent = filteredEvents.find(e => {
          const eventDate = new Date(e.date).toISOString().split('T')[0];
          return eventDate === filterDate;
        });

        if (existingEvent) {
          eventId = existingEvent.eventId;
          setSelectedEvent(existingEvent);
        } else {
          // Create new event
          const eventFormData = new FormData();
          eventFormData.append('name', eventName || `งาน ${new Date(filterDate).toLocaleDateString('th-TH')}`);
          eventFormData.append('date', filterDate);
          eventFormData.append('income', '0');

          const eventResult = await createExpenseEvent(null, eventFormData);
          if (!eventResult?.success || !eventResult.eventId) {
            showMessage(eventResult?.message || 'เกิดข้อผิดพลาดในการสร้างงาน', 'error');
            return;
          }
          eventId = eventResult.eventId;
        }
      }

      const formData = new FormData();
      formData.append('eventId', eventId);
      formData.append('itemName', itemName);
      formData.append('quantity', itemQuantity);
      formData.append('unit', itemUnit);
      formData.append('unitCost', itemUnitCost);
      formData.append('totalCost', itemTotalCost || String(parseFloat(itemQuantity) * parseFloat(itemUnitCost)));
      formData.append('notes', itemNotes);

      // Append file if selected
      if (itemFile) {
        console.log('Sending file:', itemFile.name, itemFile.size, itemFile.type);
        formData.append('file', itemFile);
      }

      const result = await addExpenseItemWithReceipt(null, formData);

      if (result?.success) {
        showMessage(result.message, 'success');
        resetItemForm();
        await loadEvents();
        // Find and expand the event
        const updatedEvents = await getExpenseEvents();
        const newEvent = updatedEvents.find(e => e.eventId === eventId);
        if (newEvent) {
          // setExpandedEventId(newEvent.eventId);
          setSelectedEvent(newEvent);
          await loadItems(newEvent.eventId);
        }
        setIsItemModalOpen(false);
      } else {
        showMessage(result?.message || 'เกิดข้อผิดพลาด', 'error');
      }
    });
  };

  // Export to Excel function
  const exportToExcel = async () => {
    if (!expenseItems.length) {
      showMessage('ไม่มีข้อมูลสำหรับส่งออก', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Expenses');

      // Define columns
      worksheet.columns = [
        { header: 'ลำดับ', key: 'index', width: 8 },
        { header: 'รายการ', key: 'itemName', width: 25 },
        { header: 'จำนวน', key: 'quantity', width: 10 },
        { header: 'หน่วย', key: 'unit', width: 10 },
        { header: 'ราคา/หน่วย', key: 'unitCost', width: 15 },
        { header: 'ยอดรวม', key: 'totalCost', width: 15 },
        { header: 'หมายเหตุ', key: 'notes', width: 30 },
        { header: 'ใบเสร็จ', key: 'receipt', width: 30 },
      ];

      // Style Header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // Process items
      for (let i = 0; i < expenseItems.length; i++) {
        const item = expenseItems[i];
        const rowIndex = i + 2;
        const row = worksheet.addRow({
          index: i + 1,
          itemName: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
          notes: item.notes || '-',
          receipt: item.receipt ? 'มีรูปภาพ' : 'ไม่มี',
        });

        // Alignment
        row.getCell('index').alignment = { horizontal: 'center' };
        row.getCell('quantity').alignment = { horizontal: 'center' };
        row.getCell('unit').alignment = { horizontal: 'center' };
        row.getCell('unitCost').alignment = { horizontal: 'right' };
        row.getCell('totalCost').alignment = { horizontal: 'right' };

        // Add Image if exists
        if (item.receipt) {
          try {
            // Fetch image as arrayBuffer
            const response = await fetch(item.receipt);
            const arrayBuffer = await response.arrayBuffer();

            // Add image to workbook
            const imageId = workbook.addImage({
              buffer: arrayBuffer,
              extension: 'jpeg', // Defaulting to jpeg, exceljs handles many
            });

            // Set a standard moderate row height for all data rows (approx 35 pixels)
            worksheet.getRow(rowIndex).height = 35;

            // Add image to worksheet at the receipt column (Column 8, Index 7)
            // Centered slightly with smaller margins
            worksheet.addImage(imageId, {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tl: { col: 7.1, row: rowIndex - 0.9 } as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              br: { col: 7.9, row: rowIndex - 0.1 } as any,
              editAs: 'oneCell'
            });

            row.getCell('receipt').value = ''; // Clear text if image is added
          } catch (error) {
            console.error('Failed to add image to Excel:', error);
            row.getCell('receipt').value = 'โหลดรูปไม่สำเร็จ';
          }
        }
      }

      // Generate Buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `Expenses_${filterDate}.xlsx`;
      saveAs(blob, filename);

      showMessage('ส่งออกไฟล์ Excel เรียบร้อยแล้ว', 'success');
    } catch (error) {
      console.error('Excel Export Error:', error);
      showMessage('เกิดข้อผิดพลาดในการส่งออกไฟล์', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key to save
  const handleSaveKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveItem();
    }
  };

  return (
    <div className="max-w-6xl mx-auto mt-4 md:mt-6 p-2 md:p-4 relative pb-20 md:pb-4">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/50 z-100 flex items-center justify-center backdrop-blur-sm">
          <Loading />
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-rose-500" />
            บันทึกรายจ่าย
          </h1>
          <p className="text-gray-500 text-sm mt-1">จัดการค่าใช้จ่ายแยกตามงาน/Event</p>
        </div>
      </div>

      {/* Message Toast */}
      {message && (
        <div
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg text-white font-medium ${message.type === 'success' ? 'bg-emerald-600' : 'bg-red-500'
            } animate-fade-in-down`}
        >
          {message.text}
        </div>
      )}

      {/* Date Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">เลือกวันที่:</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Daily Expense Component - Always Show */}
      <div className="space-y-4">
        {(() => {
          const currentEvent = filteredEvents.length > 0 ? filteredEvents[0] : null;
          const isExpanded = true; // Always expanded
          const eventItems = currentEvent ? expenseItems : [];
          const totalExpense = eventItems.reduce((sum, item) => sum + item.totalCost, 0);

          return (
            <div
              className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 ${isExpanded ? 'border-rose-200 shadow-lg shadow-rose-50' : 'border-gray-100 hover:border-gray-200'
                }`}
            >
              {/* Event Header */}
              <div
                className={`px-5 py-4 transition-colors ${isExpanded ? 'bg-linear-to-r from-rose-50 to-orange-50' : 'hover:bg-gray-50'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${isExpanded ? 'bg-rose-100' : 'bg-gray-100'
                        }`}
                    >
                      <Receipt className={`w-6 h-6 ${isExpanded ? 'text-rose-600' : 'text-gray-500'}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg">
                        รายละเอียดค่าใช้จ่าย
                      </h3>
                      <p className="text-sm text-gray-500 flex items-center gap-2 mt-0.5">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {new Date(filterDate).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {currentEvent && (
                      <div className="hidden md:flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditEvent(currentEvent);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="แก้ไข"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteConfirm('event', currentEvent.eventId, currentEvent.name);
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="ลบ"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  {/* Mobile Actions */}
                  {currentEvent && (
                    <div className="md:hidden flex justify-end gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <button
                        onClick={() => openEditEvent(currentEvent)}
                        className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg font-medium"
                      >
                        แก้ไขงาน
                      </button>
                      <button
                        onClick={() => openDeleteConfirm('event', currentEvent.eventId, currentEvent.name)}
                        className="px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg font-medium"
                      >
                        ลบงาน
                      </button>
                    </div>
                  )}

                  {/* Items Table */}
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-semibold text-gray-700">รายการค่าใช้จ่าย</h4>
                      <div className="flex gap-2">
                        <button
                          onClick={exportToExcel}
                          className="bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 flex items-center text-sm font-medium transition-colors"
                        >
                          <FileSpreadsheet className="w-4 h-4 mr-1" />
                          Excel
                        </button>
                        <button
                          onClick={() => setIsItemModalOpen(true)}
                          className="bg-rose-500 text-white px-4 py-2 rounded-lg hover:bg-rose-600 flex items-center text-sm font-medium transition-colors"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          เพิ่มรายการ
                        </button>
                      </div>
                    </div>

                    {eventItems.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>ยังไม่มีรายการค่าใช้จ่าย</p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-linear-to-r from-rose-50 to-orange-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-rose-700 uppercase tracking-wider">
                                  ลำดับที่
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-rose-700 uppercase tracking-wider">
                                  รายการ
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-rose-700 uppercase tracking-wider">
                                  จำนวน
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-rose-700 uppercase tracking-wider">
                                  หน่วย
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-rose-700 uppercase tracking-wider">
                                  ต้นทุน
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-rose-700 uppercase tracking-wider">
                                  ราคา
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-rose-700 uppercase tracking-wider">
                                  หมายเหตุ
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-rose-700 uppercase tracking-wider">
                                  สลิป
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-rose-700 uppercase tracking-wider">
                                  จัดการ
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {eventItems.map((item, index) => (
                                <tr key={item.id} className="hover:bg-rose-50/50 transition-colors">
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{index + 1}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {item.itemName}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700">
                                    {item.quantity}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700">
                                    {item.unit}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                                    {item.unitCost.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-rose-600">
                                    {item.totalCost.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={item.notes}>
                                    {item.notes || '-'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-center">
                                    {item.receipt ? (
                                      <button
                                        onClick={() => {
                                          setPreviewImage(item.receipt || null);
                                        }}
                                        className="inline-flex items-center px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 text-xs font-medium transition-colors"
                                      >
                                        <Eye className="w-3.5 h-3.5 mr-1" />
                                        ดูสลิป
                                      </button>
                                    ) : (
                                      <span className="text-gray-400 text-xs">None</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        onClick={() => openEditItem(item)}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="แก้ไข"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => openDeleteConfirm('item', item.id, item.itemName)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="ลบ"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                          {eventItems.map((item) => (
                            <div key={item.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <h5 className="font-semibold text-gray-900">{item.itemName}</h5>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {item.quantity} {item.unit} × {item.unitCost.toFixed(2)} ={' '}
                                    <span className="font-semibold text-rose-600">{item.totalCost.toFixed(2)}</span>
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {item.receipt && (
                                    <button
                                      onClick={() => {
                                        setPreviewImage(item.receipt || null);
                                      }}
                                      className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg"
                                      title="ดูสลิป"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openEditItem(item)}
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => openDeleteConfirm('item', item.id, item.itemName)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              {item.notes && (
                                <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">{item.notes}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Summary - Always Show */}
                  <div className="mt-4 pt-4 border-t border-gray-200 bg-linear-to-r from-rose-50 to-orange-50 rounded-xl p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">จำนวนรายการ:</span>
                      <span className="font-semibold text-gray-800">{eventItems.length} รายการ</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm font-medium text-gray-700">รวมค่าใช้จ่าย:</span>
                      <span className="text-lg font-bold text-rose-600">฿{totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Edit Event Modal */}
      {isEditEventModalOpen && editingEvent && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in overflow-hidden">
            <div className="bg-linear-to-r from-blue-500 to-indigo-500 px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center">
                <Edit className="w-5 h-5 mr-2" /> แก้ไขงาน
              </h2>
              <button
                onClick={() => {
                  setIsEditEventModalOpen(false);
                  setEditingEvent(null);
                  resetEventForm();
                }}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่องาน/Event</label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full rounded-xl border-gray-300 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full rounded-xl border-gray-300 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border text-base"
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setIsEditEventModalOpen(false);
                  setEditingEvent(null);
                  resetEventForm();
                }}
                className="flex-1 py-2.5 px-4 bg-white border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleUpdateEvent}
                disabled={isPending}
                className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isPending ? (
                  <span className="flex items-center justify-center">
                    <Clock className="w-4 h-4 mr-2 animate-spin" /> กำลังบันทึก...
                  </span>
                ) : (
                  'บันทึกการแก้ไข'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-linear-to-r from-rose-500 to-orange-500 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center">
                  <Plus className="w-5 h-5 mr-2" /> เพิ่มรายการค่าใช้จ่าย
                </h2>
                {selectedEvent && (
                  <p className="text-rose-100 text-sm mt-0.5">{selectedEvent.name}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setIsItemModalOpen(false);
                  resetItemForm();
                }}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รายการ</label>
                <input
                  ref={itemNameInputRef}
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full rounded-xl border-gray-300 text-gray-900 shadow-sm focus:border-rose-500 focus:ring-rose-500 p-3 border text-base"
                  placeholder="เช่น หมู สามชั้น"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">จำนวน</label>
                  <input
                    type="number"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    className="w-full rounded-xl border-gray-300 text-gray-900 shadow-sm focus:border-rose-500 focus:ring-rose-500 p-3 border text-base"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">หน่วย</label>
                  <select
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    className="w-full rounded-xl border-gray-300 text-gray-900 shadow-sm focus:border-rose-500 focus:ring-rose-500 p-3 border text-base"
                  >
                    {UNIT_OPTIONS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ต้นทุน (บาท)</label>
                  <input
                    type="number"
                    value={itemUnitCost}
                    onChange={(e) => setItemUnitCost(e.target.value)}
                    className="w-full rounded-xl border-gray-300 text-gray-900 shadow-sm focus:border-rose-500 focus:ring-rose-500 p-3 border text-base"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ราคา (บาท)</label>
                  <input
                    type="number"
                    value={itemTotalCost}
                    onChange={(e) => setItemTotalCost(e.target.value)}
                    onKeyDown={handleSaveKeyDown}
                    className="w-full rounded-xl border-gray-300 text-gray-900 shadow-sm focus:border-rose-500 focus:ring-rose-500 p-3 border text-base bg-rose-50 font-bold"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  หมายเหตุ <span className="text-gray-400 font-normal">- ไม่บังคับ</span>
                </label>
                <input
                  type="text"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full rounded-xl border-gray-300 text-gray-900 shadow-sm focus:border-rose-500 focus:ring-rose-500 p-3 border text-base"
                  placeholder="เช่น พี่พิชย์ 50 ถุง"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  แนบสลิป <span className="text-gray-400 font-normal">- ไม่บังคับ</span>
                </label>
                <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${itemFile ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-gray-300 text-gray-500 hover:border-rose-400 hover:bg-rose-50'
                  }`}>
                  {itemFile ? (
                    <>
                      <ImageIcon className="w-5 h-5" />
                      <span className="truncate max-w-[200px]">{itemFile.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setItemFile(null);
                        }}
                        className="ml-2 text-rose-600 hover:text-rose-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span>เลือกรูปสลิป</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setItemFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={handleSaveItem}
                disabled={isPending || !itemName || !itemQuantity || !itemUnitCost}
                className="w-full py-3 px-4 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <span className="flex items-center justify-center">
                    <Clock className="w-4 h-4 mr-2 animate-spin" /> กำลังบันทึก...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <Save className="w-4 h-4 mr-2" /> บันทึก
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {isEditItemModalOpen && editingItem && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in overflow-hidden">
            <div className="bg-linear-to-r from-blue-500 to-indigo-500 px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center">
                <Edit className="w-5 h-5 mr-2" /> แก้ไขรายการ
              </h2>
              <button
                onClick={() => {
                  setIsEditItemModalOpen(false);
                  setEditingItem(null);
                  resetItemForm();
                }}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รายการ</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full rounded-xl border-gray-300 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border text-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">จำนวน</label>
                  <input
                    type="number"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    className="w-full rounded-xl border-gray-300 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border text-base"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">หน่วย</label>
                  <select
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    className="w-full rounded-xl border-gray-300 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border text-base"
                  >
                    {UNIT_OPTIONS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ต้นทุน</label>
                  <input
                    type="number"
                    value={itemUnitCost}
                    onChange={(e) => setItemUnitCost(e.target.value)}
                    className="w-full rounded-xl border-gray-300 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border text-base"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ราคา</label>
                  <input
                    type="number"
                    value={itemTotalCost}
                    onChange={(e) => setItemTotalCost(e.target.value)}
                    className="w-full rounded-xl border-gray-300 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border text-base"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                <input
                  type="text"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full rounded-xl border-gray-300 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  สลิป {editingItem?.receipt && <span className="text-green-600">(มีรูปอยู่แล้ว)</span>}
                </label>
                <div className="flex items-center gap-2">
                  <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${editFile ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-500 hover:border-blue-400 hover:bg-blue-50'
                    }`}>
                    {editFile ? (
                      <>
                        <ImageIcon className="w-5 h-5" />
                        <span className="truncate max-w-[150px]">{editFile.name}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        <span>{editingItem?.receipt ? 'เปลี่ยนรูป' : 'เลือกรูป'}</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setEditFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  {(editFile || editingItem?.receipt) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (editingItem?.receipt) {
                          setPreviewImage(editingItem.receipt);
                        }
                      }}
                      className="px-3 py-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                      title="ดูรูป"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setIsEditItemModalOpen(false);
                  setEditingItem(null);
                  resetItemForm();
                }}
                className="flex-1 py-2.5 px-4 bg-white border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleUpdateItem}
                disabled={isPending}
                className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isPending ? (
                  <span className="flex items-center justify-center">
                    <Clock className="w-4 h-4 mr-2 animate-spin" /> กำลังบันทึก...
                  </span>
                ) : (
                  'บันทึกการแก้ไข'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-scale-in overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">ยืนยันการลบ</h3>
              <p className="text-gray-600">
                คุณต้องการลบ{deleteTarget.type === 'event' ? 'งาน' : 'รายการ'}{' '}
                <span className="font-semibold text-gray-800">&quot;{deleteTarget.name}&quot;</span> ใช่หรือไม่?
              </p>
              {deleteTarget.type === 'event' && (
                <p className="text-red-500 text-sm mt-2">
                  ⚠️ รายการค่าใช้จ่ายทั้งหมดในงานนี้จะถูกลบด้วย
                </p>
              )}
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setDeleteTarget(null);
                }}
                className="flex-1 py-2.5 px-4 bg-white border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isPending ? (
                  <span className="flex items-center justify-center">
                    <Clock className="w-4 h-4 mr-2 animate-spin" /> กำลังลบ...
                  </span>
                ) : (
                  'ยืนยันลบ'
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
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 p-2"
            >
              <X className="w-8 h-8" />
            </button>
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
