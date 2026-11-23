import { useState } from "react";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  Eye,
  FileText,
  Globe,
  Handshake,
  Inbox,
  LockKeyhole,
  Megaphone,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Video,
  XCircle,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import CommercialLeadsPanel from "./CommercialLeadsPanel";

type SiteTab = "videos" | "partners" | "news" | "requests";

const tabs: Array<{ id: SiteTab; label: string; icon: typeof Video }> = [
  { id: "videos", label: "Vídeos", icon: Video },
  { id: "partners", label: "Parceiros", icon: Handshake },
  { id: "news", label: "Notícias", icon: FileText },
  { id: "requests", label: "Solicitações comerciais", icon: Inbox },
];

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-80";

export default function GestaoSite() {
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<SiteTab>("videos");

  if (!hasRole("platform_admin")) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <LockKeyhole size={25} />
        </span>
        <h1 className="mt-5 text-xl font-black text-slate-800">Acesso não autorizado</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
          Gestão do Site está disponível exclusivamente para administradores da plataforma.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-700">
              Conteúdo institucional
            </p>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-800">
              Interface local
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Gestão do Site
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Organize conteúdos da página pública. Nesta etapa, os controles são apenas demonstrativos.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-900 sm:self-auto">
          <LockKeyhole size={15} />
          Publicação desabilitada
        </div>
      </header>

      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"
      >
        <ShieldCheck size={19} className="mt-0.5 shrink-0 text-amber-700" />
        <div>
          <p className="text-sm font-extrabold text-amber-950">
            Ainda não conectado ao backend
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-900/80">
            Nenhum conteúdo ou solicitação é carregado, salvo, aprovado ou publicado. A conexão será
            feita em uma etapa posterior, com autorização e controles de segurança próprios.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div
          role="tablist"
          aria-label="Seções da Gestão do Site"
          className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`site-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`site-panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 text-xs font-bold transition sm:px-4 sm:text-sm ${
                  selected
                    ? "bg-[#0b2340] text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          id={`site-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`site-tab-${activeTab}`}
          className="p-4 sm:p-6"
        >
          {activeTab === "videos" && <VideosPanel />}
          {activeTab === "partners" && <PartnersPanel />}
          {activeTab === "news" && <NewsPanel />}
          {activeTab === "requests" && <RequestsPanel />}
        </div>
      </div>
    </div>
  );
}

function VideosPanel() {
  return (
    <div className="space-y-5">
      <PanelHeading
        icon={<Video size={18} />}
        title="Vídeos"
        description="Prepare vídeos institucionais, demonstrações e tutoriais para o site."
        action="Novo vídeo"
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-extrabold text-slate-800">Biblioteca</h2>
            <span className="text-xs text-slate-400">0 vídeos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-extrabold">Título</th>
                  <th scope="col" className="px-4 py-3 font-extrabold">Categoria</th>
                  <th scope="col" className="px-4 py-3 font-extrabold">Publicação</th>
                  <th scope="col" className="px-4 py-3 font-extrabold">Ações</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <EmptyIcon icon={<Video size={22} />} />
                    <p className="mt-4 text-sm font-bold text-slate-700">Nenhum vídeo cadastrado</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Os vídeos publicados aparecerão aqui após a integração com o backend.
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
          <h2 className="text-sm font-extrabold text-slate-800">Dados do vídeo</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Campos demonstrativos, sem gravação.</p>
          <div className="mt-4 space-y-3">
            <Field label="Título" placeholder="Título do vídeo" />
            <Field label="Descrição" placeholder="Descrição breve" multiline />
            <Field label="Categoria" placeholder="Selecione uma categoria" />
            <Field label="URL do YouTube" placeholder="https://youtube.com/..." />
            <Field label="Imagem de capa" placeholder="Selecionar arquivo" type="file" />
          </div>
          <DisabledActions labels={["Editar", "Prévia", "Publicar", "Desativar"]} />
        </div>
      </div>
    </div>
  );
}

