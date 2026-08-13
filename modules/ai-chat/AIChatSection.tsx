import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Loader2 } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SYSTEM_PROMPT = `Você é o Assistente MIL IA, um especialista em contabilidade brasileira, legislação tributária, fiscal e trabalhista. Você pertence à plataforma MIL Contábil IA, uma solução da MIL Gestão & Tecnologia.

Suas áreas de expertise:
- Simples Nacional, Lucro Presumido e Lucro Real
- Obrigações acessórias (SPED, EFD, ECF, DCTF, DIRF)
- Legislação trabalhista e previdenciária (CLT, eSocial, FGTS Digital)
- Planejamento tributário
- Abertura e encerramento de empresas
- Emissão de notas fiscais
- Folha de pagamento e encargos

Responda sempre em português brasileiro, de forma clara e objetiva. Quando possível, cite a base legal (lei, artigo, instrução normativa). Se não tiver certeza sobre algo, informe ao usuário.`;

const SUGGESTIONS = [
  "Qual o limite de faturamento do MEI em 2024?",
  "Como calcular o DAS do Simples Nacional?",
  "Quais são as obrigações do eSocial?",
  "Diferença entre Lucro Presumido e Lucro Real",
];

export default function AIChatSection() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: messageText, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const apiKey = (typeof process !== "undefined" && (process as any).env?.GEMINI_API_KEY) || "";
      if (!apiKey) {
        throw new Error("API_KEY_MISSING");
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      const history = messages.map((m) => ({
        role: m.role === "user" ? "user" as const : "model" as const,
        parts: [{ text: m.content }],
      }));

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
          { role: "model", parts: [{ text: "Entendido. Sou o Assistente MIL IA, pronto para ajudar com questões contábeis, fiscais e trabalhistas." }] },
          ...history,
          { role: "user", parts: [{ text: messageText }] },
        ],
      });

      const assistantText = response.text || "Desculpe, não consegui gerar uma resposta.";
      setMessages((prev) => [...prev, { role: "assistant", content: assistantText, timestamp: new Date() }]);
    } catch (err: any) {
      const errorMsg = err.message === "API_KEY_MISSING"
        ? "Chave da API Gemini não configurada. Configure GEMINI_API_KEY no arquivo .env"
        : "Erro ao conectar com a IA. Verifique sua conexão e tente novamente.";
      setError(errorMsg);
      setMessages((prev) => [...prev, { role: "assistant", content: errorMsg, timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col animate-in fade-in duration-500">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Sparkles size={22} className="text-blue-600" /> Assistente MIL IA
        </h1>
        <p className="text-slate-500 text-sm">Tire dúvidas contábeis, fiscais e trabalhistas com inteligência artificial.</p>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-[500px]">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                <Bot size={28} className="text-blue-500" />
              </div>
              <h3 className="font-bold text-slate-700 mb-2">Como posso ajudar?</h3>
              <p className="text-sm text-slate-400 mb-6 max-w-sm">
                Sou especialista em contabilidade brasileira, legislação tributária e trabalhista.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-blue-600" />
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-50 text-slate-700 border border-slate-100"
              }`}>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-blue-200" : "text-slate-300"}`}>
                  {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 bg-slate-200 rounded-xl flex items-center justify-center shrink-0">
                  <User size={16} className="text-slate-600" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <Bot size={16} className="text-blue-600" />
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                <Loader2 size={16} className="animate-spin text-blue-500" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-slate-100 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Digite sua dúvida contábil..."
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
              className="px-5 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
