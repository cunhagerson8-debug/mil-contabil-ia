# MIL Contábil IA — Banco de Dados

PostgreSQL · Shared Database + Shared Schema · Row-Level Security · Multi-tenant em dois níveis (`firm` → `company`)

Ver decisão arquitetural completa em [`ARCHITECTURE.md`](./ARCHITECTURE.md).
Este documento descreve as migrations 001–020. A aplicação de cada migration
depende do ambiente; confira `schema_migrations` antes de qualquer operação.
A migration 020 está preparada e não foi executada por esta alteração.

---

## 1. Como aplicar as migrations

Use somente uma conexão administrativa de migração aprovada. A API usa
`DATABASE_URL` para tráfego operacional e não deve receber privilégios de DDL.
O runner da API exige `MIGRATIONS_DATABASE_URL` e não usa `DATABASE_URL`.

```bash
cd server
npm run migrate
```

Não execute migrations em um banco conectado sem autorização, backup e revisão
do alvo. O runner executa **todas** as migrations pendentes em ordem, não apenas
a última; confirme as dependências anteriores antes de aplicar migrations.
020 depende das estruturas de RLS de 018 e do contexto assinado de 019. A
migration 019 também exige `RLS_CONTEXT_SECRET` no ambiente do runner. As
migrations são sequenciais; não há `DOWN`/rollback automatizado.
O arquivo [`operations/rls_role_setup.sql`](./operations/rls_role_setup.sql)
prepara memberships de login, mas não foi executado e não define credenciais.
Para implantar 019, pause o tráfego tenant, aplique a migration e publique a
versão da API que assina contextos antes de retomar. A API nova não deve operar
contra helpers históricos: eles ainda confiam nos GUCs legados. A versão antiga
após 019 falha fechada até ser substituída.

A migration 020 move CPF e salário de `hr_employees` para
`hr_employee_sensitive_data` dentro de uma transação e revoga a leitura ampla
da tabela-base. O backend desta versão depende desse novo schema; por isso,
não há compatibilidade de execução entre esta migration e a versão anterior da
API. Em uma futura aplicação autorizada, pause o tráfego e pare a API local,
aplique as migrations pendentes, publique o backend/frontend correspondentes e
somente então retome o tráfego. Não deixe versões antiga e nova da API atenderem
simultaneamente durante a mudança. O rollback manual está em
[`operations/rollback_020_hr_permissions.sql`](./operations/rollback_020_hr_permissions.sql),
fora do runner automático; ele exige que não haja concessões RH ativas e
restaura CPF/salário sem reabrir o acesso de portal.

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
| 013 | `tax_obligations_deleted_at.sql` | Exclusão lógica de obrigações |
| 014 | `tax_obligations_new_schema.sql` | Compatibilidade do novo esquema fiscal |
| 015 | `hr_management.sql` | Tabelas de RH |
| 016 | `user_invitations.sql` | Convites e ativação de usuários |
| 017 | `hr_company_access.sql` | RLS de RH por empresa e grants operacionais |
| 018 | `rls_policy_hardening.sql` | Restringe policies, exclusões, alterações de vínculos, guias, alertas e auditoria |
| 019 | `signed_rls_context.sql` | Contexto HMAC ligado à transação, funções RLS verificadoras e atribuição segura de ator na auditoria |
| 020 | `hr_permissions.sql` | Permissões RH por usuário/empresa e separação de CPF/salário sob RLS; preparada, não executada nesta alteração |

---

## 2. Tabelas (31 após a migration 020) e domínio

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
| **Gestão de RH** | `hr_departments`, `hr_employees`, `hr_employee_sensitive_data`, `hr_employee_documents`, `hr_vacations`, `hr_leaves`, `user_company_hr_permissions` |
| **Convites** | `user_invitations` |

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
- **Contexto de sessão para RLS**: após autenticar o usuário e revalidar no
  banco seu estado, escritório e papel, o backend assina esses claims com
  `RLS_CONTEXT_SECRET`, vinculando o token ao PID da conexão e ao ID da
  transação PostgreSQL. Ele envia o token a
  `app_private.set_rls_context($1)`. As funções
  `app_current_user_id()`, `app_current_firm_id()` e `app_current_role()`
  retornam valores somente depois de verificar HMAC, expiração e vínculo à
  transação. As policies não confiam mais nos GUCs legados
  `app.current_user_id`, `app.current_firm_id` ou `app.current_role`.
- `SET LOCAL`/`set_config` limitam escopo e vazamento em pools, mas **não são
  mecanismos de autenticação**: GUCs customizados podem ser alterados por
  SQL executado como a role conectada. Contextos forjados ou expirados falham
  fechados. A chave deve ser aleatória, exclusiva por ambiente, independente
  de `JWT_SECRET` e conter pelo menos 32 bytes.

## 5. Roles (papéis de usuário — coluna `role`, enum `user_role`)

