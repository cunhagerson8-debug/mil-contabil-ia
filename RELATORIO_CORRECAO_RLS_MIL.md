# Relatório de correção do isolamento RLS — MIL Contábil IA

**Data:** 12/11/2026
**Status geral:** **PENDENTE — não pronto para produção multi-tenant.**
**Escopo desta etapa:** correções locais de código e preparação de SQL. Nenhuma
conexão com banco foi aberta nesta etapa, nenhuma migração ou alteração de
role/grant foi executada e nenhum dado ou credencial real foi alterado.

## 1. Diagnóstico inicial

**PENDENTE — configuração PostgreSQL:** foi informado que a conexão observada
usa `neondb_owner`, com `rolbypassrls=true` e `rolsuper=false`. O relatório
anterior [RELATORIO_AUDITORIA_MIL.md](./RELATORIO_AUDITORIA_MIL.md) também
registra esse estado e que `withTenantContext()` não assumia `mil_app`.
Esses dados não foram reconsultados nesta etapa porque não houve autorização
para acessar ou modificar o banco conectado.

**CORRIGIDO no código:** antes das alterações, o mesmo pool e a mesma conexão
eram usados por `withTenantContext()` e operações globais. Assim, a aplicação
confiava no contexto `SET LOCAL`, sem garantir que a role efetiva estivesse
sujeita ao RLS.

**CORRIGIDO no código; migração pendente:** as policies de RH verificavam
somente `firm_id`. Usuários restritos a uma empresa podiam listar colaboradores
de outras empresas do mesmo escritório.

**CORRIGIDO no código:** o middleware aceitava claims válidas do JWT sem
revalidar a situação, o escritório e o papel atuais do usuário.

**CORRIGIDO no código:** o job fiscal e o MIL Auditor faziam consultas diretas
ao pool operacional para operações globais.

**CORRIGIDO no código/migration preparada:** policies permissivas de escrita
permitiam operações além da matriz de permissões, incluindo exclusões por
accountant e atualizações de vínculos. A migration 018 substitui essas policies,
limita exclusões físicas a `firm_owner`, protege vínculos com triggers e
restringe atualizações de guias e alertas.

## 2. Achados e estado

| # | Severidade | Estado | Achado |
|---|---|---|---|
| 1 | 🟠 HIGH | **CORRIGIDO no código / PENDENTE no PostgreSQL** | Pool único para operações tenant e globais; a role da conexão informada podia ignorar RLS. |
| 2 | 🟠 HIGH | **CORRIGIDO no código / PENDENTE na migração e validação** | Leitura de RH limitada apenas ao escritório, sem restringir usuários de portal por empresa. |
| 3 | 🟡 MEDIUM | **CORRIGIDO no código** | Usuários suspensos/desativados ou com papel/escritório alterados continuavam válidos até o JWT expirar. |
| 4 | 🟠 HIGH | **CORRIGIDO no código / PENDENTE no PostgreSQL** | Job automático invocava função global pela conexão operacional. |
| 5 | 🟡 MEDIUM | **CORRIGIDO no código / PENDENTE no PostgreSQL** | MIL Auditor consultava metadados e dados globais diretamente pelo pool operacional. |
| 6 | 🟠 HIGH | **CORRIGIDO na migration 018 / PENDENTE no PostgreSQL** | Policies `FOR ALL` e policies permissivas permitiam escritas/exclusões e alterações de vínculos além das permissões previstas. |
| 7 | 🟠 HIGH | **CORRIGIDO na migration 018 / PENDENTE no PostgreSQL** | Políticas de leitura/escrita de dados relacionados precisam aplicar, além do escritório, o escopo de empresa atribuído ao usuário. |
| 8 | 🔴 CRITICAL | **CORRIGIDO no código / PENDENTE na migration 019 e validação PostgreSQL** | As policies confiavam em GUCs de identidade mutáveis; uma consulta SQL arbitrária podia falsificar usuário, escritório e papel. |

## 3. Arquivos modificados

- [server/src/db/pool.ts](./server/src/db/pool.ts) — separa pool operacional e
  administrativo.
