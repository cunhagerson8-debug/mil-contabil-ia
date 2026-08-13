# Arquitetura de Banco de Dados — MIL Contábil IA

## Decisão: PostgreSQL, Shared Database + Shared Schema + Row-Level Security (RLS)

### Por que não schema-per-tenant ou database-per-tenant

| Critério | Shared Schema + RLS (escolhido) | Schema-per-tenant | Database-per-tenant |
|---|---|---|---|
| Escalabilidade operacional | Centenas/milhares de tenants sem esforço | Degrada após ~100-200 schemas | Não escala para SaaS |
| Migrations | Uma vez, aplica a todos | Precisa rodar em N schemas | Precisa rodar em N databases |
| Relatórios cross-tenant (billing, analytics da MIL) | Uma query | UNION ALL manual por schema | ETL obrigatório |
| Isolamento de dados | Forte — aplicado pelo Postgres, não pela aplicação | Forte | Mais forte, custo operacional alto |
| Custo de infraestrutura | Um único banco gerenciado | Médio | Alto (N conexões, N backups) |

### A particularidade deste domínio: tenancy em dois níveis

O tenant raiz **não é a empresa-cliente** — é o **escritório contábil** (cliente da plataforma MIL Contábil IA). Um escritório atende múltiplas empresas. Isso exige isolamento em duas camadas:

1. **Nível 1 — `firm_id`**: isola dados entre escritórios contábeis diferentes (tenants da plataforma SaaS). Nenhum escritório pode ver dados de outro.
2. **Nível 2 — `company_id`**: dentro de um escritório, filtra/restringe acesso por empresa-cliente — necessário para o Portal do Cliente (um cliente só vê dados da sua própria empresa) e para usuários do escritório com acesso restrito a carteiras específicas.

Toda tabela de negócio carrega `firm_id` (obrigatório) e, quando aplicável, `company_id` (a empresa a que o registro pertence).

### Como o isolamento é garantido

- **RLS (Row-Level Security)** ativado em todas as tabelas de negócio.
- A aplicação define `app.current_firm_id` (e opcionalmente `app.current_company_id` para sessões de portal do cliente) via `SET LOCAL` no início de cada transação/request, usando uma variável de sessão do Postgres.
- As políticas RLS filtram automaticamente todas as queries — mesmo que a aplicação tenha um bug, é estruturalmente impossível um escritório ler dados de outro escritório por engano.
- Conexões administrativas/job de billing usam um role separado (`mil_platform_admin`) com `BYPASSRLS`, restrito a operações de plataforma.

### Estratégia de migração futura (se necessário)

Se um escritório específico crescer a ponto de exigir isolamento físico (requisito contratual de grande cliente, compliance, volume), a tabela `firms` já é o ponto de particionamento natural — pode-se mover esse `firm_id` para um banco dedicado via lógica de roteamento na camada de aplicação, sem redesenhar o schema.

---

## Diagrama de relacionamento (visão geral)

```
firms (escritórios contábeis — tenant raiz)
  │
  ├─< users (usuários do escritório: admin, contador, auxiliar)
  │
  └─< companies (empresas-clientes atendidas)
        │
        ├─< company_partners (sócios — Quadro societário)
        ├─< digital_certificates (certificado A1)
        │
        ├─< clients (cadastro de cliente — pode vincular a uma company)
        │     ├─< client_contacts
        │     ├─< client_documents
        │     └─< client_history_entries
        │
        ├─< tax_obligations (Obrigações Fiscais)
        │
        ├─< invoices (Notas Fiscais)
        │     └─< invoice_items
        │
        ├─< alerts (Central de Alertas)
        │
        └─< portal_documents / portal_guides / portal_messages (Portal do Cliente)
              (vinculados a clients, não direto a companies)

integration_logs (auditoria de chamadas a Receita Federal / eSocial / FGTS Digital)
  → referencia firms + companies
```
