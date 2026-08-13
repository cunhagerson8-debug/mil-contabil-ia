# MIL Contábil IA — Banco de Dados

PostgreSQL · Shared Database + Shared Schema · Row-Level Security · Multi-tenant em dois níveis (`firm` → `company`)

Ver decisão arquitetural completa em [`ARCHITECTURE.md`](./ARCHITECTURE.md). Este documento cobre o estado atual do schema após as migrations 001–012.

---

## 1. Como aplicar as migrations

```bash
for f in database/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

As migrations são sequenciais e idempotentes na ordem — não pulam números, não há `DOWN`/rollback automatizado nesta fase (schema inicial; rollback é feito restaurando backup ou via migration corretiva aditiva).

| # | Arquivo | Conteúdo |
|---|---|---|
| 001 | `extensions_and_enums.sql` | Extensões (`pgcrypto`, `citext`, `pg_trgm`) e 25 enums |
| 002 | `firms_and_users.sql` | Tenant raiz (`firms`), `users`, `user_company_access`, `refresh_tokens` |
| 003 | `companies.sql` | `companies`, `company_partners`, `digital_certificates` |
| 004 | `clients.sql` | `clients`, `client_contacts`, `client_documents`, `client_history_entries` |
| 005 | `tax_obligations.sql` | `tax_obligations` + função de recálculo de status |
| 006 | `invoices.sql` | `invoices`, `invoice_items` |
| 007 | `alerts.sql` | `alerts` + geração automática a partir de obrigações/certificados |
| 008 | `client_portal.sql` | `portal_documents`, `portal_guides`, `portal_messages` |
| 009 | `subscriptions_and_billing.sql` | `plans`, `subscriptions`, `platform_invoices`, `usage_counters` |
| 010 | `audit_log.sql` | `audit_logs` + triggers genéricos e dedicados |
| 011 | `row_level_security.sql` | RLS + 41 policies + roles de banco (`mil_app`, `mil_platform_admin`) |
| 012 | `seed_roles_and_plans.sql` | Catálogo inicial de planos comerciais |

---

## 2. Tabelas (23) e domínio

| Domínio | Tabelas |
|---|---|
| **Tenancy / Auth** | `firms`, `users`, `user_company_access`, `refresh_tokens` |
| **Empresas** | `companies`, `company_partners`, `digital_certificates` |
| **Clientes** | `clients`, `client_contacts`, `client_documents`, `client_history_entries` |
| **Obrigações Fiscais** | `tax_obligations` |
| **Notas Fiscais** | `invoices`, `invoice_items` |
| **Central de Alertas** | `alerts` |
| **Portal do Cliente** | `portal_documents`, `portal_guides`, `portal_messages` |
| **Billing da plataforma** | `plans`, `subscriptions`, `platform_invoices`, `usage_counters` |
| **Auditoria** | `audit_logs` |

## 3. Relacionamentos principais (43 foreign keys no total)

```
firms (1) ──< (N) users
firms (1) ──< (N) companies
firms (1) ──< (N) clients
firms (1) ──< (N) tax_obligations
firms (1) ──< (N) invoices
firms (1) ──< (N) alerts
firms (1) ──< (1) subscriptions   [único registro ativo por vez]

companies (1) ──< (N) company_partners
companies (1) ──< (N) digital_certificates
companies (1) ──< (N) tax_obligations
companies (1) ──< (N) invoices
companies (1) ──o (N) clients        [opcional — client pode não ter company]
companies (1) ──< (N) user_company_access

clients (1) ──< (N) client_contacts
clients (1) ──< (N) client_documents
clients (1) ──< (N) client_history_entries
clients (1) ──< (N) portal_documents
clients (1) ──< (N) portal_guides
clients (1) ──< (N) portal_messages

invoices (1) ──< (N) invoice_items
tax_obligations (1) ──o (N) alerts          [origem]
tax_obligations (1) ──o (N) portal_guides   [origem opcional]
digital_certificates (1) ──o (N) alerts     [origem]