- [server/src/db/withTenantContext.ts](./server/src/db/withTenantContext.ts) —
  assume `mil_app`, valida `session_user`, memberships, `BYPASSRLS`, superuser e
  propriedade; assina o contexto e o vincula ao PID e à transação. Operações de
  plataforma validam login/pool administrativo separado.
- [server/src/db/rlsContext.ts](./server/src/db/rlsContext.ts) — assina somente
  contextos tenant válidos com uma chave HMAC distinta do segredo JWT.
- [database/migrations/019_signed_rls_context.sql](./database/migrations/019_signed_rls_context.sql)
  — migration incremental preparada para validar contexto HMAC, substituir os
  helpers RLS/auditoria e proteger a chave em schema privado.
- [server/src/config/env.ts](./server/src/config/env.ts) e
  [server/.env.example](./server/.env.example) — exigem URLs distintas para as
  conexões, `RLS_CONTEXT_SECRET` separado e `MIGRATIONS_DATABASE_URL`.
- [server/src/middleware/requireAuth.ts](./server/src/middleware/requireAuth.ts)
  e [server/src/services/auth.service.ts](./server/src/services/auth.service.ts)
  — validam formato das claims e reconsultam status, escritório e papel atuais
  antes de autorizar cada requisição.
- [server/src/routes/employees.routes.ts](./server/src/routes/employees.routes.ts)
  — restringe a leitura de RH a papéis de escritório/portal conhecidos.
- [server/src/jobs/obligation-status.job.ts](./server/src/jobs/obligation-status.job.ts)
  — executa recálculo global somente na conexão administrativa.
- [server/src/services/mil-auditor.service.ts](./server/src/services/mil-auditor.service.ts)
  — usa leitura administrativa somente-leitura e revalida o administrador.
- [server/scripts/create-admin.mjs](./server/scripts/create-admin.mjs) — usa a
  conexão administrativa explicitamente e não sobrescreve conta/credencial já
  existente.
- [server/scripts/seed-demo-data.mjs](./server/scripts/seed-demo-data.mjs) —
  exige confirmação explícita, nome de banco de demo/teste e ausência de dados
  nas tabelas centrais antes de permitir o seed.
- [server/scripts/run-migrations.mjs](./server/scripts/run-migrations.mjs) e
  [database/README.md](./database/README.md) — exigem conexão própria de
  migração, separada da API; o runner injeta a chave da migration 019 por bind
  parametrizado sem imprimi-la.
- [server/tests/tenant-security.test.ts](./server/tests/tenant-security.test.ts)
  — adiciona testes unitários de guardas, contexto, autorização e autenticação.
- [server/tests/rls-context.integration.test.ts](./server/tests/rls-context.integration.test.ts)
  — integração opcional, limitada ao banco local `mil_contabil_teste` na porta
  5434; prepara fixtures fictícias, testa adulteração, acesso cruzado,
  `RESET ROLE` e reuso de conexão, e remove as fixtures ao final.
- [server/tests/invitation.test.ts](./server/tests/invitation.test.ts) e
  [server/tests/firm-onboarding.test.ts](./server/tests/firm-onboarding.test.ts)
  — adaptam os mocks ao pool administrativo separado.
- [database/migrations/017_hr_company_access.sql](./database/migrations/017_hr_company_access.sql)
  — migração preparada com leitura de RH por empresa, escrita restrita à equipe
  e grants das tabelas novas.
- [database/migrations/018_rls_policy_hardening.sql](./database/migrations/018_rls_policy_hardening.sql)
  — nova migração incremental preparada para políticas de empresas, sócios,
  clientes, obrigações, notas, portal, RH, alertas, auditoria, exclusões e
  alterações de vínculos.
- [server/src/services/client.service.ts](./server/src/services/client.service.ts),
  [server/src/services/company.service.ts](./server/src/services/company.service.ts)
  e [server/src/services/employee.service.ts](./server/src/services/employee.service.ts)
  — negam alterações de vínculos por usuários que não sejam `firm_owner`.
- [server/src/routes/clients.routes.ts](./server/src/routes/clients.routes.ts),
  [server/src/routes/taxObligations.routes.ts](./server/src/routes/taxObligations.routes.ts)
  e [server/src/routes/employees.routes.ts](./server/src/routes/employees.routes.ts)
  — exclusões não são autorizadas para o papel `accountant`.
