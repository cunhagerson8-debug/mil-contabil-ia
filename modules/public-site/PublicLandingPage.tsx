import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  FileText,
  Handshake,
  LockKeyhole,
  Loader2,
  Menu,
  MessageCircle,
  Play,
  Send,
  Sparkles,
  Users,
  User,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { sendMilaMessage as requestMilaResponse } from "../../services/publicMilaApi";
import { submitPublicCommercialLead } from "../../services/publicCommercialLeadApi";
import MilaLeadCapture from "./MilaLeadCapture";

interface PublicLandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
}

interface MilaChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface DemoLeadForm {
  name: string;
  company: string;
  email: string;
  whatsapp: string;
  message: string;
  consent: boolean;
  website: string;
}

const initialDemoLeadForm: DemoLeadForm = {
  name: "",
  company: "",
  email: "",
  whatsapp: "",
  message: "",
  consent: false,
  website: "",
};

const MILA_OPTIONS = [
  "Conhecer os planos",
  "Contratar serviços contábeis",
  "Já sou cliente",
];

const navigation = [
  { label: "Funcionalidades", href: "#funcionalidades" },
  { label: "Vídeos", href: "#videos" },
  { label: "Parceiros", href: "#parceiros" },
  { label: "Novidades", href: "#novidades" },
  { label: "Contato", href: "#contato" },
];

const features = [
  {
    icon: Building2,
    title: "Escritórios e empresas",
    description: "Organize os cadastros e as informações das empresas atendidas.",
    status: "Gestão disponível",
  },
  {
    icon: Users,
    title: "Clientes e obrigações",
    description: "Gerencie clientes e acompanhe obrigações registradas na plataforma.",
    status: "Acompanhamento disponível",
  },
  {
    icon: BarChart3,
    title: "Indicadores operacionais",
    description: "Consulte visões construídas a partir dos dados cadastrados.",
    status: "Visões operacionais",
  },
  {
    icon: Sparkles,
    title: "MIL IA",
    description: "Assistente de apoio informacional, com revisão profissional das respostas.",
    status: "Disponível conforme configuração",
  },
  {
    icon: LockKeyhole,
    title: "Acessos e permissões",
    description: "Controles de acesso por perfil e empresa, conforme a configuração da plataforma.",
    status: "Controles da plataforma",
  },
  {
    icon: Users,
    title: "Gestão de equipes",
    description: "Cadastre e consulte colaboradores. Folha integrada e eventos oficiais estão em desenvolvimento.",
    status: "Gestão cadastral disponível",
  },
  {
    icon: WalletCards,
    title: "Gestão financeira",
    description: "Cobranças, pagamentos e histórico financeiro ainda não estão disponíveis.",
    status: "Em desenvolvimento",
    upcoming: true,
  },
  {
    icon: FileText,
    title: "Documentos e certificados",
    description: "Armazenamento, assinatura e renovação integrada ainda não estão disponíveis.",
    status: "Em desenvolvimento",
    upcoming: true,
  },
  {
    icon: Zap,
    title: "Integrações e automações oficiais",
    description: "Conexões com órgãos e automações contábeis oficiais ainda não estão disponíveis.",
    status: "Em desenvolvimento",
    upcoming: true,
  },
];

const videoCategories = [
  "Institucional",
  "Demonstrações da plataforma",
  "Tutoriais e novidades",
];

function buildDemoLeadDetails(company: string, message: string): string | undefined {
  const details = [
    company.trim() ? `Empresa: ${company.trim()}` : "",
    message.trim() ? `Mensagem: ${message.trim()}` : "",
  ].filter(Boolean).join("\n");
  return details || undefined;
}

function isValidBrazilianWhatsApp(value: string): boolean {
  if (!/^[+\d\s().-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  const nationalNumber = digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
    ? digits.slice(2)
    : digits;
  return nationalNumber.length === 10 || nationalNumber.length === 11;
}

function formatMilaInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+?\*\*|__[^_\n]+?__)/g).map((part, index) => {
    const isBold = (part.startsWith("**") && part.endsWith("**"))
      || (part.startsWith("__") && part.endsWith("__"));
    return isBold
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part;
  });
}