subscriptions (1) ──< (N) platform_invoices
plans (1) ──< (N) subscriptions
```

Ver diagrama completo (Mermaid) em [`erd/erd.mmd`](./erd/erd.mmd).

---

## 4. Modelo de autenticação

- **Identidade única**: a tabela `users` cobre todos os tipos de usuário (equipe MIL, equipe do escritório, usuários do portal) diferenciados pela coluna `role` — um único fluxo de login, sem tabelas paralelas.
- **Senha**: nunca em texto puro. `password_hash` armazena hash (bcrypt/argon2 calculado na aplicação). `auth_provider` suporta SSO/social (`google`, `microsoft`, `saml`) — quando não é `'password'`, `password_hash` pode ser `NULL` (`CHECK` constraint garante consistência).
- **MFA**: `mfa_enabled` + `mfa_secret` (TOTP), secret cifrado pela aplicação antes de persistir.
- **Sessão longa**: `refresh_tokens` guarda apenas o **hash** do refresh token, nunca o token em claro — mesmo princípio do password.
- **Contexto de sessão para RLS**: a aplicação executa, no início de cada transação:
  ```sql
  SET LOCAL app.current_user_id = '<uuid>';
  SET LOCAL app.current_firm_id = '<uuid ou NULL>';
  SET LOCAL app.current_role    = '<role>';
  ```
  Essas variáveis (lidas via `current_setting()`, encapsuladas nas funções `app_current_user_id()`, `app_current_firm_id()`, `app_current_role()`) são a única fonte de verdade para as policies — `SET LOCAL` garante que não escapam da transação atual, mesmo com connection pooling.

## 5. Roles (papéis de usuário — coluna `role`, enum `user_role`)

| Role | Escopo | Acesso |
|---|---|---|
| **Platform Admin** | Global (firm_id NULL) | Gerencia `firms`, `plans`; suspende/ativa tenants; billing agregado. Usa role de banco `mil_platform_admin` (`BYPASSRLS`). |
| **Accounting Firm Owner** (`firm_owner`) | Próprio firm | Acesso total: cria/edita/exclui `companies`, `clients`; convida/remove `users`; único role que pode `DELETE`; vê billing e `audit_logs` do escritório. |
| **Accountant** | Próprio firm (carteira opcional via `user_company_access`) | Operacional: cria/edita `companies`, `clients`, `tax_obligations`, `invoices`. Sem acesso a billing/auditoria do firm, sem `DELETE`. |
| **Company Manager** (`company_manager`) | Empresa(s) vinculada(s) em `user_company_access` | Portal do Cliente com permissão de gestão: lê dados da própria empresa, envia mensagens, marca guias como pagas (`can_manage = true`). |
| **Company User** (`company_user`) | Empresa(s) vinculada(s) | Portal do Cliente, leitura/operação limitada (`can_manage = false` — aplicação esconde ações de gestão). |

Distinção de role de **banco** (Postgres) vs role de **aplicação** (enum `user_role`): só existem dois roles de banco (`mil_app`, usado por todo tráfego autenticado; `mil_platform_admin`, com `BYPASSRLS`). O enum `user_role` é quem decide *o que* cada policy libera dentro do role `mil_app`.

---

## 6. Modelo de segurança multi-tenant (RLS)

### Por que dois níveis de tenancy

O tenant raiz é o **escritório contábil** (`firm`), não a empresa-cliente. Um firm atende N companies. Isso exige isolamento em duas camadas simultâneas:

1. **Nível 1 — `firm_id`**: nenhum escritório vê dados de outro escritório. Toda tabela de negócio carrega `firm_id` direto ou via FK ascendente (`EXISTS` até achar a tabela que tem `firm_id`).
2. **Nível 2 — `company_id` + `user_company_access`**: dentro do mesmo firm, restringe o que cada usuário do Portal do Cliente vê (só suas próprias empresas) e, opcionalmente, restringe a carteira de um `accountant` específico.

### Como isso é aplicado

- RLS **habilitado em todas as 23 tabelas**.
- 41 policies cobrindo `SELECT`/`INSERT`/`UPDATE`/`DELETE` conforme a tabela.
- Tabelas sem `firm_id` direto (`company_partners`, `digital_certificates`, `client_contacts`, `client_documents`, `client_history_entries`, `invoice_items`, `portal_documents`, `portal_guides`, `portal_messages`, `user_company_access`, `refresh_tokens`) usam `EXISTS` contra a tabela pai para herdar o isolamento — nunca duplicam `firm_id` redundantemente quando o JOIN ascendente já garante o filtro.
- **Falha seca por padrão**: RLS nega por padrão qualquer linha sem policy explícita — um bug de aplicação não pode "esquecer o WHERE" e expor dados de outro tenant, porque o banco filtra independentemente da query.
- `plans` é a única tabela deliberadamente global (catálogo comercial, sem isolamento por firm).
- Tabelas de billing (`subscriptions`, `platform_invoices`, `usage_counters`, `audit_logs`) são visíveis apenas a `firm_owner` — `accountant` não vê o que o escritório paga à plataforma nem o log de auditoria completo.

---

## 7. Auditoria

- Tabela única `audit_logs`, polimórfica (`entity_table` + `entity_id`) — evita uma tabela de auditoria por entidade.
- `audit_trigger_fn()` genérica, anexada via trigger a `companies`, `clients`, `tax_obligations`, `invoices`, `subscriptions`.
- `audit_users_trigger_fn()` dedicada para `users` — expurga `password_hash` e `mfa_secret` do payload antes de gravar.
- `audit_digital_certificates_trigger_fn()` dedicada para `digital_certificates` — resolve `firm_id` via JOIN com `companies`, já que a tabela só tem `company_id` direto (a função genérica deixaria `firm_id` nulo, quebrando a policy de leitura de auditoria por `firm_owner`).
- `INSERT`-only para o role `mil_app` (sem `UPDATE`/`DELETE`) — log não pode ser alterado retroativamente pela aplicação operacional.
- Nota de produção: recomenda-se particionar `audit_logs` por `RANGE (created_at)` (mensal) a partir de volume relevante, com retenção fria para fiscal/legal — migração futura aditiva, não bloqueante hoje.

---

## 8. Billing e assinaturas

Dois domínios de "nota fiscal" deliberadamente separados:

| Tabela | O quê | Quem emite para quem |
|---|---|---|
| `invoices` (006) | NFS-e / NF-e / NFC-e | O **escritório** emite para **os clientes do escritório** |
| `platform_invoices` (009) | Fatura SaaS | A **MIL Gestão & Tecnologia** cobra do **escritório** |

- `plans`: catálogo (Starter, Professional, Enterprise, Enterprise Anual), com `features jsonb` para feature-gating (`esocial_integration`, `fgts_digital_integration`, `white_label` etc.) e limites (`max_companies`, `max_users`, `max_invoices_month`).
- `subscriptions`: uma assinatura ativa por firm (`UNIQUE` parcial garante isso); cobrança real delegada a gateway externo (`payment_provider` + `payment_provider_ref` — Stripe/Pagar.me).
- `usage_counters`: contadores agregados mensais para enforcement de limite sem `COUNT(*)` em tempo real nas tabelas operacionais.

---

## 9. Verificação de cobertura por módulo do frontend

| Módulo (frontend) | Tabelas correspondentes | Cobertura |
|---|---|---|
| **Empresas** | `companies`, `company_partners`, `digital_certificates` | ✅ Espelha `modules/empresas/types.ts` 1:1 |
| **Clientes** | `clients`, `client_contacts`, `client_documents`, `client_history_entries` | ✅ Espelha `modules/clientes/types.ts` 1:1 |
| **Obrigações Fiscais** | `tax_obligations` | ✅ Espelha `modules/obrigacoes-fiscais/types.ts` 1:1, incluindo `integration_ref`/`integration_source` para os adapters de `architecture/integrations.ts` |
| **Emissão de Notas** | `invoices`, `invoice_items` | ✅ Espelha `modules/notas-fiscais/types.ts` 1:1 |
| **Central de Alertas** | `alerts` | ✅ Espelha `modules/alertas/types.ts` 1:1, com geração automática a partir de `tax_obligations` e `digital_certificates` |
| **Portal do Cliente** | `portal_documents`, `portal_guides`, `portal_messages` | ✅ Espelha `modules/portal-cliente/types.ts` 1:1 |
| **Futura integração MIL RH IA** | — | `users`/`companies` já carregam tudo que um sistema de folha externo precisaria referenciar (CNPJ da empresa, contador responsável). Nenhuma tabela de folha foi criada aqui de propósito — o módulo `folha-pagamento` no frontend permanece placeholder, e seu schema deve nascer no banco do **futuro produto MIL RH IA**, não neste banco. A integração entre os dois produtos se daria via API entre serviços (cada um com seu próprio banco), usando `companies.cnpj` como chave de correlação — não FK direta entre bancos distintos. |

---

## 10. Estrutura de pastas

```
database/
├── ARCHITECTURE.md              # decisão arquitetural (shared schema + RLS)
├── README.md                    # este arquivo
├── erd/
│   └── erd.mmd                  # Entity Relationship Diagram (Mermaid)
└── migrations/
    ├── 001_extensions_and_enums.sql
    ├── 002_firms_and_users.sql
    ├── 003_companies.sql
    ├── 004_clients.sql
    ├── 005_tax_obligations.sql
    ├── 006_invoices.sql
    ├── 007_alerts.sql
    ├── 008_client_portal.sql
    ├── 009_subscriptions_and_billing.sql
    ├── 010_audit_log.sql
    ├── 011_row_level_security.sql
    └── 012_seed_roles_and_plans.sql
```