function PartnersPanel() {
  return (
    <div className="space-y-5">
      <PanelHeading
        icon={<Handshake size={18} />}
        title="Parceiros"
        description="Cadastre somente marcas confirmadas e autorizadas para publicação."
        action="Novo parceiro"
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-extrabold text-slate-800">Parceiros cadastrados</h2>
            <span className="text-xs text-slate-400">0 parceiros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-extrabold">Nome</th>
                  <th scope="col" className="px-4 py-3 font-extrabold">Categoria</th>
                  <th scope="col" className="px-4 py-3 font-extrabold">Aprovação</th>
                  <th scope="col" className="px-4 py-3 font-extrabold">Publicação</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <EmptyIcon icon={<Handshake size={22} />} />
                    <p className="mt-4 text-sm font-bold text-slate-700">Nenhum parceiro cadastrado</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Não há marcas ou logotipos de parceiros exibidos nesta interface.
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800">Dados do parceiro</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              A aprovação e a publicação estão desabilitadas.
            </p>
          </div>
          <div className="space-y-3">
            <Field label="Nome" placeholder="Nome oficial" />
            <Field label="Logotipo" placeholder="Selecionar arquivo autorizado" type="file" />
            <Field label="Descrição" placeholder="Descrição institucional" multiline />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Site oficial" placeholder="https://" />
              <Field label="Categoria" placeholder="Categoria da parceria" />
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Prévia pública
            </p>
            <div className="mt-3 flex min-h-20 items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-center">
              <Globe size={19} className="shrink-0 text-slate-300" />
              <span className="text-xs text-slate-500">
                Logotipo e descrição autorizados aparecerão aqui.
              </span>
            </div>
          </div>
          <DisabledActions labels={["Editar", "Prévia", "Aprovar", "Publicar", "Desativar"]} />
        </div>
      </div>
    </div>
  );
}

function NewsPanel() {
  return (
    <div className="space-y-5">
      <PanelHeading
        icon={<Megaphone size={18} />}
        title="Notícias"
        description="Prepare comunicados e atualizações para revisão antes de publicar."
        action="Nova notícia"
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-extrabold text-slate-800">Publicações</h2>
            <span className="text-xs text-slate-400">0 notícias</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-extrabold">Título</th>
                  <th scope="col" className="px-4 py-3 font-extrabold">Última atualização</th>
                  <th scope="col" className="px-4 py-3 font-extrabold">Status</th>
                  <th scope="col" className="px-4 py-3 font-extrabold">Ações</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <EmptyIcon icon={<Megaphone size={22} />} />
                    <p className="mt-4 text-sm font-bold text-slate-700">Nenhuma notícia cadastrada</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Não exibimos conteúdo de demonstração como publicação real.
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
          <h2 className="text-sm font-extrabold text-slate-800">Editor de notícia</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            O fluxo de rascunho, aprovação e publicação ainda não está conectado.
          </p>
          <div className="mt-4 space-y-3">
            <Field label="Título" placeholder="Título da notícia" />
            <Field label="Resumo" placeholder="Resumo para a página pública" multiline />
            <Field label="Conteúdo" placeholder="Conteúdo da publicação" multiline />
            <Field label="Imagem" placeholder="Selecionar imagem" type="file" />
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-600">Status editorial</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusButton icon={<Pencil size={13} />} label="Rascunho" />
              <StatusButton icon={<BadgeCheck size={13} />} label="Aprovado" />
              <StatusButton icon={<Send size={13} />} label="Publicado" />
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Prévia antes da publicação
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              A prévia de uma notícia aparecerá aqui quando o editor estiver conectado.
            </p>
          </div>
          <DisabledActions labels={["Salvar rascunho", "Prévia", "Aprovar", "Publicar"]} />
        </div>
      </div>
    </div>
  );
}

function RequestsPanel() {
  return <CommercialLeadsPanel />;
}

function PanelHeading({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-800">
          {icon}
        </span>
        <div>
          <h2 className="text-base font-black text-slate-900">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      {action && (
        <button
          type="button"
          disabled
          title="Disponível após integração segura com o backend"
          className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl bg-[#0b2340] px-4 text-xs font-bold text-white opacity-50 sm:self-auto"
        >
          <Plus size={15} />
          {action}
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  placeholder,
  type = "text",
  multiline = false,
}: {
  label: string;
  placeholder: string;
  type?: string;
  multiline?: boolean;
}) {
  return (
    <label className="block text-xs font-bold text-slate-600">
      {label}
      {multiline ? (
        <textarea disabled rows={3} placeholder={placeholder} className={`${fieldClass} resize-none`} />
      ) : (
        <input disabled type={type} placeholder={placeholder} className={fieldClass} />
      )}
    </label>
  );
}

function DisabledActions({ labels }: { labels: string[] }) {
  const icons: Record<string, typeof Pencil> = {
    Editar: Pencil,
    Prévia: Eye,
    Aprovar: BadgeCheck,
    Publicar: Send,
    Desativar: XCircle,
    "Salvar rascunho": Pencil,
  };
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
      {labels.map((label) => {
        const Icon = icons[label] ?? LockKeyhole;
        return (
          <button
            key={label}
            type="button"
            disabled
            title="Controle demonstrativo; backend ainda não conectado"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-400"
          >
            <Icon size={13} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function StatusButton({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      disabled
      className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-semibold text-slate-400"
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyIcon({ icon }: { icon: ReactNode }) {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      {icon}
    </span>
  );
}
