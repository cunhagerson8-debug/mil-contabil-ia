import React, { useState } from "react";
import { Receipt, TrendingUp, AlertTriangle, CheckCircle, Filter } from "lucide-react";

interface TaxBill {
  id: string;
  name: string;
  type: "DAS" | "IRPJ" | "CSLL" | "PIS" | "COFINS" | "ISS" | "ICMS";
  value: number;
  dueDate: string;
  status: "Pago" | "Pendente" | "Vencido";
  referenceMonth: string;
}

const mockBills: TaxBill[] = [
  { id: "1", name: "DAS - Simples Nacional", type: "DAS", value: 1847.32, dueDate: "2024-07-20", status: "Pendente", referenceMonth: "Jun/2024" },
  { id: "2", name: "ISS - Serviços", type: "ISS", value: 520.00, dueDate: "2024-07-15", status: "Pago", referenceMonth: "Jun/2024" },
  { id: "3", name: "PIS/COFINS", type: "PIS", value: 1230.45, dueDate: "2024-06-25", status: "Vencido", referenceMonth: "Mai/2024" },
  { id: "4", name: "IRPJ Trimestral", type: "IRPJ", value: 4500.00, dueDate: "2024-07-31", status: "Pendente", referenceMonth: "2T/2024" },
  { id: "5", name: "CSLL Trimestral", type: "CSLL", value: 2700.00, dueDate: "2024-07-31", status: "Pendente", referenceMonth: "2T/2024" },
  { id: "6", name: "DAS - Simples Nacional", type: "DAS", value: 1720.18, dueDate: "2024-06-20", status: "Pago", referenceMonth: "Mai/2024" },
  { id: "7", name: "ICMS Diferencial", type: "ICMS", value: 890.00, dueDate: "2024-06-15", status: "Pago", referenceMonth: "Mai/2024" },
  { id: "8", name: "COFINS", type: "COFINS", value: 1100.00, dueDate: "2024-05-25", status: "Pago", referenceMonth: "Abr/2024" },
];

const revenueData = [
  { month: "Jan", faturamento: 42000, impostos: 3200 },
  { month: "Fev", faturamento: 38500, impostos: 2900 },
  { month: "Mar", faturamento: 45200, impostos: 3500 },
  { month: "Abr", faturamento: 41800, impostos: 3100 },
  { month: "Mai", faturamento: 48000, impostos: 3800 },
  { month: "Jun", faturamento: 52000, impostos: 4200 },
];

export default function Fiscal() {
  const [filter, setFilter] = useState<"Todos" | "Pago" | "Pendente" | "Vencido">("Todos");

  const totalPagar = mockBills.filter(b => b.status === "Pendente").reduce((s, b) => s + b.value, 0);
  const totalPago = mockBills.filter(b => b.status === "Pago").reduce((s, b) => s + b.value, 0);
  const totalVencido = mockBills.filter(b => b.status === "Vencido").reduce((s, b) => s + b.value, 0);
  const faturamentoTotal = revenueData.reduce((s, r) => s + r.faturamento, 0);

  const filteredBills = filter === "Todos" ? mockBills : mockBills.filter(b => b.status === filter);
  const maxFaturamento = Math.max(...revenueData.map(r => r.faturamento));

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">Fiscal e Contábil</h1>
      <p className="text-slate-500 text-sm mb-6">Gestão de impostos, guias e obrigações fiscais.</p>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-50 rounded-xl"><Receipt size={18} className="text-amber-600" /></div>
            <p className="text-xs font-semibold text-slate-500">A Pagar</p>
          </div>
          <p className="text-2xl font-black text-slate-800">R$ {totalPagar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-50 rounded-xl"><CheckCircle size={18} className="text-emerald-600" /></div>
            <p className="text-xs font-semibold text-slate-500">Pago no Período</p>
          </div>
          <p className="text-2xl font-black text-emerald-700">R$ {totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-50 rounded-xl"><AlertTriangle size={18} className="text-red-600" /></div>
            <p className="text-xs font-semibold text-slate-500">Vencido</p>
          </div>
          <p className="text-2xl font-black text-red-700">R$ {totalVencido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-50 rounded-xl"><TrendingUp size={18} className="text-blue-600" /></div>
            <p className="text-xs font-semibold text-slate-500">Faturamento Acumulado</p>
          </div>
          <p className="text-2xl font-black text-blue-700">R$ {faturamentoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Revenue chart (simple bar) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-8">
        <h3 className="font-bold text-slate-700 mb-4">Faturamento vs Impostos (últimos 6 meses)</h3>
        <div className="flex items-end gap-3 h-40">
          {revenueData.map((r) => (
            <div key={r.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col items-center gap-0.5" style={{ height: "120px" }}>
                <div
                  className="w-full bg-blue-100 rounded-t-lg relative"
                  style={{ height: `${(r.faturamento / maxFaturamento) * 100}%` }}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-red-300 rounded-t-lg"
                    style={{ height: `${(r.impostos / r.faturamento) * 100}%` }}
                  />
                </div>
              </div>
              <p className="text-[10px] font-bold text-slate-500">{r.month}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-100 rounded" /><span className="text-[10px] text-slate-500">Faturamento</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-300 rounded" /><span className="text-[10px] text-slate-500">Impostos</span></div>
        </div>
      </div>

      {/* Tax bills table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-bold text-slate-700">Guias e Impostos</h3>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Todos">Todos</option>
              <option value="Pendente">Pendente</option>
              <option value="Pago">Pago</option>
              <option value="Vencido">Vencido</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Guia</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Tipo</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Referência</th>
                <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 uppercase">Valor</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Vencimento</th>
                <th className="text-center px-5 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredBills.map((bill) => (
                <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-semibold text-slate-700">{bill.name}</td>
                  <td className="px-5 py-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-mono">{bill.type}</span></td>
                  <td className="px-5 py-3 text-slate-500">{bill.referenceMonth}</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-800">R$ {bill.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="px-5 py-3 text-slate-500">{new Date(bill.dueDate).toLocaleDateString("pt-BR")}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                      bill.status === "Pago" ? "bg-emerald-50 text-emerald-700" :
                      bill.status === "Pendente" ? "bg-amber-50 text-amber-700" :
                      "bg-red-50 text-red-700"
                    }`}>{bill.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