- [server/tests/rls-hardening.test.ts](./server/tests/rls-hardening.test.ts)
  — testes locais estáticos e unitários para a migration e negação de alteração
  de vínculos.
- [database/operations/rls_role_setup.sql](./database/operations/rls_role_setup.sql)
  — SQL preparado para memberships de logins separados, sem senhas.
- [database/operations/rls_isolation_test.sql](./database/operations/rls_isolation_test.sql)
  — teste SQL negativo de GUC/token falsificados e falha fechada.
- [database/operations/rls_login_role_check.sql](./database/operations/rls_login_role_check.sql)
  — verificação somente-leitura dos logins operacionais/administrativos por
  conexão local.
- [RELATORIO_CORRECAO_RLS_MIL.md](./RELATORIO_CORRECAO_RLS_MIL.md) — este
  relatório.

## 4. Correções implementadas

### Conexões e RLS

- `DATABASE_URL` é operacional; `ADMIN_DATABASE_URL` é obrigatório e distinto.
- Cada transação tenant executa `SET LOCAL ROLE mil_app`, valida que a role
  efetiva e o `session_user` correspondem aos logins operacionais esperados,
  sem `BYPASSRLS`, superuser, memberships extras ou propriedade de tabelas com
  RLS. O backend assina usuário/escritório/papel e vincula o token ao PID,
  database, login e ID da transação antes de chamar o setter verificador.
- Cada operação global usa `adminPool`, executa
  `SET LOCAL ROLE mil_platform_admin` e confirma que a role é `BYPASSRLS`, mas
  não superuser. A role privilegiada é escopo da transação, não da conexão
  operacional.
- Contexto tenant sem `firmId` e papel `platform_admin` são recusados antes de
  obter conexão.
- O encerramento fecha ambos os pools.
- O runner de migrations não aceita mais `DATABASE_URL`; requer
  `MIGRATIONS_DATABASE_URL`.

**PENDENTE:** confirmar no banco real os logins, memberships, grants,
propriedade de tabelas, policies e autenticação de ambos os pools. Código e
testes unitários não comprovam que o PostgreSQL conectado aplica as policies.

### RH, autenticação e jobs

- A migração 017 substitui policies de RH: equipe do escritório acessa seu
  escritório; usuários de portal leem somente empresas em
  `user_company_access`; escritas permanecem restritas a `firm_owner` e
  `accountant`; valida também a relação entre empresa, escritório e
  departamento.
- O middleware de autenticação consulta o usuário atual em cada requisição e
  rejeita conta inativa, claims de role/escritório obsoletas e claims mal
  formadas.
- O recálculo automático foi movido para transação administrativa. A função é
  global por natureza; permanece autorizada a atualizar obrigações de todos os
  escritórios como manutenção sistêmica, mas não lê nem retorna dados de
  clientes.
- O MIL Auditor usa transações administrativas somente-leitura e revalida o
  `platform_admin` no banco antes de cada consulta global.
- O script de bootstrap não atualiza credenciais existentes; exige endereço e
  nome explicitamente fornecidos e usa `ADMIN_DATABASE_URL`.

### Hardening das policies (migration 018 — não executada)

- Substitui policies antigas permissivas de empresas, sócios, certificados,
  clientes e registros filhos, obrigações, notas fiscais/itens, portal e RH;
  leitura/escrita considera o firm e, quando aplicável, a carteira de empresas.
- Restringe `user_company_access` a leitura própria ou do `firm_owner`, e
  inserção/alteração/exclusão somente por `firm_owner`.
- Permite exclusões físicas somente a `firm_owner`; triggers também impedem
  soft delete de empresas, clientes e colaboradores por outros papéis.
- Protege os campos de vínculo contra alteração por usuários operacionais e
  aplica validações de autorização equivalentes nas rotas de serviço para
  cliente, empresa e colaborador.
- Limita atualização de guias por `company_manager` ao pagamento de guia de
  empresa com permissão `can_manage`; restringe atualizações de alertas à ação
  de marcar como lido.
- Move gravações de auditoria para funções `SECURITY DEFINER` com `search_path`
  fixo e remove INSERT direto da role `mil_app`.
