import React from "react";
import { Building2, Phone, Palette, FileText } from "lucide-react";

export default function OfficeSettingsTab() {
    return (
        <div className="space-y-6">

            <div>
                <h2 className="text-2xl font-bold text-slate-800">
                    Configurações do Escritório
                </h2>

                <p className="text-slate-500">
                    Configure os dados institucionais da contabilidade.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                <div className="bg-white rounded-xl shadow border p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <Building2 size={20} />
                        <h3 className="font-semibold">
                            Dados do Escritório
                        </h3>
                    </div>

                    <input
                        className="w-full border rounded-lg p-3 mb-3"
                        placeholder="Nome do Escritório"
                    />

                    <input
                        className="w-full border rounded-lg p-3 mb-3"
                        placeholder="Nome Fantasia"
                    />

                    <input
                        className="w-full border rounded-lg p-3 mb-3"
                        placeholder="CNPJ"
                    />

                    <input
                        className="w-full border rounded-lg p-3"
                        placeholder="CRC"
                    />
                </div>

                <div className="bg-white rounded-xl shadow border p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <Phone size={20} />
                        <h3 className="font-semibold">
                            Contatos
                        </h3>
                    </div>

                    <input
                        className="w-full border rounded-lg p-3 mb-3"
                        placeholder="Telefone"
                    />

                    <input
                        className="w-full border rounded-lg p-3 mb-3"
                        placeholder="WhatsApp"
                    />

                    <input
                        className="w-full border rounded-lg p-3 mb-3"
                        placeholder="E-mail"
                    />

                    <input
                        className="w-full border rounded-lg p-3"
                        placeholder="Website"
                    />
                </div>

                <div className="bg-white rounded-xl shadow border p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <Palette size={20} />
                        <h3 className="font-semibold">
                            Identidade Visual
                        </h3>
                    </div>

                    <input
                        type="color"
                        className="w-20 h-12"
                    />

                    <div className="mt-4">
                        <input type="file" />
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow border p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <FileText size={20} />
                        <h3 className="font-semibold">
                            Relatórios
                        </h3>
                    </div>

                    <textarea
                        className="w-full border rounded-lg p-3 h-32"
                        placeholder="Rodapé dos relatórios..."
                    />
                </div>

            </div>

            <div className="flex justify-end">
                <button
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold"
                >
                    Salvar Configurações
                </button>
            </div>

        </div>
    );
}