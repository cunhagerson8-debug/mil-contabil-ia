import React, { useState } from "react";
import { Calculator, DollarSign, RefreshCw } from "lucide-react";

type CalcType = "simples" | "inss" | "irrf" | "prolabore";

interface CalcResult {
  label: string;
  value: number;
  description?: string;
}

export default function CalculadoraView() {
  const [activeCalc, setActiveCalc] = useState<CalcType>("simples");
  const [inputValue, setInputValue] = useState("");
  const [results, setResults] = useState<CalcResult[]>([]);

  const calculators = [
    { id: "simples" as CalcType, label: "Simples Nacional", desc: "DAS mensal" },
    { id: "inss" as CalcType, label: "INSS", desc: "Contribuição previdenciária" },
    { id: "irrf" as CalcType, label: "IRRF", desc: "Imposto de renda retido" },
    { id: "prolabore" as CalcType, label: "Pró-Labore", desc: "Encargos sobre retirada" },
  ];

  const calcSimples = (faturamento: number): CalcResult[] => {
    let aliquota = 0; let deducao = 0;
    if (faturamento <= 180000) { aliquota = 6; deducao = 0; }
    else if (faturamento <= 360000) { aliquota = 11.2; deducao = 9360; }
    else if (faturamento <= 720000) { aliquota = 13.5; deducao = 17640; }
    else if (faturamento <= 1800000) { aliquota = 16; deducao = 35640; }
    else if (faturamento <= 3600000) { aliquota = 21; deducao = 125640; }
    else { aliquota = 33; deducao = 648000; }
    const aliqEfetiva = ((faturamento * aliquota / 100) - deducao) / faturamento * 100;
    const dasMensal = (faturamento / 12) * (aliqEfetiva / 100);
    return [
      { label: "Alíquota Nominal", value: aliquota, description: "Faixa do Simples Nacional" },
      { label: "Alíquota Efetiva", value: parseFloat(aliqEfetiva.toFixed(2)), description: "Após dedução" },
      { label: "DAS Mensal Estimado", value: parseFloat(dasMensal.toFixed(2)), description: "Valor mensal aproximado" },
    ];
  };

  const calcINSS = (salario: number): CalcResult[] => {
    let inss = 0;
    if (salario <= 1412.00) { inss = salario * 0.075; }
    else if (salario <= 2666.68) { inss = 1412.00 * 0.075 + (salario - 1412.00) * 0.09; }
    else if (salario <= 4000.03) { inss = 1412.00 * 0.075 + (2666.68 - 1412.00) * 0.09 + (salario - 2666.68) * 0.12; }
    else if (salario <= 7786.02) { inss = 1412.00 * 0.075 + (2666.68 - 1412.00) * 0.09 + (4000.03 - 2666.68) * 0.12 + (salario - 4000.03) * 0.14; }
    else { inss = 1412.00 * 0.075 + (2666.68 - 1412.00) * 0.09 + (4000.03 - 2666.68) * 0.12 + (7786.02 - 4000.03) * 0.14; }
    const aliqEfetiva = (inss / salario) * 100;
    return [
      { label: "Desconto INSS", value: parseFloat(inss.toFixed(2)), description: "Cálculo progressivo 2024" },
      { label: "Alíquota Efetiva", value: parseFloat(aliqEfetiva.toFixed(2)), description: "Percentual real descontado" },
      { label: "Salário Líquido (INSS)", value: parseFloat((salario - inss).toFixed(2)), description: "Após desconto previdenciário" },
    ];
  };

  const calcIRRF = (salario: number): CalcResult[] => {
    const inssResults = calcINSS(salario);
    const baseCalculo = salario - inssResults[0].value;
    let irrf = 0; let aliq = 0;
    if (baseCalculo <= 2259.20) { irrf = 0; aliq = 0; }
    else if (baseCalculo <= 2826.65) { irrf = baseCalculo * 0.075 - 169.44; aliq = 7.5; }
    else if (baseCalculo <= 3751.05) { irrf = baseCalculo * 0.15 - 381.44; aliq = 15; }
    else if (baseCalculo <= 4664.68) { irrf = baseCalculo * 0.225 - 662.77; aliq = 22.5; }
    else { irrf = baseCalculo * 0.275 - 896.00; aliq = 27.5; }
    if (irrf < 0) irrf = 0;
    return [
      { label: "Base de Cálculo", value: parseFloat(baseCalculo.toFixed(2)), description: "Salário - INSS" },
      { label: "Alíquota IRRF", value: aliq, description: "Faixa de tributação" },
      { label: "IRRF Retido", value: parseFloat(irrf.toFixed(2)), description: "Valor retido na fonte" },
    ];
  };

  const calcProlabore = (valor: number): CalcResult[] => {
    const teto = 7786.02;
    const baseINSS = Math.min(valor, teto);
    const inssEmpresa = baseINSS * 0.20;
    const inssSocio = baseINSS * 0.11;
    const baseIR = valor - inssSocio;
    let irrf = 0;
    if (baseIR <= 2259.20) { irrf = 0; }
    else if (baseIR <= 2826.65) { irrf = baseIR * 0.075 - 169.44; }
    else if (baseIR <= 3751.05) { irrf = baseIR * 0.15 - 381.44; }
    else if (baseIR <= 4664.68) { irrf = baseIR * 0.225 - 662.77; }
    else { irrf = baseIR * 0.275 - 896.00; }
    if (irrf < 0) irrf = 0;
    return [
      { label: "INSS Empresa (20%)", value: parseFloat(inssEmpresa.toFixed(2)), description: "Patronal sobre pró-labore" },
      { label: "INSS Sócio (11%)", value: parseFloat(inssSocio.toFixed(2)), description: "Retenção do sócio" },
      { label: "IRRF Retido", value: parseFloat(irrf.toFixed(2)), description: "Imposto de renda na fonte" },
      { label: "Custo Total Empresa", value: parseFloat((valor + inssEmpresa).toFixed(2)), description: "Pró-labore + encargos patronais" },
      { label: "Líquido do Sócio", value: parseFloat((valor - inssSocio - irrf).toFixed(2)), description: "Valor recebido pelo sócio" },
    ];
  };

  const calculate = () => {
    const value = parseFloat(inputValue);
    if (isNaN(value) || value <= 0) return;
    switch (activeCalc) {
      case "simples": setResults(calcSimples(value)); break;
      case "inss": setResults(calcINSS(value)); break;
      case "irrf": setResults(calcIRRF(value)); break;
      case "prolabore": setResults(calcProlabore(value)); break;
    }
  };

  const getInputLabel = () => {
    switch (activeCalc) {
      case "simples": return "Faturamento Anual (R$)";
      case "inss": case "irrf": return "Salário Bruto (R$)";
      case "prolabore": return "Valor do Pró-Labore (R$)";
    }
  };

  const reset = () => { setInputValue(""); setResults([]); };

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">Calculadoras Contábeis</h1>
      <p className="text-slate-500 text-sm mb-6">Realize cálculos tributários e trabalhistas com precisão.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {calculators.map((calc) => (
          <button
            key={calc.id}
            onClick={() => { setActiveCalc(calc.id); reset(); }}
            className={`px-4 py-3 rounded-xl border transition-all text-left ${
              activeCalc === calc.id
                ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-200"
            }`}
          >
            <p className="font-bold text-sm">{calc.label}</p>
            <p className={`text-xs ${activeCalc === calc.id ? "text-blue-100" : "text-slate-400"}`}>{calc.desc}</p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700 mb-2">{getInputLabel()}</label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && calculate()}
              placeholder="Ex: 240000"
              className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <button onClick={calculate} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Calculator size={16} /> Calcular
          </button>
          <button onClick={reset} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>

        {results.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((r, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs text-slate-500 font-semibold mb-1">{r.label}</p>
                <p className="text-xl font-black text-slate-800">
                  {r.label.includes("Alíquota") || r.label.includes("Percentual")
                    ? `${r.value}%`
                    : `R$ ${r.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                </p>
                {r.description && <p className="text-[10px] text-slate-400 mt-1">{r.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