- **PENDENTE:** a migration precisa ser aplicada em ambiente isolado e testada
  com `mil_app_login` real antes de qualquer ativação em produção.

### Contexto RLS assinado (migration 019 — não executada)

- O backend usa identidade/escritório/papel revalidados pelo middleware e assina
  um payload com HMAC-SHA256. O payload é vinculado ao backend PID, database,
  `session_user`, ID da transação e expiração curta.
- O PostgreSQL mantém a chave em tabela privada pertencente a
  `mil_context_owner` (`NOLOGIN`, `NOINHERIT`, sem `BYPASSRLS` ou memberships).
  Uma função `SECURITY DEFINER` de `search_path` fixo verifica HMAC e vínculo;
  os helpers RLS retornam somente claims verificadas. O setter aceita somente
  tokens assinados, mas a segurança não depende de impedir `set_config`.
- O backend neutraliza os GUCs legados na transação, mas não os usa como
  identidade. Alterá-los não muda o resultado dos helpers novos;
  token inválido/expirado retorna contexto nulo.
- O pool operacional valida também `session_user = mil_app_login`, role efetiva
  `mil_app`, ausência de memberships adicionais, superuser, `BYPASSRLS` e
  propriedade de tabelas RLS. A conexão administrativa mantém pool e login
  próprios, com autorização HTTP/service preservada.
- O runner passa `RLS_CONTEXT_SECRET` à migration 019 por parâmetro, sem
  interpolação no SQL. Fazer rollout em janela coordenada: pausar tráfego
  tenant, aplicar 019, publicar a versão que assina contextos e só então
  retomar. A migration aplicada antes do novo código faz o código antigo
  falhar fechado; a nova versão não deve ser publicada antes da migration,
  pois helpers históricos ainda confiam nos GUCs. Não é compatível fazer
  rollout misto sem janela.
- **PENDENTE:** validar no PostgreSQL isolado a sintaxe/ownership da função,
  bootstrap seguro do segredo, grants, compatibilidade Neon e custo de HMAC.
  Não executar a migration antes dessa validação e aprovação do alvo.

## 5. Testes e verificações

| Verificação | Resultado | Limite |
|---|---|---|
| `npm.cmd run build` em `server/` | **Passou** | Compilação TypeScript. |
| `npm.cmd run build` na raiz | **Passou** | Vite reportou chunk `App` de ~1,09 MB acima do aviso de 500 kB. |
| `npx.cmd tsc --noEmit` na raiz | **Passou** | Verificação de tipos do frontend. |
| `npm.cmd test` em `server/` | **45 passaram, 0 falharam, 1 ignorado** | Testes `node:test`, mocks e contrato estático; integração real foi ignorada porque não foi configurada e não conecta ao PostgreSQL. |
| `npm.cmd run build` em `server/` (após o hardening) | **Passou** | Compilação TypeScript e verificação de tipos. |
| Contrato estático da migration 018 e negação de mudanças de vínculo por accountant | **Passou** | Não comprova execução efetiva de policies no PostgreSQL. |
| Integração PostgreSQL para adulteração, 2 escritórios, role reset e pool reuse | **Preparada; ignorada/não executada** | Requer migrations 001–019 e roles/logins locais aprovados. |
| `node --check` nos scripts de bootstrap, seed e migrations | **Passou** | Verificação de sintaxe JavaScript; scripts não foram executados. |
| Role operacional recusa `BYPASSRLS` ou propriedade de tabela protegida | **Passou em teste unitário** | Atributos PostgreSQL foram simulados pelo mock. |
| Pool administrativo distinto e role administrativa por transação | **Passou em teste unitário** | Não valida memberships/credenciais reais. |
| Reutilização de conexão e novos tokens vinculados por transação | **Passou em teste unitário** | Não substitui teste com conexão PostgreSQL real. |
| Usuário desativado ou role obsoleta | **Passou em teste unitário** | Usuário e consultas foram simulados. |
| Escritório A não lê B / B não altera A / consulta sem contexto não expõe dados | **PENDENTE** | Exige PostgreSQL isolado, migrações aplicadas e papel real sem `BYPASSRLS`. |
| Jobs, permissões e operações legítimas no PostgreSQL real | **PENDENTE** | Nenhum banco foi acessado. |

