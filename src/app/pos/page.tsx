'use client';

import { getMenuItems, submitOrder, getRegisteredIngredients } from '@/app/actions';
import { useEffect, useState } from 'react';
import { ShoppingCart, Plus, Minus, X, Loader2 } from 'lucide-react';
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
  cost?: number; // Calculated cost
}

interface RegisteredIngredient {
  name: string;
  quantity: number;
  price: number;
  unit: string;
}

export default function POSPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<{ name: string, price: number, quantity: number }[]>([]);
  const [message, setMessage] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false); // For mobile cart toggle
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [currentPos, setCurrentPos] = useState('POS1'); // Default POS1

  // New state for Quantity Input Modal
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [quantityInput, setQuantityInput] = useState<number>(1);

  useEffect(() => {
    const initData = async () => {
      setIsInitialLoading(true);
      const [menus, registry] = await Promise.all([
        getMenuItems(),
        getRegisteredIngredients()
      ]);

      // Create a map for quick cost lookup: name -> costPerGram
      const costMap = (registry as unknown as RegisteredIngredient[]).reduce((acc: Record<string, number>, item: RegisteredIngredient) => {
        // We take the latest price (registry is sorted by date desc)
        if (!acc[item.name]) {
          acc[item.name] = item.price / item.quantity;
        }
        return acc;
      }, {});

      // Enrich menu items with calculated cost
      const enrichedMenus = (menus as MenuItem[]).map(menu => {
        const cost = (menu.ingredients || []).reduce((sum: number, ing: Ingredient) => {
          const pricePerUnit = costMap[ing.name] || 0;
          return sum + (pricePerUnit * ing.qty);
        }, 0);
        return { ...menu, cost };
      });

      setMenuItems(enrichedMenus);
      setIsInitialLoading(false);
    };
    initData();
  }, []);

  const handleItemClick = (item: MenuItem) => {
    setSelectedItem(item);
    setQuantityInput(1);
  };

  const confirmAddToCart = () => {
    if (!selectedItem || quantityInput < 1) return;

    const existing = cart.find(c => c.name === selectedItem.name);
    if (existing) {
      setCart(cart.map(c => c.name === selectedItem.name ? { ...c, quantity: c.quantity + quantityInput } : c));
    } else {
      setCart([...cart, { name: selectedItem.name, price: selectedItem.price, quantity: quantityInput }]);
    }

    setSelectedItem(null);
    setQuantityInput(1);
    setMessage('');
  };

  const removeFromCart = (itemName: string) => {
    setCart(cart.filter(c => c.name !== itemName));
  };

  const updateQuantity = (itemName: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.name === itemName) {
        return { ...c, quantity: Math.max(1, c.quantity + delta) };
      }
      return c;
    }));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsLoading(true);
    try {
      const result = await submitOrder(cart, currentPos);
      setMessage(result.message);
      if (result.success) {
        setCart([]);
        setIsCartOpen(false);
      }
    } catch {
      setMessage('เกิดข้อผิดพลาด');
    } finally {
      setIsLoading(false);
    }
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden relative">
      {/* POS Navbar */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm z-20 shrink-0">
        <div className="font-bold text-xl text-gray-800">POS System</div>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          {['POS1', 'POS2', 'POS3'].map((pos) => (
            <button
              key={pos}
              onClick={() => setCurrentPos(pos)}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                currentPos === pos
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden pb-16 md:pb-0 relative">
        {/* Loading Overlay */}
        {isInitialLoading && (
          <div className="fixed inset-0 bg-white/50 z-100 flex items-center justify-center backdrop-blur-sm">
            <Loading />
          </div>
        )}
        {/* Menu Section */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
             <h1 className="text-2xl font-bold text-gray-800">เลือกเมนู ({currentPos})</h1>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {menuItems.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                onClick={() => handleItemClick(item)}
                className="bg-white p-3 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow flex flex-col justify-between h-32"
              >
              <h3 className="font-bold text-gray-800 line-clamp-1">{item.name}</h3>
              <div className="mt-1">
                {item.cost !== undefined && item.cost > 0 && (
                  <div className="flex flex-col text-[10px]">
                    <span className="text-gray-500 font-medium">ต้นทุน: ฿{item.cost.toFixed(2)}</span>
                    <span className={`${(item.price - item.cost) > 0 ? 'text-green-600' : 'text-red-600'} font-bold`}>
                      กำไร: ฿{(item.price - item.cost).toFixed(2)} ({(((item.price - item.cost) / item.price) * 100).toFixed(0)}%)
                    </span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-end mt-2">
                <p className="text-blue-600 font-bold text-lg">฿{item.price}</p>
                <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-sm hover:bg-blue-700 transition-colors">
                  <Plus className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quantity Input Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{selectedItem.name}</h3>
              <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center gap-6">
              <div className="text-center">
                <p className="text-gray-500 mb-2">ระบุจำนวนที่ต้องการ</p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQuantityInput(Math.max(1, quantityInput - 1))}
                    className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 active:scale-95 transition-all"
                  >
                    <Minus className="w-6 h-6 text-gray-700" />
                  </button>

                  <input
                    type="number"
                    min="1"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(Math.max(1, parseInt(e.target.value) || 0))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmAddToCart();
                    }}
                    autoFocus
                    className="w-24 text-center text-3xl font-bold border-b-2 border-blue-500 focus:outline-none py-2"
                  />

                  <button
                    onClick={() => setQuantityInput(quantityInput + 1)}
                    className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 active:scale-95 transition-all"
                  >
                    <Plus className="w-6 h-6 text-gray-700" />
                  </button>
                </div>
              </div>

              <div className="w-full flex gap-3">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 py-3 text-gray-600 font-bold bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmAddToCart}
                  className="flex-2 w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
                >
                  ยืนยัน ({quantityInput})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Cart Toggle Button */}
      {cart.length > 0 && (
        <button
          onClick={() => setIsCartOpen(!isCartOpen)}
          className="md:hidden fixed bottom-20 right-4 bg-blue-600 text-white p-4 rounded-full shadow-lg z-40 flex items-center gap-2"
        >
          <ShoppingCart className="w-6 h-6" />
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full absolute -top-1 -right-1">
            {totalItems}
          </span>
        </button>
      )}

      {/* Cart Section (Sidebar on Desktop, Bottom Sheet/Modal on Mobile) */}
      <div className={`
        fixed inset-0 z-50 bg-black bg-opacity-50 md:static md:bg-transparent md:z-auto md:w-96
        transition-opacity duration-300
        ${isCartOpen ? 'opacity-100 visible' : 'opacity-0 invisible md:opacity-100 md:visible'}
      `}>
        <div className={`
          absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl h-[80vh] md:h-full md:static md:rounded-none md:shadow-none flex flex-col
          transform transition-transform duration-300
          ${isCartOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
        `}>
          <div className="p-4 border-b flex justify-between items-center bg-gray-50 md:bg-white">
            <h2 className="text-xl font-bold text-gray-800">รายการที่เลือก</h2>
            <button onClick={() => setIsCartOpen(false)} className="md:hidden p-2 text-gray-500">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <ShoppingCart className="w-12 h-12 mb-2 opacity-20" />
                <p>ยังไม่มีรายการ</p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div key={`${item.name}-${index}`} className="flex justify-between items-center mb-4 border-b pb-2 last:border-0">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{item.name}</h4>
                    <p className="text-sm text-gray-500">฿{item.price} x {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => updateQuantity(item.name, -1)} className="p-1 bg-gray-100 rounded-full hover:bg-gray-200">
                      <Minus className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="font-medium w-4 text-center text-gray-600">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.name, 1)} className="p-1 bg-gray-100 rounded-full hover:bg-gray-200">
                      <Plus className="w-4 h-4 text-gray-600" />
                    </button>
                    <button onClick={() => removeFromCart(item.name)} className="ml-2 text-red-500 hover:text-red-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t bg-gray-50 md:bg-white">
            <div className="flex justify-between text-xl font-bold mb-4 text-gray-800">
              <span>รวมทั้งหมด</span>
              <span className="text-blue-600">฿{total.toFixed(2)}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || isLoading}
              className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-md flex justify-center items-center gap-2"
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
              {isLoading ? 'กำลังบันทึก...' : 'ชำระเงิน'}
            </button>
            {message && (
              <p className={`text-center mt-2 text-sm ${message.includes('สำเร็จ') ? 'text-green-600' : 'text-red-600'}`}>
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