function MilaFormattedMessage({ content }: { content: string }) {
  const blocks: Array<{ type: "paragraph"; lines: string[] } | { type: "ul" | "ol"; items: string[] }> = [];
  let paragraphLines: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraphLines.length) {
      blocks.push({ type: "paragraph", lines: paragraphLines });
      paragraphLines = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) {
      flushList();
      flushParagraph();
      continue;
    }

    const unorderedItem = /^\s*[-*+]\s+(.+)$/.exec(line);
    const orderedItem = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    const item = unorderedItem ?? orderedItem;

    if (item) {
      flushParagraph();
      const type = unorderedItem ? "ul" : "ol";
      if (list?.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push(item[1]);
    } else {
      flushList();
      paragraphLines.push(line);
    }
  }

  flushList();
  flushParagraph();

  return (
    <div className="space-y-3 break-words">
      {blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return (
            <p key={index} className="whitespace-pre-wrap">
              {block.lines.map((line, lineIndex) => (
                <span key={lineIndex}>
                  {lineIndex > 0 && <br />}
                  {formatMilaInline(line)}
                </span>
              ))}
            </p>
          );
        }

        const ListTag = block.type;
        return (
          <ListTag key={index} className={`space-y-1 pl-5 ${block.type === "ul" ? "list-disc" : "list-decimal"}`}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{formatMilaInline(item)}</li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}

export default function PublicLandingPage({
  onLogin,
  onRegister,
}: PublicLandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [milaOpen, setMilaOpen] = useState(false);
  const [milaMessages, setMilaMessages] = useState<MilaChatMessage[]>([]);
  const [milaInput, setMilaInput] = useState("");
  const [milaLoading, setMilaLoading] = useState(false);
  const [milaError, setMilaError] = useState<string | null>(null);
  const [milaLeadCaptureOpen, setMilaLeadCaptureOpen] = useState(false);
  const milaChatMessagesRef = useRef<HTMLDivElement>(null);
  const demoSubmitInProgressRef = useRef(false);
  const demoWhatsAppInputRef = useRef<HTMLInputElement>(null);
  const [demoLeadForm, setDemoLeadForm] = useState(initialDemoLeadForm);
  const [demoLeadSubmitting, setDemoLeadSubmitting] = useState(false);
  const [demoLeadSubmitted, setDemoLeadSubmitted] = useState(false);
  const [demoLeadError, setDemoLeadError] = useState<string | null>(null);
  const demoLeadDetails = buildDemoLeadDetails(demoLeadForm.company, demoLeadForm.message);
  const demoLeadDetailsLength = demoLeadDetails?.length ?? 0;

  function updateDemoLeadForm<K extends keyof DemoLeadForm>(
    key: K,
    value: DemoLeadForm[K],
  ) {
    setDemoLeadForm((current) => ({ ...current, [key]: value }));
    setDemoLeadError(null);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  useEffect(() => {
    if (milaOpen && milaChatMessagesRef.current) {
      milaChatMessagesRef.current.scrollTo({
        top: milaChatMessagesRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [milaMessages, milaLoading, milaOpen, milaLeadCaptureOpen]);

  async function sendMilaMessage(text: string) {
    const message = text.trim();
    if (!message || milaLoading) return;

    setMilaInput("");
    setMilaError(null);
    setMilaLoading(true);
    setMilaMessages((current) => [...current, { role: "user", content: message }]);

    try {
      const history = milaMessages.slice(-10).map(({ role, content }) => ({ role, content }));
      const { response } = await requestMilaResponse({ message, history });
      setMilaMessages((current) => [...current, { role: "assistant", content: response }]);
    } catch (error) {
      setMilaError(
        error instanceof Error
          ? error.message
          : "Não foi possível conectar com a Mila agora. Tente novamente mais tarde.",
      );
    } finally {
      setMilaLoading(false);
    }
  }

  function handleMilaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMilaMessage(milaInput);
  }

  async function handleDemoLeadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demoSubmitInProgressRef.current) return;

    if (demoLeadForm.name.trim().length < 2) {
      setDemoLeadError("Informe seu nome (pelo menos 2 caracteres).");
      return;
    }
    if (!isValidBrazilianWhatsApp(demoLeadForm.whatsapp)) {
      setDemoLeadError("Informe um WhatsApp brasileiro válido com DDD.");
      demoWhatsAppInputRef.current?.focus();
      return;
    }
    if (demoLeadDetailsLength > 500) {
      setDemoLeadError("Empresa e mensagem juntas devem ter no máximo 500 caracteres.");
      return;
    }
    if (!demoLeadForm.consent) {
      setDemoLeadError("É necessário autorizar o armazenamento dos dados e o contato.");
      return;
    }

    demoSubmitInProgressRef.current = true;
    setDemoLeadSubmitting(true);
    setDemoLeadError(null);
    try {
      await submitPublicCommercialLead({
        name: demoLeadForm.name.trim(),
        whatsapp: demoLeadForm.whatsapp.trim(),
        email: demoLeadForm.email.trim() || undefined,
        serviceInterest: "software_subscription",
        voluntaryDetails: demoLeadDetails,
        consent: true,
        website: demoLeadForm.website,
      });
      setDemoLeadSubmitted(true);
    } catch (submitError) {
      setDemoLeadError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível enviar agora. Tente novamente mais tarde.",
      );
    } finally {
      demoSubmitInProgressRef.current = false;
      setDemoLeadSubmitting(false);
    }
  }

  return (
    <div id="inicio" className="min-h-screen overflow-hidden bg-[#071426] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#071426]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <a
            href="#inicio"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:gap-3 lg:flex-none"
            aria-label="MIL Contábil IA — início"
            onClick={closeMenu}
          >
            <img
              src="/images/logo-mil-contabil-ia.png"
              alt="MIL Contábil IA"
              className="h-12 w-20 shrink-0 object-contain sm:h-14 sm:w-24"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-extrabold leading-tight tracking-wide text-white sm:text-base">
                MIL CONTÁBIL IA
              </span>
              <span className="mt-1 block text-[10px] leading-tight text-amber-300 sm:text-xs">
                O futuro da contabilidade começa aqui.
              </span>
            </span>
          </a>

          <nav aria-label="Navegação principal" className="hidden items-center gap-7 lg:flex">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <button
              type="button"
              onClick={onRegister}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              Criar conta
            </button>
            <button
              type="button"
              onClick={onLogin}
              className="rounded-full border border-amber-300/70 bg-amber-300 px-5 py-2.5 text-sm font-bold text-[#101b2a] shadow-lg shadow-amber-500/10 transition hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Entrar
            </button>
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 lg:hidden"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>

        {menuOpen && (
          <nav
            id="mobile-navigation"
            aria-label="Navegação móvel"
            className="border-t border-white/10 bg-[#091a2e] px-4 py-4 lg:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-1">
              {navigation.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="rounded-lg px-3 py-3 text-sm font-medium text-slate-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    onRegister();
                  }}
                  className="rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  Criar conta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    onLogin();
                  }}
                  className="rounded-full bg-amber-300 px-4 py-3 text-sm font-bold text-[#101b2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Entrar
                </button>
              </div>
            </div>
          </nav>
        )}
      </header>

      <main>
        <section className="relative isolate">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_35%,rgba(37,99,235,0.22),transparent_42%),linear-gradient(135deg,#071426_20%,#0b2340_100%)]"
          />
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-28 lg:pt-24">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-200">
                <Sparkles size={14} className="text-amber-300" />
                Tecnologia para a rotina contábil
              </div>
              <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
                O futuro da contabilidade{" "}
                <span className="bg-gradient-to-r from-blue-300 via-sky-200 to-amber-200 bg-clip-text text-transparent">
                  começa aqui.
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                Conheça a MIL Contábil IA: uma plataforma que reúne gestão
                contábil e inteligência artificial para apoiar o dia a dia de
                escritórios e empresas.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#funcionalidades"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-amber-300 px-6 py-3 text-sm font-extrabold text-[#101b2a] shadow-xl shadow-amber-500/10 transition hover:-translate-y-0.5 hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Conheça a plataforma <ArrowRight size={17} />
                </a>
                <a
                  href="#contato"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:border-blue-200/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  Solicitar demonstração
                </a>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-400">
                <button
                  type="button"
                  onClick={onLogin}
                  className="font-semibold text-blue-200 underline decoration-blue-200/40 underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  Entrar no sistema
                </button>
                <button
                  type="button"
                  onClick={onRegister}
                  className="font-semibold text-slate-300 underline decoration-white/25 underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  Criar conta
                </button>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div
                aria-hidden="true"
                className="motion-safe:animate-pulse absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/20 blur-3xl sm:h-96 sm:w-96"
              />
              <div className="relative rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03] p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
                <div className="flex items-center justify-between border-b border-white/10 pb-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">
                      MIL Contábil IA
                    </p>
                    <p className="mt-1 text-sm text-slate-400">Contabilidade e tecnologia</p>
                  </div>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                    Plataforma digital
                  </span>
                </div>

                <div className="relative flex min-h-64 items-center justify-center py-8">
                  <div
                    aria-hidden="true"
                    className="absolute h-56 w-56 rounded-full border border-blue-200/10 sm:h-64 sm:w-64"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute h-40 w-40 rounded-full border border-dashed border-amber-200/20 sm:h-48 sm:w-48"
                  />
                  <div className="relative flex h-36 w-36 flex-col items-center justify-center rounded-full border border-blue-200/30 bg-gradient-to-br from-blue-500/30 to-[#091a2e] shadow-[0_0_70px_rgba(59,130,246,0.2)] sm:h-40 sm:w-40">
                    <Sparkles size={30} className="mb-2 text-amber-200" />
                    <span className="text-xl font-black tracking-wide">MIL IA</span>
                    <span className="mt-1 text-[10px] uppercase tracking-[0.16em] text-blue-100/70">
                      Apoio inteligente
                    </span>
                  </div>
                  <span className="absolute left-2 top-8 rounded-xl border border-white/10 bg-[#0b1d32]/90 px-3 py-2 text-xs font-semibold text-slate-200 shadow-lg sm:left-4">
                    Gestão contábil
                  </span>
                  <span className="absolute bottom-7 right-1 rounded-xl border border-white/10 bg-[#0b1d32]/90 px-3 py-2 text-xs font-semibold text-slate-200 shadow-lg sm:right-3">
                    Inteligência artificial
                  </span>
                  <span className="absolute right-0 top-7 flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/20 bg-amber-200/10 text-amber-200 sm:right-4">
                    <CheckCircle2 size={17} />
                  </span>
                </div>
                <p className="text-center text-xs leading-5 text-slate-400">
                  A MIL IA oferece apoio informacional. Revise as respostas
                  antes de tomar decisões contábeis.
                </p>
              </div>
            </div>
          </div>
          <a
            href="#funcionalidades"
            aria-label="Ir para funcionalidades"
            className="mx-auto mb-8 hidden h-10 w-10 items-center justify-center rounded-full border border-white/15 text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 lg:flex"
          >
            <ArrowDown size={17} />
          </a>
        </section>

        <section
          id="funcionalidades"
          aria-labelledby="features-heading"
          className="scroll-mt-20 bg-[#f7f9fc] py-20 text-slate-900 sm:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">
                Plataforma
              </p>
              <h2
                id="features-heading"
                className="mt-3 text-3xl font-black tracking-tight text-[#0b1b2c] sm:text-4xl"
              >
                Tecnologia para uma rotina mais organizada
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Conheça os recursos disponíveis e acompanhe com transparência o
                que ainda está em desenvolvimento.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className={`rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                      feature.upcoming
                        ? "border-dashed border-slate-300"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <Icon size={21} />
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold leading-4 ${
                          feature.upcoming
                            ? "bg-amber-50 text-amber-800"
                            : "bg-emerald-50 text-emerald-800"
                        }`}
                      >
                        {feature.status}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-extrabold text-[#10243b]">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
            <p className="mt-6 text-center text-xs leading-5 text-slate-500">
              A disponibilidade dos recursos pode variar conforme a configuração
              do ambiente e as permissões da conta.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="ai-heading"
          className="relative overflow-hidden bg-white py-16 sm:py-20"
        >
          <div
            aria-hidden="true"
            className="absolute -right-36 top-0 h-96 w-96 rounded-full bg-blue-100/70 blur-3xl"
          />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div className="order-2 lg:order-1">
              <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-[#eef5ff] via-white to-[#fffaf0] p-7 sm:p-10">
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0b2340] text-amber-200 shadow-lg">
                    <Sparkles size={26} />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                      MIL IA
                    </p>
                    <p className="text-lg font-extrabold text-[#10243b]">
                      Inteligência artificial aplicada à contabilidade
                    </p>
                  </div>
                </div>
                <div className="mt-8 space-y-3">
                  <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-sm bg-[#0b2340] px-4 py-3 text-sm leading-6 text-white">
                    Um apoio para consultar informações e organizar a rotina.
                  </div>
                  <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-blue-100 bg-white px-4 py-3 text-sm leading-6 text-slate-600 shadow-sm">
                    Use a IA como apoio. A validação profissional continua
                    essencial.
                  </div>
                </div>
                <p className="mt-5 text-xs leading-5 text-slate-500">
                  A disponibilidade depende da configuração do serviço. Não
                  insira informações pessoais ou sigilosas em consultas sem
                  observar as regras da sua organização.
                </p>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">
                Inteligência artificial
              </p>
              <h2
                id="ai-heading"
                className="mt-3 text-3xl font-black tracking-tight text-[#0b1b2c] sm:text-4xl"
              >
                Mais contexto para apoiar o trabalho contábil
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-600">
                A MIL IA foi pensada para apoiar consultas e ajudar a organizar
                informações da plataforma, mantendo a análise profissional no
                centro das decisões.
              </p>
              <div className="mt-6 flex items-start gap-3 text-sm leading-6 text-slate-600">
                <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-blue-700" />
                Apoio informacional, sem substituir a avaliação de um contador.
              </div>
              <div className="mt-3 flex items-start gap-3 text-sm leading-6 text-slate-600">
                <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-blue-700" />
                Respostas devem ser conferidas antes de orientar decisões.
              </div>
            </div>
          </div>
        </section>

        <section
          id="videos"
          aria-labelledby="videos-heading"
          className="scroll-mt-20 bg-[#f7f9fc] py-20 sm:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">
                  Conteúdo em vídeo
                </p>
                <h2
                  id="videos-heading"
                  className="mt-3 text-3xl font-black tracking-tight text-[#0b1b2c] sm:text-4xl"
                >
                  Vídeos e demonstrações
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  Este espaço está preparado para receber vídeos institucionais,
                  demonstrações e tutoriais.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-xs font-bold text-blue-800">
                <Play size={14} /> Publicações em preparação
              </span>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {videoCategories.map((category, index) => (
                <article
                  key={category}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div
                    className={`relative flex aspect-[16/9] items-center justify-center ${
                      index === 1
                        ? "bg-gradient-to-br from-blue-950 via-blue-900 to-slate-800"
                        : index === 2
                          ? "bg-gradient-to-br from-[#172b45] to-[#0a1a2e]"
                          : "bg-gradient-to-br from-slate-800 to-[#0b2340]"
                    }`}
                  >
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:28px_28px]"
                    />
                    <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur">
                      <Play size={22} fill="currentColor" />
                    </span>
                    <span className="absolute bottom-4 left-4 rounded-full border border-white/15 bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/80">
                      Vídeo em preparação
                    </span>
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                      {category}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Nenhum vídeo publicado nesta etapa.
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="parceiros"
          aria-labelledby="partners-heading"
          className="scroll-mt-20 bg-[#091a2e] py-20 sm:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-200/10 text-amber-200">
                <Handshake size={23} />
              </span>
              <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.2em] text-amber-200">
                Conexões com propósito
              </p>
              <h2
                id="partners-heading"
                className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl"
              >
                Nossos Parceiros
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Marcas e parceiros serão apresentados aqui somente após
                confirmação e autorização de publicação.
              </p>
            </div>

            <div className="mx-auto mt-10 flex min-h-36 max-w-3xl flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-6 py-8 text-center">
              <Handshake size={26} className="text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-200">
                Espaço reservado para parceiros confirmados
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Nenhum parceiro institucional está publicado nesta etapa.
              </p>
            </div>
          </div>
        </section>

        <section
          id="novidades"
          aria-labelledby="news-heading"
          className="scroll-mt-20 bg-white py-20 sm:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">
                Notícias e atualizações
              </p>
              <h2
                id="news-heading"
                className="mt-3 text-3xl font-black tracking-tight text-[#0b1b2c] sm:text-4xl"
              >
                Novidades da MIL Contábil IA
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Comunicados institucionais e atualizações serão publicados após
                revisão.
              </p>
            </div>
            <div className="mx-auto mt-10 flex min-h-36 max-w-3xl flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-[#f7f9fc] px-6 py-8 text-center">
              <Sparkles size={24} className="text-blue-700" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Nenhuma novidade publicada nesta etapa
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Não exibimos conteúdo de demonstração como notícia atual.
              </p>
            </div>
          </div>
        </section>

        <section
          id="contato"
          aria-labelledby="contact-heading"
          className="scroll-mt-20 bg-gradient-to-br from-[#071426] via-[#0b2340] to-[#102b4b] py-20 sm:py-24"
        >
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-amber-200">
                Vamos conversar
              </p>
              <h2
                id="contact-heading"
                className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl"
              >
                Solicite uma demonstração
              </h2>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
                Preencha os dados para solicitar uma demonstração da assinatura
                da plataforma.
              </p>
              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-sm font-bold text-white">
                  Um espaço para conhecer a plataforma
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  A equipe poderá apresentar os recursos disponíveis e
                  esclarecer dúvidas sobre a solução.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white p-5 text-slate-900 shadow-2xl shadow-black/20 sm:p-8">
              {demoLeadSubmitted ? (
                <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
                  <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="font-bold">Solicitação recebida</p>
                    <p className="mt-1 text-sm leading-6">
                      O envio foi aceito. Nossa equipe poderá entrar em contato pelo WhatsApp informado.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleDemoLeadSubmit} aria-busy={demoLeadSubmitting}>
                  <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
                    <label>
                      Deixe este campo vazio
                      <input
                        name="website"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        maxLength={200}
                        value={demoLeadForm.website}
                        onChange={(event) => updateDemoLeadForm("website", event.target.value)}
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-xs font-bold text-slate-600">
                      Nome <span aria-hidden="true" className="text-rose-600">*</span>
                      <input
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={120}
                        value={demoLeadForm.name}
                        onChange={(event) => updateDemoLeadForm("name", event.target.value)}
                        placeholder="Seu nome"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      Empresa ou escritório <span className="font-normal text-slate-400">(opcional)</span>
                      <input
                        name="company"
                        type="text"
                        autoComplete="organization"
                        maxLength={120}
                        value={demoLeadForm.company}
                        onChange={(event) => updateDemoLeadForm("company", event.target.value)}
                        placeholder="Nome da organização"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      E-mail <span className="font-normal text-slate-400">(opcional)</span>
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        value={demoLeadForm.email}
                        onChange={(event) => updateDemoLeadForm("email", event.target.value)}
                        placeholder="voce@empresa.com.br"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      WhatsApp <span aria-hidden="true" className="text-rose-600">*</span>
                      <input
                        ref={demoWhatsAppInputRef}
                        name="whatsapp"
                        type="tel"
                        autoComplete="tel"
                        required
                        maxLength={24}
                        value={demoLeadForm.whatsapp}
                        onChange={(event) => updateDemoLeadForm("whatsapp", event.target.value)}
                        placeholder="(11) 99999-9999"
                        aria-describedby="demo-whatsapp-help"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                      <span id="demo-whatsapp-help" className="mt-1 block font-normal text-slate-500">
                        Informe o número com DDD.
                      </span>
                    </label>
                    <label className="text-xs font-bold text-slate-600 sm:col-span-2">
                      Mensagem <span className="font-normal text-slate-400">(opcional)</span>
                      <textarea
                        name="message"
                        rows={4}
                        maxLength={500}
                        value={demoLeadForm.message}
                        onChange={(event) => updateDemoLeadForm("message", event.target.value)}
                        placeholder="Como podemos ajudar?"
                        className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                      <span className={`mt-1 block text-right font-normal ${demoLeadDetailsLength > 500 ? "text-rose-700" : "text-slate-500"}`}>
                        Detalhes enviados: {demoLeadDetailsLength}/500 caracteres
                      </span>
                      {demoLeadDetailsLength > 500 && (
                        <span role="alert" className="mt-1 block font-semibold text-rose-700">
                          Reduza empresa ou mensagem para continuar.
                        </span>
                      )}
                    </label>
                  </div>

                  <label className="mt-4 flex items-start gap-3 text-xs leading-5 text-slate-600">
                    <input
                      name="consent"
                      type="checkbox"
                      required
                      checked={demoLeadForm.consent}
                      onChange={(event) => updateDemoLeadForm("consent", event.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                    />
                    <span>
                      Autorizo o armazenamento destes dados pela MIL Contábil IA e o contato pelo WhatsApp sobre a demonstração da plataforma.
                    </span>
                  </label>

                  {demoLeadError && (
                    <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm leading-5 text-rose-800">
                      {demoLeadError}
                    </p>
                  )}

                  <p className="mt-4 text-[11px] leading-5 text-slate-500">
                    Não informe senhas, documentos, dados bancários ou informações contábeis sigilosas.
                  </p>

                  <button
                    type="submit"
                    disabled={demoLeadSubmitting || !demoLeadForm.consent || demoLeadDetailsLength > 500}
                    className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0b2340] px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#12345a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {demoLeadSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                    {demoLeadSubmitting ? "Enviando solicitação..." : "Solicitar demonstração"}
                    {!demoLeadSubmitting && <ArrowRight size={16} aria-hidden="true" />}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#050f1d]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <img
              src="/images/logo-mil-contabil-ia.png"
              alt=""
              aria-hidden="true"
              className="h-12 w-20 object-contain"
            />
            <div>
              <p className="text-sm font-extrabold text-white">MIL Gestão &amp; Tecnologia</p>
              <p className="mt-1 text-xs text-slate-400">
                Tecnologia a serviço da contabilidade.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:gap-6">
            <span>© {new Date().getFullYear()} MIL Gestão &amp; Tecnologia</span>
            <button
              type="button"
              onClick={onLogin}
              className="w-fit font-semibold text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              Entrar no sistema
            </button>
          </div>
        </div>
      </footer>

      {milaOpen ? (
        <section
          id="mila-chat"
          role="dialog"
          aria-labelledby="mila-chat-title"
          className="fixed inset-2 z-[60] flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl shadow-slate-950/30 sm:inset-y-[6dvh] sm:left-auto sm:right-6 sm:h-[88dvh] sm:max-h-[88dvh] sm:w-[min(460px,calc(100vw-3rem))] sm:rounded-3xl"
        >
          <header className="flex shrink-0 items-center justify-between bg-[#0b2340] px-4 py-4 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-300 text-[#0b2340]">
                <Sparkles size={20} />
              </span>
              <div>
                <h2 id="mila-chat-title" className="font-extrabold">Mila</h2>
                <p className="text-xs text-blue-100">Atendimento Inteligente • MIL Contábil IA</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMilaOpen(false)}
              aria-label="Fechar conversa com a Mila"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <X size={20} />
            </button>
          </header>

          <div ref={milaChatMessagesRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-[#f7f9fc] p-4" aria-live="polite">
            <div className="flex items-start gap-2.5">
              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
                <Sparkles size={16} />
              </span>
              <p className="max-w-[85%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 shadow-sm">
                Olá! Seja bem-vindo(a) à MIL Contábil IA! Meu nome é Mila e estou aqui para ajudar você.
              </p>
            </div>

            {milaMessages.map((message, index) => (
              <div
                key={`${index}-${message.role}`}
                className={`flex items-start gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
                    <Bot size={16} />
                  </span>
                )}
                {message.role === "user" ? (
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[#0b2340] px-4 py-3 text-sm leading-6 text-white shadow-sm">
                    {message.content}
                  </p>
                ) : (
                  <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm">
                    <MilaFormattedMessage content={message.content} />
                  </div>
                )}
                {message.role === "user" && (
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-700">
                    <User size={16} />
                  </span>
                )}
              </div>
            ))}

            {milaLoading && (
              <div className="flex items-center gap-2.5 text-sm text-slate-500" role="status">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
                  <Bot size={16} />
                </span>
                <span className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <Loader2 size={16} className="animate-spin text-blue-700" />
                  A Mila está preparando uma resposta...
                </span>
              </div>
            )}

            {milaError && (
              <p role="alert" className="ml-10 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">
                {milaError}
              </p>
            )}

            <div className="space-y-2 pl-10">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Atalhos
              </p>
              {MILA_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={milaLoading}
                  onClick={() => void sendMilaMessage(option)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-[#0b2340] shadow-sm transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {option}
                  <ArrowRight size={15} className="shrink-0 text-blue-700" />
                </button>
              ))}
            </div>
            <div className="pl-10">
              <button
                type="button"
                onClick={() => setMilaLeadCaptureOpen(true)}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-left text-sm font-bold text-[#0b2340] transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                Quero receber contato
                <ArrowRight size={15} className="shrink-0 text-amber-700" />
              </button>
            </div>
            {milaLeadCaptureOpen && (
              <MilaLeadCapture onClose={() => setMilaLeadCaptureOpen(false)} />
            )}
          </div>

          <form onSubmit={handleMilaSubmit} className="shrink-0 border-t border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={milaInput}
                onChange={(event) => setMilaInput(event.target.value)}
                maxLength={1200}
                disabled={milaLoading}
                aria-label="Mensagem para a Mila"
                placeholder="Digite sua mensagem..."
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={milaLoading || !milaInput.trim()}
                aria-label="Enviar mensagem"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0b2340] text-white transition hover:bg-[#12345a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={17} />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] leading-4 text-slate-500">
              Não informe senhas, documentos ou dados sigilosos. Respostas fiscais e trabalhistas exigem validação profissional.
            </p>
          </form>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setMilaOpen(true)}
          aria-expanded={milaOpen}
          aria-controls="mila-chat"
          className="fixed bottom-5 right-4 z-[60] inline-flex min-h-14 items-center gap-2.5 rounded-full border border-amber-200/70 bg-[#0b2340] px-5 text-sm font-extrabold text-white shadow-xl shadow-slate-950/25 transition hover:-translate-y-0.5 hover:bg-[#12345a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 sm:right-6"
        >
          <MessageCircle size={19} className="text-amber-200" />
          Fale com a Mila
        </button>
      )}
    </div>
  );
}