Nenhum resultado de teste PostgreSQL foi simulado ou declarado como aprovado.
O build e os testes locais não demonstram isolamento real entre escritórios.

### Plano de validação real preparado

`rls_isolation_test.sql` agora é um teste SQL negativo pequeno: sob
`mil_app_login`, define os GUCs legados e um token forjado e exige contexto nulo
e zero linhas visíveis; termina com `ROLLBACK`. Não cria fixtures.

`server/tests/rls-context.integration.test.ts` é a integração de dois
escritórios. Com URLs locais explicitamente autorizadas, cria fixtures
fictícias com uma transação administrativa, testa leitura/escrita cruzada,
GUCs adulterados, token adulterado/expirado, acesso à tabela de segredo,
`RESET ROLE` e reuso da conexão; remove os registros de teste em `finally`.
O teste fica ignorado sem configuração e recusa host não-loopback, banco,
porta ou login inesperados. Não foi executado.

`rls_login_role_check.sql` é executado em conexões separadas, com senha
solicitada interativamente pelo `psql`; confirma `session_user`, atributos do
login, memberships e a role efetiva após `SET LOCAL ROLE`. Não imprime nem
armazena senhas.

**Status da correção de contexto:** o código local já assina o contexto após a
revalidação HTTP e a migration 019 troca os helpers para HMAC validado, ligado
ao banco, sessão, PID e transação. As variáveis legadas não são consultadas
pelas novas funções; SQL arbitrário que apenas as altera não muda a identidade.
O mecanismo continua **pendente de comprovação PostgreSQL**; não declare o
isolamento provado até a migration e a integração passarem com os logins reais
de teste sem `BYPASSRLS`.

#### Matriz e comandos propostos (não executados)

| Cenário | Resultado exigido |
|---|---|
| Accountant A com carteira A1 lista A1, mas não A2 nem B1; leitura de clientes, obrigações e notas também fica restrita | Só linhas autorizadas de A |
| Accountant B com carteira B1 lista B1, mas não A1 | Só linhas autorizadas de B |
| Firm owner A lê e pode excluir A2, mas não lê B1 | Ação local permitida; B negado |
| Accountant altera campo comum autorizado, mas não exclui nem altera vínculos | Atualização normal permitida; DELETE sem linhas e vínculo negado |
| Company user A lê A1 e não altera/exclui a empresa | Leitura A1; escritas negadas |
| `mil_app` efetiva e login operacional | Sem SUPERUSER, BYPASSRLS, ownership RLS ou memberships adicionais; `RESET ROLE` volta ao login sem privilégio de dados |
| `mil_platform_admin` | BYPASSRLS apenas na role administrativa, sem SUPERUSER; visão global para a role autorizada |
| Manipulação de `app.current_*` ou token forjado/expirado | Helpers nulos e nenhuma expansão de escopo |
| Reutilização de pool | Mesmo backend recebe novo vínculo de transação; A nunca vê B |
| Cadeia de migrations | Todos os arquivos 001–019 registrados e funções/policies críticas presentes |

Após autorização específica para o banco local, e somente depois de aplicar
as migrations e configurar os logins nesse ambiente:

```powershell
# Executar de um shell local; -W solicita a senha sem incluí-la no comando.
psql -X -h 127.0.0.1 -p 5434 -U mil_app_login `
  -d mil_contabil_teste -W -v ON_ERROR_STOP=1 `
  -f database\operations\rls_isolation_test.sql

psql -X -h 127.0.0.1 -p 5434 -U mil_app_login `
  -d mil_contabil_teste -W -v expected_login_role=mil_app_login `
  -f database\operations\rls_login_role_check.sql

psql -X -h 127.0.0.1 -p 5434 -U mil_platform_login `
  -d mil_contabil_teste -W -v expected_login_role=mil_platform_login `
  -f database\operations\rls_login_role_check.sql

# Para a integração Node, provisionar as três variáveis RLS_TEST_* somente no
# shell local autorizado; o teste valida URL/host/porta/login antes de conectar.
node --import tsx --test tests/rls-context.integration.test.ts
```

