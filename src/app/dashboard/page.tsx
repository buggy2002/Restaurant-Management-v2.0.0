"use client";

import { getDashboardStats } from "@/app/actions";
import { useEffect, useState } from "react";
import Loading from "@/components/Loading";
import {
  LayoutDashboard,
  Calendar,
  Package,
  ArrowUpRight,
  ChefHat,
} from "lucide-react";

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  date: string;
  items: OrderItem[];
  totalPrice: number;
  totalCost: number;
}

interface ItemSaleData {
  quantity: number;
  sales: number;
}

interface DashboardStats {
  totalSales: number;
  totalCost: number;
  grossProfit: number;
  totalStockExpenditure: number;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  itemSales: Record<string, ItemSaleData>;
  orders: Order[];
}

type PosFilterType = "all" | "POS1" | "POS2" | "POS3";
type ViewType = "sales" | "topItems";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalCost: 0,
    grossProfit: 0,
    totalStockExpenditure: 0,
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    itemSales: {},
    orders: [],
  });

  // Income/Expense filter states (separate)
  const [incomeStartDate, setIncomeStartDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [incomeEndDate, setIncomeEndDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [isIncomeLoading, setIsIncomeLoading] = useState(true);

  // Cost filter states (separate)
  const [costStartDate, setCostStartDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [costEndDate, setCostEndDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [costPosFilter, setCostPosFilter] = useState<PosFilterType>("all");
  const [isCostLoading, setIsCostLoading] = useState(true);

  const [viewType, setViewType] = useState<ViewType>("sales");

  // Fetch stats when cost filters change
  useEffect(() => {
    let mounted = true;

    getDashboardStats(
      "custom",
      "",
      costStartDate,
      costEndDate,
      costPosFilter
    ).then((data) => {
      if (mounted) {
        setStats(data as unknown as DashboardStats);
        setIsCostLoading(false);
        setIsIncomeLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [
    costStartDate,
    costEndDate,
    costPosFilter,
    incomeStartDate,
    incomeEndDate,
  ]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-8 relative">
      <div className="max-w-7xl mx-auto p-3 md:p-4 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-2 md:space-x-3 mb-4 md:mb-6">
          <div className="p-2 md:p-3 bg-slate-700 rounded-lg md:rounded-xl shadow-sm">
            <LayoutDashboard className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">
              รายงานรวม
            </h1>
            <p className="text-gray-500 text-xs md:text-sm">
              สรุปผลการดำเนินงานของร้าน
            </p>
          </div>
        </div>

        {/* Income/Expense Section */}
        <div className="bg-linear-to-br from-white to-indigo-50/50 p-4 md:p-6 rounded-2xl shadow-lg border border-indigo-100 relative overflow-hidden">
          {/* Decorative element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100/50 rounded-full -translate-y-1/2 translate-x-1/2" />

          <div className="relative">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-linear-to-br from-indigo-500 to-purple-600 rounded-xl shadow-md">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl md:text-2xl font-bold bg-linear-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
                รายรับ - รายจ่าย
              </h1>
            </div>

            {/* Date Filter */}
            <div className="flex flex-wrap items-center gap-3 mb-5 p-3 bg-white/80 backdrop-blur-sm rounded-xl border border-indigo-100 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-indigo-600 text-sm font-semibold">
                  📅 วันที่
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={incomeStartDate}
                  onChange={(e) => {
                    setIsIncomeLoading(true);
                    setIncomeStartDate(e.target.value);
                  }}
                  className="bg-white border-2 border-indigo-200 rounded-lg px-3 py-2 text-gray-700 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all hover:border-indigo-300"
                />
                <span className="text-indigo-400 font-medium px-2">ถึง</span>
                <input
                  type="date"
                  value={incomeEndDate}
                  onChange={(e) => {
                    setIsIncomeLoading(true);
                    setIncomeEndDate(e.target.value);
                  }}
                  className="bg-white border-2 border-indigo-200 rounded-lg px-3 py-2 text-gray-700 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all hover:border-indigo-300"
                />
              </div>
            </div>

            {/* Loading Overlay */}
            {isIncomeLoading && (
              <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm rounded-2xl">
                <Loading />
              </div>
            )}

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Other Income */}
              <div className="group bg-linear-to-br from-emerald-50 to-teal-50 p-5 rounded-xl shadow-sm border border-emerald-200 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-default">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">📈</span>
                  <p className="text-sm font-semibold text-emerald-700">
                    รายรับอื่น ๆ
                  </p>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-emerald-700">
                  ฿
                  {stats.totalIncome.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </h3>
              </div>

              {/* Other Expense */}
              <div className="group bg-linear-to-br from-rose-50 to-red-50 p-5 rounded-xl shadow-sm border border-rose-200 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-default">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">📉</span>
                  <p className="text-sm font-semibold text-rose-700">
                    รายจ่ายอื่น ๆ
                  </p>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-rose-700">
                  ฿
                  {stats.totalExpense.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </h3>
              </div>

              {/* Net Result */}
              <div
                className={`group p-5 rounded-xl shadow-sm border hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-default ${
                  stats.totalIncome - stats.totalExpense >= 0
                    ? "bg-linear-to-br from-indigo-500 to-purple-600 border-indigo-400"
                    : "bg-linear-to-br from-red-500 to-rose-600 border-red-400"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">⚖️</span>
                  <p className="text-sm font-semibold text-white/90">
                    ผลต่างรายรับ-จ่าย
                  </p>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-white">
                  {stats.totalIncome - stats.totalExpense >= 0 ? "+" : "-"}฿
                  {Math.abs(
                    stats.totalIncome - stats.totalExpense
                  ).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </h3>
              </div>
            </div>
          </div>
        </div>

        {/* Sales Report Section */}
        <div className="bg-linear-to-br from-slate-100 to-gray-200 p-4 md:p-6 rounded-2xl shadow-lg border border-gray-300 relative overflow-hidden">
          {/* Decorative element */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-slate-300/30 rounded-full -translate-y-1/2 translate-x-1/2" />

          <div className="relative">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-linear-to-br from-slate-600 to-slate-800 rounded-xl shadow-md">
                <Package className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                รายงานการขาย
              </h1>
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap items-center gap-4 mb-5 p-3 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm">
              {/* POS Filter */}
              <div className="flex items-center gap-2">
                <span className="text-slate-700 text-sm font-bold bg-slate-200 px-3 py-1 rounded-lg">
                  POS
                </span>
                <select
                  value={costPosFilter}
                  onChange={(e) => {
                    setIsCostLoading(true);
                    setCostPosFilter(e.target.value as PosFilterType);
                  }}
                  className="bg-white border-2 border-slate-200 rounded-lg px-3 py-2 text-gray-700 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 outline-none cursor-pointer transition-all hover:border-slate-300 font-medium"
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="POS1">POS 1</option>
                  <option value="POS2">POS 2</option>
                  <option value="POS3">POS 3</option>
                </select>
              </div>

              <div className="h-6 w-px bg-gray-300 hidden md:block" />

              {/* Date Range Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-600 text-sm font-semibold">
                  📅 วันที่
                </span>
                <input
                  type="date"
                  value={costStartDate}
                  onChange={(e) => {
                    setIsCostLoading(true);
                    setCostStartDate(e.target.value);
                  }}
                  className="bg-white border-2 border-slate-200 rounded-lg px-3 py-2 text-gray-700 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 outline-none transition-all hover:border-slate-300"
                />
                <span className="text-slate-400 font-medium px-1">ถึง</span>
                <input
                  type="date"
                  value={costEndDate}
                  onChange={(e) => {
                    setIsCostLoading(true);
                    setCostEndDate(e.target.value);
                  }}
                  className="bg-white border-2 border-slate-200 rounded-lg px-3 py-2 text-gray-700 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 outline-none transition-all hover:border-slate-300"
                />
              </div>
            </div>

            {/* Loading Overlay for this component only */}
            {isCostLoading && (
              <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center backdrop-blur-sm rounded-xl">
                <Loading />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
              {/* Row 1: Primary Metrics - Emerald Gradient */}
              {/* Total Sales */}
              <div className="lg:col-span-2 bg-emerald-50 p-4 md:p-5 rounded-xl shadow-sm border border-emerald-200 hover:shadow-md transition-shadow">
                <p className="text-xs md:text-sm font-semibold text-emerald-700 mb-2 flex items-center">
                  💰 ยอดขายรวม{" "}
                  <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4 ml-1" />
                </p>
                <h3 className="text-xl md:text-2xl font-bold text-emerald-800">
                  ฿
                  {stats.totalSales.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </h3>
              </div>

              {/* COGS */}
              <div className="lg:col-span-2 bg-emerald-200 p-4 md:p-5 rounded-xl shadow-sm border border-emerald-300 hover:shadow-md transition-shadow">
                <p className="text-xs md:text-sm font-semibold text-emerald-800 mb-2 flex items-center">
                  🍳 ต้นทุนต่อจาน
                </p>
                <h3 className="text-xl md:text-2xl font-bold text-emerald-900">
                  ฿
                  {stats.totalCost.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </h3>
              </div>

              {/* Gross Profit */}
              <div className="lg:col-span-2 bg-emerald-600 p-4 md:p-5 rounded-xl shadow-sm border border-emerald-500 text-white hover:shadow-md transition-shadow">
                <p className="text-xs md:text-sm font-semibold text-emerald-50 mb-2 flex items-center">
                  ✨ กำไร
                </p>
                <h3 className="text-xl md:text-2xl font-bold text-white">
                  ฿
                  {stats.grossProfit.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </h3>
              </div>
            </div>
            <div className="flex gap-2 md:gap-3 mt-4">
              <button
                onClick={() => setViewType("sales")}
                className={`flex-1 py-2.5 md:py-3 px-2 md:px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-1 md:gap-2 text-sm md:text-base ${
                  viewType === "sales"
                    ? "bg-slate-700 text-white shadow-sm hover:bg-slate-800"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Package className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden sm:inline">ประวัติการขายล่าสุด</span>
                <span className="sm:hidden">ประวัติการขาย</span>
              </button>
              <button
                onClick={() => setViewType("topItems")}
                className={`flex-1 py-2.5 md:py-3 px-2 md:px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-1 md:gap-2 text-sm md:text-base ${
                  viewType === "topItems"
                    ? "bg-slate-700 text-white shadow-sm hover:bg-slate-800"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <ChefHat className="w-4 h-4 md:w-5 md:h-5" />
                เมนูทั้งหมด
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-4">
              {viewType === "sales" ? (
                <>
                  {/* Desktop: Sales History Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-700 font-semibold">
                        <tr>
                          <th className="px-4 py-3 text-left whitespace-nowrap">
                            วันที่
                          </th>
                          <th className="px-4 py-3 text-left">รายการอาหาร</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">
                            ยอดขาย
                          </th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">
                            ต้นทุนต่อจาน
                          </th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">
                            กำไร
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {stats.orders && stats.orders.length > 0 ? (
                          stats.orders.map((order, idx) => {
                            const profit = order.totalPrice - order.totalCost;
                            return (
                              <tr
                                key={idx}
                                className="hover:bg-gray-50 transition-colors"
                              >
                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                  <div className="font-medium text-gray-800">
                                    {new Date(order.date).toLocaleDateString(
                                      "th-TH",
                                      {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                      }
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(order.date).toLocaleTimeString(
                                      "th-TH",
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="space-y-1">
                                    {order.items.map((item, i) => (
                                      <div key={i} className="text-gray-700">
                                        {item.name}{" "}
                                        <span className="text-gray-500">
                                          x{item.quantity}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                  ฿
                                  {order.totalPrice.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="px-4 py-3 text-right text-red-600 font-medium">
                                  ฿
                                  {order.totalCost.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-green-600">
                                  ฿
                                  {profit.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              colSpan={5}
                              className="p-8 text-center text-gray-400"
                            >
                              ไม่มีข้อมูลการขาย
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile: Sales History Cards */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {stats.orders && stats.orders.length > 0 ? (
                      stats.orders.map((order, idx) => {
                        const profit = order.totalPrice - order.totalCost;
                        return (
                          <div
                            key={idx}
                            className="p-4 hover:bg-gray-50 transition-colors"
                          >
                            {/* Date & Time */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                  <Calendar className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-800 text-sm">
                                    {new Date(order.date).toLocaleDateString(
                                      "th-TH",
                                      {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                      }
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(order.date).toLocaleTimeString(
                                      "th-TH",
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Items */}
                            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                              <div className="text-xs text-gray-500 mb-1">
                                รายการอาหาร
                              </div>
                              <div className="space-y-1">
                                {order.items.map((item, i) => (
                                  <div
                                    key={i}
                                    className="text-sm text-gray-700 font-medium"
                                  >
                                    {item.name}{" "}
                                    <span className="text-gray-500">
                                      x{item.quantity}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Financial Summary */}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="text-center p-2 bg-blue-50 rounded-lg">
                                <div className="text-xs text-gray-600 mb-1">
                                  ยอดขาย
                                </div>
                                <div className="text-sm font-bold text-gray-900">
                                  ฿
                                  {order.totalPrice.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </div>
                              </div>
                              <div className="text-center p-2 bg-red-50 rounded-lg">
                                <div className="text-xs text-gray-600 mb-1">
                                  ต้นทุนต่อจาน
                                </div>
                                <div className="text-sm font-bold text-red-600">
                                  ฿
                                  {order.totalCost.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </div>
                              </div>
                              <div className="text-center p-2 bg-green-50 rounded-lg">
                                <div className="text-xs text-gray-600 mb-1">
                                  กำไร
                                </div>
                                <div className="text-sm font-bold text-green-600">
                                  ฿
                                  {profit.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-8 text-center text-gray-400">
                        ไม่มีข้อมูลการขาย
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Desktop: All Menu Items Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-700 font-semibold">
                        <tr>
                          <th className="px-4 py-3 text-left">อันดับ</th>
                          <th className="px-4 py-3 text-left">เมนู</th>
                          <th className="px-4 py-3 text-right">จำนวนที่ขาย</th>
                          <th className="px-4 py-3 text-right">ยอดขาย</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {Object.keys(stats.itemSales).length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="p-8 text-center text-gray-400"
                            >
                              ไม่มีข้อมูลการขาย
                            </td>
                          </tr>
                        ) : (
                          Object.entries(stats.itemSales)
                            .sort(([, a], [, b]) => b.sales - a.sales)
                            .map(([name, data], index) => (
                              <tr
                                key={name}
                                className="hover:bg-gray-50 transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <span
                                    className={`
                                inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
                                ${
                                  index === 0
                                    ? "bg-amber-400 text-amber-900 shadow-sm"
                                    : index === 1
                                    ? "bg-slate-300 text-slate-700 shadow-sm"
                                    : index === 2
                                    ? "bg-orange-300 text-orange-800 shadow-sm"
                                    : "bg-gray-100 text-gray-600"
                                }
                              `}
                                  >
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-medium text-gray-800">
                                  {name}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700">
                                  {data.quantity}{" "}
                                  <span className="text-gray-500 text-xs">
                                    ชิ้น
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-gray-900">
                                  ฿
                                  {data.sales.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile: All Menu Items Cards */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {Object.keys(stats.itemSales).length === 0 ? (
                      <div className="p-8 text-center text-gray-400">
                        ไม่มีข้อมูลการขาย
                      </div>
                    ) : (
                      Object.entries(stats.itemSales)
                        .sort(([, a], [, b]) => b.sales - a.sales)
                        .map(([name, data], index) => (
                          <div
                            key={name}
                            className="p-4 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                {/* Rank Badge */}
                                <span
                                  className={`
                              shrink-0 w-10 h-10 flex items-center justify-center rounded-full text-base font-bold shadow-sm
                              ${
                                index === 0
                                  ? "bg-amber-400 text-amber-900"
                                  : index === 1
                                  ? "bg-slate-300 text-slate-700"
                                  : index === 2
                                  ? "bg-orange-300 text-orange-800"
                                  : "bg-gray-100 text-gray-600"
                              }
                            `}
                                >
                                  {index + 1}
                                </span>

                                {/* Menu Info */}
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-800 mb-1">
                                    {name}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    ขายไปแล้ว{" "}
                                    <span className="font-medium text-gray-800">
                                      {data.quantity}
                                    </span>{" "}
                                    ชิ้น
                                  </div>
                                </div>
                              </div>

                              {/* Sales Amount */}
                              <div className="text-right">
                                <div className="text-lg font-bold text-gray-900">
                                  ฿
                                  {data.sales.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
