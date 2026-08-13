import React, { useState } from "react";
import { Newspaper, Clock, AlertTriangle, Tag, ExternalLink } from "lucide-react";

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  date: string;
  category: "Tributário" | "Trabalhista" | "Previdenciário" | "Geral";
  isUrgent: boolean;
  source: string;
}

const mockNews: NewsArticle[] = [
  { id: "1", title: "Receita Federal amplia prazo para adesão ao Simples Nacional 2024", summary: "Empresas que foram excluídas do regime em janeiro terão até 31 de março para regularizar pendências e solicitar nova adesão ao Simples Nacional.", date: "2024-07-15", category: "Tributário", isUrgent: true, source: "Receita Federal" },
  { id: "2", title: "eSocial: novas regras para eventos de SST entram em vigor", summary: "A partir de agosto, todas as empresas deverão enviar os eventos S-2210, S-2220 e S-2240 pelo eSocial, independentemente do porte.", date: "2024-07-12", category: "Trabalhista", isUrgent: true, source: "Portal eSocial" },
  { id: "3", title: "FGTS Digital: sistema unificado começa a operar em março", summary: "O novo sistema FGTS Digital substituirá o SEFIP/GFIP para recolhimento do FGTS, com integração direta ao eSocial.", date: "2024-07-10", category: "Previdenciário", isUrgent: false, source: "Caixa Econômica" },
  { id: "4", title: "Reforma Tributária: IBS e CBS substituirão PIS, COFINS, ICMS, ISS e IPI", summary: "A regulamentação da reforma tributária avança no Congresso com previsão de transição gradual entre 2026 e 2033.", date: "2024-07-08", category: "Tributário", isUrgent: false, source: "Congresso Nacional" },
  { id: "5", title: "Novo salário mínimo 2024: impactos na folha de pagamento", summary: "Com o reajuste para R$ 1.412,00, empresas devem atualizar tabelas de INSS, salário-família e demais benefícios vinculados.", date: "2024-07-05", category: "Trabalhista", isUrgent: false, source: "Governo Federal" },
  { id: "6", title: "EFD-Reinf: obrigatoriedade ampliada para retenções federais", summary: "A partir da competência setembro/2024, todas as retenções de IR, CSLL, PIS e COFINS deverão ser informadas via EFD-Reinf.", date: "2024-07-01", category: "Tributário", isUrgent: false, source: "Receita Federal" },
];

const categoryColors: Record<string, string> = {
  "Tributário": "bg-blue-50 text-blue-700 border-blue-200",
  "Trabalhista": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Previdenciário": "bg-violet-50 text-violet-700 border-violet-200",
  "Geral": "bg-slate-50 text-slate-700 border-slate-200",
};

export default function News({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");

  const categories = ["Todos", "Tributário", "Trabalhista", "Previdenciário", "Geral"];
  const filtered = selectedCategory === "Todos" ? mockNews : mockNews.filter(n => n.category === selectedCategory);

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">Notícias Contábeis</h1>
      <p className="text-slate-500 text-sm mb-6">Acompanhe as principais atualizações fiscais, tributárias e trabalhistas.</p>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              selectedCategory === cat
                ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                : "bg-white text-slate-600 border border-slate-200 hover:border-blue-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* News grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((article) => (
          <div key={article.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                {article.isUrgent && (
                  <div className="p-1 bg-red-50 rounded-lg">
                    <AlertTriangle size={14} className="text-red-500" />
                  </div>
                )}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${categoryColors[article.category]}`}>
                  {article.category}
                </span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <Clock size={12} />
                <span className="text-[10px]">{new Date(article.date).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>
            <h3 className="font-bold text-slate-800 mb-2 leading-tight">{article.title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-3">{article.summary}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Tag size={12} className="text-slate-300" />
                <span className="text-[10px] text-slate-400 font-semibold">{article.source}</span>
              </div>
              <button className="text-[10px] text-blue-600 font-bold flex items-center gap-1 hover:text-blue-800 transition-colors">
                Ler mais <ExternalLink size={10} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