O comando de migração, também **somente após autorização**, é
`npm.cmd --prefix server run migrate` com `MIGRATIONS_DATABASE_URL` configurada
para `127.0.0.1:5434/mil_contabil_teste` por mecanismo local aprovado. O runner
aplica todas as migrations pendentes; num banco vazio, executará 001–018,
incluindo o catálogo fixo de planos da migration 012. Não usar seed de
demonstração. A migration 018 e os scripts de teste continuam sem execução.

**Aprovação:** todas as asserções de isolamento/roles devem passar, testes de
adulteração de contexto devem ser bloqueados, `psql` deve terminar com código
zero, fixtures devem ter sido revertidas e as consultas finais devem confirmar
ausência dos IDs de teste. Qualquer falha, especialmente a de GUC, reprova a
validação e impede promoção.

## 6. SQL preparado, não executado

1. **`database/migrations/017_hr_company_access.sql` — PENDENTE.** Substitui
   policies de RH e concede privilégios necessários às tabelas de RH. Deve
   ser aplicada pelo runner de migrations autorizado somente
   após verificar que 015 e 016 estão aplicadas e que o alvo é o banco correto.
2. **`database/migrations/018_rls_policy_hardening.sql` — PENDENTE.**
   Substitui policies permissivas e adiciona guards de vínculo, exclusão,
   atualização de guia/alerta e auditoria. Depende das tabelas/funções das
   migrations 001–017; deve ser aplicada somente após validar a versão,
   permissões, ownership, estado das policies e backup restaurável.
3. **`database/operations/rls_role_setup.sql` — PENDENTE.** Prepara roles
   `NOLOGIN` de conexão e memberships em `mil_app` e `mil_platform_admin`.
   Não cria nem altera senhas e não habilita `LOGIN`; a ativação e autenticação
   devem ser configuradas separadamente pelo responsável do PostgreSQL.
4. **`database/migrations/019_signed_rls_context.sql` — PENDENTE.** Exige
   `RLS_CONTEXT_SECRET` separado de `JWT_SECRET`, armazenado no schema privado
   de uma role `mil_context_owner` `NOLOGIN`. O runner injeta a chave em bind
   parametrizado e aborta se ela estiver ausente/curta; execução manual sem o
   setting também falha. A migration não foi executada.

### Finalidade e riscos

- `mil_app_login` pode assumir apenas `mil_app`; `mil_platform_login` pode
  assumir `mil_platform_admin`. A segunda role tem `BYPASSRLS`; seu login deve
  ser isolado, acessível somente pela API e protegido por rede/segredo.
- Uma role administrativa comprometida pode ler ou alterar dados globais.
- A migration 017 altera regras de visibilidade de RH; usuários de portal
  passarão a receber somente linhas de empresas vinculadas.
- Não executar contra o banco conectado sem autorização, backup verificado,
  revisão dos privilégios existentes e confirmação do responsável pelo alvo.

### Verificações prévias recomendadas

- Confirmar nome/ambiente do banco, backup recuperável e histórico das
  migrations 001–018; não imprimir URLs ou segredos.
- O runner aplica todas as migrations ainda não registradas, em ordem. Não o
  execute contra um banco que não tenha as migrations 001–017 confirmadas, pois
  ele também tentará executar as anteriores pendentes.
- Consultar `pg_roles` para confirmar `mil_app` como `NOLOGIN`,
  `NOSUPERUSER`, `NOBYPASSRLS`; confirmar `mil_platform_admin` como `NOLOGIN`,
  `NOSUPERUSER`, `BYPASSRLS`.
- Verificar proprietários de tabelas com RLS e que `mil_app` não possua
  tabelas protegidas; conferir RLS/policies, grants, memberships e acesso
  `CONNECT`/`USAGE`.
- Validar os papéis em uma base de testes segregada e aprovada antes de
  configurar os pools da aplicação.

### Reversão

- Não restaurar a conexão operacional para `neondb_owner` ou qualquer papel
  com `BYPASSRLS`. Se a implantação do código falhar, suspender o tráfego ou
  reverter apenas para uma versão compatível com role operacional sem bypass.
- Não reverter as policies de RH para a policy anterior, que permitia leitura
  de RH por todo o escritório. Corrigir por nova migration aditiva.
