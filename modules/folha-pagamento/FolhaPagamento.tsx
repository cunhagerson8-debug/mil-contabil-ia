import React, { useState } from "react";
import { Users, DollarSign, Search, X, UserPlus, Building2 } from "lucide-react";

interface Employee {
  id: number;
  name: string;
  position: string;
  salary: number;
  status: "Pago" | "Pendente";
  admissionDate: string;
  department: string;
}

const mockEmployees: Employee[] = [
  { id: 1, name: "Ana Carolina Silva", position: "Contadora Sênior", salary: 8500, status: "Pago", admissionDate: "2021-03-15", department: "Contabilidade" },
  { id: 2, name: "Carlos Eduardo Santos", position: "Analista Fiscal", salary: 5200, status: "Pago", admissionDate: "2022-06-01", department: "Fiscal" },
  { id: 3, name: "Mariana Oliveira", position: "Assistente Contábil", salary: 3800, status: "Pendente", admissionDate: "2023-01-10", department: "Contabilidade" },
  { id: 4, name: "Pedro Henrique Lima", position: "Analista de DP", salary: 4500, status: "Pago", admissionDate: "2022-09-20", department: "RH" },
  { id: 5, name: "Juliana Ferreira", position: "Gerente Financeiro", salary: 12000, status: "Pendente", admissionDate: "2020-11-05", department: "Financeiro" },
  { id: 6, name: "Rafael Costa", position: "Estagiário Fiscal", salary: 1800, status: "Pago", admissionDate: "2024-02-01", department: "Fiscal" },
];

function calcINSS(salario: number): number {
  if (salario <= 1412.00) return salario * 0.075;
  if (salario <= 2666.68) return 1412.00 * 0.075 + (salario - 1412.00) * 0.09;
  if (salario <= 4000.03) return 1412.00 * 0.075 + (2666.68 - 1412.00) * 0.09 + (salario - 2666.68) * 0.12;
  if (salario <= 7786.02) return 1412.00 * 0.075 + (2666.68 - 1412.00) * 0.09 + (4000.03 - 2666.68) * 0.12 + (salario - 4000.03) * 0.14;
  return 1412.00 * 0.075 + (2666.68 - 1412.00) * 0.09 + (4000.03 - 2666.68) * 0.12 + (7786.02 - 4000.03) * 0.14;
}

export default function FolhaPagamento() {
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const filtered = mockEmployees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.position.toLowerCase().includes(search.toLowerCase())
  );

  const totalSalarios = mockEmployees.reduce((s, e) => s + e.salary, 0);
  const totalINSS = mockEmployees.reduce((s, e) => s + calcINSS(e.salary), 0);
  const totalFGTS = totalSalarios * 0.08;
  const totalEncargos = totalINSS + totalFGTS;

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Folha de Pagamento</h1>
          <p className="text-slate-500 text-sm">Gestão de colaboradores e encargos trabalhistas.</p>
          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-widest mt-1 inline-block">
            Em migração para MIL RH IA
          </span>
        </div>
        <button className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2">
          <UserPlus size={16} /> Novo Colaborador
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-50 rounded-xl"><Users size={18} className="text-blue-600" /></div>
            <p className="text-xs font-semibold text-slate-500">Colaboradores</p>
          </div>
          <p className="text-2xl font-black text-slate-800">{mockEmployees.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-50 rounded-xl"><DollarSign size={18} className="text-emerald-600" /></div>
            <p className="text-xs font-semibold text-slate-500">Total Salários</p>
          </div>
          <p className="text-2xl font-black text-emerald-700">R$ {totalSalarios.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-50 rounded-xl"><Building2 size={18} className="text-amber-600" /></div>
            <p className="text-xs font-semibold text-slate-500">Encargos Estimados</p>
          </div>
          <p className="text-2xl font-black text-amber-700">R$ {totalEncargos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-violet-50 rounded-xl"><DollarSign size={18} className="text-violet-600" /></div>
            <p className="text-xs font-semibold text-slate-500">Custo Total</p>
          </div>
          <p className="text-2xl font-black text-violet-700">R$ {(totalSalarios + totalEncargos).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar colaborador..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Employee table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Colaborador</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Cargo</th>
                <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 uppercase">Salário</th>
                <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 uppercase">INSS</th>
                <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 uppercase">FGTS</th>
                <th className="text-center px-5 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((emp) => {
                const inss = calcINSS(emp.salary);
                const fgts = emp.salary * 0.08;
                return (
                  <tr key={emp.id} onClick={() => setSelectedEmployee(emp)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 font-bold text-xs">
                          {emp.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                        </div>
                        <span className="font-semibold text-slate-700">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{emp.position}</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-800">R$ {emp.salary.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-3 text-right text-slate-500">R$ {inss.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right text-slate-500">R$ {fgts.toFixed(2)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                        emp.status === "Pago" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}>{emp.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee detail modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedEmployee(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-800">Detalhes do Colaborador</h3>
              <button onClick={() => setSelectedEmployee(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-sm text-slate-500">Nome</span><span className="text-sm font-bold">{selectedEmployee.name}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate-500">Cargo</span><span className="text-sm font-bold">{selectedEmployee.position}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate-500">Departamento</span><span className="text-sm font-bold">{selectedEmployee.department}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate-500">Admissão</span><span className="text-sm font-bold">{new Date(selectedEmployee.admissionDate).toLocaleDateString("pt-BR")}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate-500">Salário Bruto</span><span className="text-sm font-bold">R$ {selectedEmployee.salary.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate-500">INSS</span><span className="text-sm font-bold text-red-600">- R$ {calcINSS(selectedEmployee.salary).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate-500">FGTS (empresa)</span><span className="text-sm font-bold text-amber-600">R$ {(selectedEmployee.salary * 0.08).toFixed(2)}</span></div>
              <hr className="border-slate-100" />
              <div className="flex justify-between"><span className="text-sm font-bold text-slate-700">Custo Total Empresa</span><span className="text-sm font-black text-blue-700">R$ {(selectedEmployee.salary + selectedEmployee.salary * 0.08).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