| Role | Escopo | Acesso |
|---|---|---|
| **Platform Admin** | Global (firm_id NULL) | Gerencia `firms`, `plans`; suspende/ativa tenants; billing agregado. Usa role de banco `mil_platform_admin` (`BYPASSRLS`). |
| **Accounting Firm Owner** (`firm_owner`) | Próprio firm | Acesso total: cria/edita/exclui `companies`, `clients`; convida/remove `users`; único role que pode `DELETE`; vê billing e `audit_logs` do escritório. |
| **Accountant** | Próprio firm (carteira opcional via `user_company_access`) | Operacional: cria/edita `companies`, `clients`, `tax_obligations`, `invoices`. Sem acesso a billing/auditoria do firm, sem `DELETE`. |
| **Company Manager** (`company_manager`) | Empresa(s) vinculada(s) em `user_company_access` | Portal do Cliente com permissão de gestão: lê dados da própria empresa, envia mensagens, marca guias como pagas (`can_manage = true`). |
| **Company User** (`company_user`) | Empresa(s) vinculada(s) | Portal do Cliente, leitura/operação limitada (`can_manage = false` — aplicação esconde ações de gestão). |

Distinção de role de **banco** (Postgres) vs role de **aplicação** (enum
`user_role`): a API usa pools e logins separados. O pool operacional assume
`mil_app` dentro de cada transação tenant e exige `session_user =
mil_app_login`, login `NOINHERIT` sem memberships adicionais, e role efetiva
não-superuser, sem `BYPASSRLS`, memberships ou propriedade de tabelas protegidas.
O pool administrativo assume `mil_platform_admin` somente dentro de uma
transação privilegiada e revalidada; essa role tem `BYPASSRLS`, não é login nem
superuser. O login deve ser `mil_platform_login`, `NOINHERIT` e membro somente
de `mil_platform_admin`. Nunca configure `DATABASE_URL` com um login
administrativo.
`mil_context_owner` é `NOLOGIN`, `NOINHERIT`, sem `BYPASSRLS` e sem memberships;
possui somente o schema privado de verificação e a chave HMAC, sem tabelas de
negócio. A migration 019 recebe a chave por bind parametrizado do runner e a
persiste sem conceder acesso a `mil_app`. Não altere a chave sem procedimento
de rotação coordenado.
O enum `user_role` determina *o que* cada policy libera dentro de `mil_app`.

---

## 6. Modelo de segurança multi-tenant (RLS)

### Por que dois níveis de tenancy

O tenant raiz é o **escritório contábil** (`firm`), não a empresa-cliente. Um firm atende N companies. Isso exige isolamento em duas camadas simultâneas:

1. **Nível 1 — `firm_id`**: nenhum escritório vê dados de outro escritório. Toda tabela de negócio carrega `firm_id` direto ou via FK ascendente (`EXISTS` até achar a tabela que tem `firm_id`).
2. **Nível 2 — `company_id` + `user_company_access`**: dentro do mesmo firm, restringe o que cada usuário do Portal do Cliente vê (só suas próprias empresas) e, opcionalmente, restringe a carteira de um `accountant` específico.

### Como isso é aplicado

- RLS **habilitado em todas as 23 tabelas**.
- RLS habilitado nas tabelas definidas pelas migrations 011, 015 e 016.
- Policies cobrem `SELECT`/`INSERT`/`UPDATE`/`DELETE` conforme a tabela; a migration 017 subdivide o acesso às tabelas de RH por empresa.
- Tabelas sem `firm_id` direto (`company_partners`, `digital_certificates`, `client_contacts`, `client_documents`, `client_history_entries`, `invoice_items`, `portal_documents`, `portal_guides`, `portal_messages`, `user_company_access`, `refresh_tokens`, `user_invitations`, `hr_employee_documents`, `hr_vacations`, `hr_leaves`) usam `EXISTS` contra a tabela pai para herdar o isolamento — nunca duplicam `firm_id` redundantemente quando o JOIN ascendente já garante o filtro.
- **Falha seca por padrão**: RLS nega por padrão qualquer linha sem policy explícita — um bug de aplicação não pode "esquecer o WHERE" e expor dados de outro tenant, porque o banco filtra independentemente da query.
- `plans` é a única tabela deliberadamente global (catálogo comercial, sem isolamento por firm).
- Tabelas de billing (`subscriptions`, `platform_invoices`, `usage_counters`, `audit_logs`) são visíveis apenas a `firm_owner` — `accountant` não vê o que o escritório paga à plataforma nem o log de auditoria completo.
- A integração de dois escritórios está em
  `server/tests/rls-context.integration.test.ts`. Ela é ignorada na suíte
  padrão; só roda com URLs fornecidas explicitamente e recusa qualquer host
  fora de loopback, banco diferente de `mil_contabil_teste`, porta diferente
  de `5434` ou login diferente de `mil_app_login`/`mil_platform_login`.
  Quando autorizada e executada, cria fixtures fictícias e as remove ao final.

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
├── operations/
│   ├── rls_role_setup.sql       # memberships preparadas (não executadas)
│   ├── rls_isolation_test.sql   # adulteração GUC/token e falha fechada
│   └── rls_login_role_check.sql # valida logins/roles por conexão local
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
    ├── 012_seed_roles_and_plans.sql
    ├── 013_tax_obligations_deleted_at.sql
    ├── 014_tax_obligations_new_schema.sql
    ├── 015_hr_management.sql
    ├── 016_user_invitations.sql
    ├── 017_hr_company_access.sql
    ├── 018_rls_policy_hardening.sql
    └── 019_signed_rls_context.sql
```