- Se memberships precisarem ser desativadas, primeiro parar todas as instâncias
  e confirmar ausência de conexões ativas; o DBA pode revogar
  `mil_app FROM mil_app_login` e
  `mil_platform_admin FROM mil_platform_login`, e manter os logins `NOLOGIN`.
  Não remover roles, tabelas ou dados como procedimento de rollback.

### Procedimento específico para a migration 018 (ainda não executado)

**Aprovação exigida:** validar e aprovar separadamente o alvo, o backup
recuperável, a janela, as credenciais de migração e a execução. A seleção de
qualquer ação neste chat não substitui essa autorização.

1. **Preparar o ambiente:** primeiro restaurar um backup recente em branch/banco
   isolado, sem conexão à produção. Confirmar que contém somente dados
   autorizados e fixtures fictícias. Nunca usar o seed de demonstração em banco
   com dados existentes. O PostgreSQL de teste atual está vazio; portanto, seu
   runner aplicaria toda a cadeia pendente, não apenas 018.
2. **Backup prévio ao ambiente real:** criar snapshot/branch do provedor ou
   `pg_dump` completo (schema e dados), armazenado em local privado e
   criptografado. Registrar tamanho, horário e hash; restaurar em outro banco
   isolado e validar tabelas, contagens e leitura antes de considerar o backup
   recuperável. Não colocar a URL ou senha na linha de comando, logs ou relatório.
3. **Preflight somente leitura:** conferir `current_database()`,
   `current_user`, `session_user`; estado das roles/memberships; owner e
   `relrowsecurity` das tabelas; existência e status das migrations 001–017;
   policies e triggers atuais; extensões; grants de tabelas/sequências/schema.
   Não prossiga se o alvo ou o histórico divergirem do esperado.
4. **Validar roles e credenciais:** a conexão de migration deve ser aprovada e
   distinta de `DATABASE_URL` e `ADMIN_DATABASE_URL`; o arquivo
   `.env.example` nomeia `mil_migration_login`, que não é criado pelo
   `rls_role_setup.sql`, então esse login precisa ser provisionado e revisado
   separadamente pelo DBA. Não use `neondb_owner` como role operacional.
5. **Aplicar primeiro em isolamento:** somente após autorização, usar o runner
   com `MIGRATIONS_DATABASE_URL` para um banco que tenha 001–017 aplicadas e
   registradas. O runner envolve cada arquivo em `BEGIN`/`COMMIT`, registra o
   nome em `schema_migrations` e faz `ROLLBACK` se o SQL falhar. Ele aplica
   qualquer migration anterior pendente também; interromper se o preflight não
   comprovar a ordem.
6. **Testar antes de considerar a migração válida:** conectar como login
   operacional membro de `mil_app`, confirmar a role efetiva e testar duas
   firmas/empresas fictícias: leitura cruzada negada, alteração/exclusão
   cruzada negada, accountant sem poder alterar vínculos ou excluir, usuário
   comum sem acesso administrativo, consulta sem contexto vazia/negada,
   conexão reutilizada sem herdar contexto, manager só marcando guia como paga
   com `can_manage`, leitura/atualização de alertas somente no escopo e
   auditoria automática preservada. Confirmar também fluxos permitidos de
   cadastro/edição por usuário autorizado e o job global executado apenas pela
   role administrativa aprovada.
7. **Critério para promoção:** revisar os resultados reais e os logs, confirmar
   ausência de grants/ownership inesperados e obter aprovação independente
   antes de promover o mesmo artefato/migration ao ambiente seguinte. A
   migration 018, sozinha, não comprova o isolamento.
8. **Reversão segura:** se 018 falhar dentro do runner, a transação daquela
   migration deve ser revertida e a execução deve parar; não marque a migration
   manualmente como aplicada. Se for aplicada e um fluxo legítimo falhar,
   interrompa a promoção e prefira uma migration corretiva 019 após diagnóstico.
   Não recrie as policies permissivas antigas nem reabilite `BYPASSRLS` para a
   API. Como 018 é DDL de policies, triggers, funções e grants e não altera
   linhas de negócio, restauração completa do backup é último recurso: pode
   descartar dados gravados após o snapshot e exige aprovação explícita.

#### Consultas de preflight propostas (somente leitura; não executadas)

