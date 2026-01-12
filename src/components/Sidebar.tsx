'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, UtensilsCrossed, Store, LogOut, Wallet, DollarSign, ClipboardList } from 'lucide-react';
import { logout } from '@/app/actions';

const navItems = [
  { href: '/dashboard', label: 'รายงานรวม', icon: LayoutDashboard },
  { href: '/menu', label: 'เมนูอาหาร', icon: UtensilsCrossed },
  { href: '/ingredients-registry', label: 'ข้อมูลวัตถุดิบ', icon: ClipboardList },
  { href: '/expense', label: 'บันทึกรายจ่าย', icon: Wallet },
  { href: '/income', label: 'บันทึกรายรับ', icon: DollarSign },
  { href: '/pos', label: 'POS', icon: Store },
];

interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Sidebar({ isCollapsed, toggleSidebar }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Sidebar - Hidden on mobile, shown on desktop */}
      <aside
        className={`hidden md:flex flex-col bg-gray-900 text-white h-screen fixed left-0 top-0 z-40 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'
          }`}
      >
        <div className={`p-4 border-b border-gray-800 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && <h1 className="text-xl font-bold truncate">Restaurant App</h1>}
          <button
            onClick={toggleSidebar}
            className="p-1 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  } ${isCollapsed ? 'justify-center px-2' : ''}`}
                title={isCollapsed ? item.label : ''}
              >
                <Icon size={20} />
                {!isCollapsed && <span className="font-medium whitespace-nowrap">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <form action={logout}>
            <button
              type="submit"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-gray-800 w-full transition-colors ${isCollapsed ? 'justify-center px-2' : ''
                }`}
              title={isCollapsed ? 'Logout' : ''}
            >
              <LogOut size={20} />
              {!isCollapsed && <span className="font-medium whitespace-nowrap">Logout</span>}
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile Bottom Navigation - Only shown on mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive ? 'text-blue-600' : 'text-gray-500'
                  }`}
              >
                <Icon size={24} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
          <form action={logout} className="w-full h-full">
            <button
              type="submit"
              className="flex flex-col items-center justify-center w-full h-full space-y-1 text-red-500"
            >
              <LogOut size={24} />
              <span className="text-xs font-medium">Logout</span>
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