```sql
SELECT current_database(), current_user, session_user;

SELECT rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit
FROM pg_roles
WHERE rolname IN (
  'mil_app_login', 'mil_platform_login', 'mil_app', 'mil_platform_admin',
  'mil_migration_login'
)
ORDER BY rolname;

SELECT filename, applied_at
FROM schema_migrations
ORDER BY filename;

SELECT n.nspname, c.relname, pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relrowsecurity
ORDER BY c.relname;
```

Essas consultas devem ser executadas pelo responsável do banco somente após
aprovar o ambiente. Elas não aplicam mudanças e não substituem a revisão dos
grants, memberships, funções, policies e triggers.

## 7. Ativação segura das conexões

1. Validar e aplicar, com autorização explícita, as migrations necessárias no
   ambiente alvo por `MIGRATIONS_DATABASE_URL`; não usar a conexão da API.
   Proteger a chave contra logs de parâmetros do PostgreSQL e manter segredo
   separado por ambiente.
2. Validar e executar o script de memberships após 019, configurar autenticação
   dos logins fora do código e ativar `LOGIN` somente após revisar rede e acesso.
3. Configurar `DATABASE_URL` com login membro de `mil_app` e
   `ADMIN_DATABASE_URL` com login separado membro de `mil_platform_admin`.
   Guardar URLs e `RLS_CONTEXT_SECRET` em secret manager; não imprimir nem
   registrar valores.
4. Inicializar a API em ambiente isolado. Confirmar nos logs/consultas
   controladas que a role operacional efetiva é `mil_app`, sem superuser,
   `BYPASSRLS` ou propriedade de tabelas protegidas, e que a role administrativa
   só é assumida em transação administrativa.
5. Executar `server/tests/rls-context.integration.test.ts` com URLs locais
   explícitas para `127.0.0.1:5434/mil_contabil_teste` e a chave local. O teste
   recusa outros hosts, bancos, portas e logins; inclui dados fictícios,
   leitura/escrita cruzada, adulteração, `RESET ROLE` e reuso de conexão.
   Validar também as operações administrativas autorizadas e jobs. Só então
   considerar aprovação operacional.

## 8. Riscos remanescentes e prontidão

- **PENDENTE:** estado atual de `neondb_owner`, catálogo, políticas, ownership e
  grants não foi revalidado.
- **PENDENTE:** migrations 017/018/019 e configuração de memberships/logins
  ainda não foram aplicadas; as variáveis de conexão reais não foram alteradas.
- **PENDENTE:** testes reais com papel sem `BYPASSRLS` e dois escritórios não
  foram executados. O isolamento multi-tenant **não está comprovado**.
- **🔴 CRITICAL / CORRIGIDO LOCALMENTE; PENDENTE NO POSTGRESQL:** as policies
  da migration 019 verificam HMAC, expiração, PID e ID da transação. As
  variáveis GUC legadas são ignoradas; auditoria usa o helper verificado.
  Essa proteção ainda não foi comprovada em PostgreSQL.
- **🟠 HIGH / PENDENTE:** o custo de verificar HMAC em funções RLS por consulta,
  a semântica de `CREATE ROLE`/`SET ROLE` no Neon, a criação/ownership do schema
  privado, os grants e o logging de parâmetros da migration precisam ser
  validados no banco local de testes.
- **🟡 MEDIUM / PENDENTE:** rotação de `RLS_CONTEXT_SECRET` não é automatizada;
  exige procedimento coordenado entre API, migration e todos os processos.
- **NÃO VERIFICADO:** o banco em `.env`, histórico Git, Railway/produção e
  configuração de secrets; Git não está disponível nesta sessão.
- **NÃO EXECUTADO:** seed de demonstração, migrations, DDL, DML, alteração de
  permissões, rotação de credenciais ou deploy.
- O script de seed de demonstração foi endurecido, inspecionado e não executado.
  Continua restrito a uma base explicitamente demo/teste, vazia e confirmada;
  nunca deve ser apontado para banco com dados existentes.

**Conclusão:** a correção local para a falsificação de GUC foi implementada e
validada por testes unitários/build; o sistema **não está pronto para produção
multi-tenant** até a migration 019 ser aplicada em ambiente isolado autorizado,
os logins serem comprovados e os testes reais passarem.
