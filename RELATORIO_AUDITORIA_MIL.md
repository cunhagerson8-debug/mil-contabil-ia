# Relatório de Auditoria — MIL Contábil IA

**Data:** 11/11/2026
**Escopo:** inspeção do frontend, API, configurações, scripts e migrações; consultas PostgreSQL somente leitura. Nenhum seed, migração ou comando de escrita foi executado; nenhuma credencial foi alterada.

## 1. Estado atual

**Confirmado:** frontend React/Vite e API Express/TypeScript têm caminhos de integração REST. O build do frontend e a compilação da API passam. Há uma configuração PostgreSQL local em `server/.env`; os valores não foram exibidos nem incluídos neste relatório.

**Risco impeditivo para produção multi-tenant:** a conexão PostgreSQL observada tem `BYPASSRLS=true`. A conexão é membro de `mil_app`, mas não tem permissão efetiva `SET`/`USAGE` para assumir essa role. `withTenantContext` define `app.current_*`, mas não troca a role da conexão. Além disso, `companyRepository.findAll` e `clientRepository.findAll` não incluem filtro `firm_id` e dependem de RLS. Portanto, essas consultas podem atravessar tenants usando a conexão atual. A aplicação não deve ser considerada isolada por tenant até a role/acesso ser corrigida e testada. Nenhum ajuste de grants ou infraestrutura foi feito.

## 2. Módulos funcionais e conectados

| Módulo | Estado verificado |
|---|---|
| Dashboard | Consome empresas, clientes, obrigações, notas e alertas por API. Falhas em notas/alertas são convertidas silenciosamente em listas vazias, podendo exibir indicadores incompletos. |
| Empresas | CRUD via `companiesApi`; a tela não importa `mockData`. Respostas dependem da API/RLS. |
| Clientes | CRUD via `clientsApi`; depende da API/RLS. |
| Obrigações Fiscais | CRUD via `taxObligationsApi`; depende da API/RLS. |
| Notas Fiscais | Lê e grava registros via API interna. A integração SEFAZ/NF-e está desconectada; o código não comprova transmissão fiscal externa. Erros de carregamento são ocultados como lista vazia. |
| Alertas | API para listar e marcar lido; existem dados mock históricos. |
| Portal do Cliente | API para documentos, guias e mensagens. Documentos usam `storageKey`; upload/armazenamento de arquivos não foi comprovado. |
| Usuários | API de listagem, convites, papel e status. O fluxo de convites depende da tabela ausente descrita abaixo. |
| Escritórios | Conectado a endpoints de administração de escritórios. |
| MIL Auditor / MIL IA | Backend tem rotas autenticadas e consultas de contexto. O chat chama Gemini; a chave é obrigatória no boot. A seção de chat é renderizada pelo app, mas não consta nos itens de navegação encontrados. |

## 3. Módulos incompletos ou simulados

- `Fiscal`, `Folha de Pagamento` e `Notícias` exibem arrays locais de demonstração; não consomem os dados da API operacional.
- `Abertura de Empresa` tem formulário/etapas visuais sem chamada de API ou persistência.
- `Gestão de Papéis` é uma matriz informativa de permissões fixas, não um editor de papéis.
- A aba Financeiro da empresa é placeholder; há rotas/serviços de assinatura no backend, mas não foi encontrado cliente frontend correspondente.
- Documentos da empresa são placeholder. Há endpoints de metadados no Portal, sem integração de armazenamento comprovada.
- A tela de certificado tem botões sem operações associadas e exibe estados fixos. Há API para cadastrar metadados/referência de cofre, mas não integração com certificadora.
- `architecture/integrations.ts` registra adaptadores mock para Certificado A1, Receita Federal, eSocial e FGTS. Os estados reais externos aparecem como pendentes/desconectados. A API da certificadora parceira continua pendente; nenhum endpoint ou segredo foi presumido.
- Existe serviço/rota de RH para funcionários, mas a tela Folha usa colaboradores estáticos.

## 4. Origem dos dados de demonstração

**Confirmado:** `Empresas.tsx` usa `companiesApi.list()` e `companiesApi` chama `/api/companies`; a rota requer autenticação. Os arquivos `mockData.ts` permanecem no repositório, mas não são fallback automático dessa tela. O script `server/scripts/seed-demo-data.mjs` não aparece nos scripts de inicialização dos `package.json` nem no bootstrap `server.ts`; não foi executado. Ele contém `INSERT ... ON CONFLICT DO UPDATE`, portanto não deve ser usado contra o banco existente sem plano e autorização explícitos.

O banco consultado em modo READ ONLY contém **2 escritórios, 5 empresas e 6 usuários**. **1 escritório, 4 empresas e 5 usuários** coincidem exatamente com identificadores do dataset conhecido do seed. Isso confirma a presença de registros correspondentes ao conjunto de demonstração; não classifica os registros adicionais nem prova a origem real deles. As telas que consomem a API podem apresentar os registros correspondentes sem qualquer indicação visual de que vieram do seed, com risco de confusão com cadastros reais.

## 5. PostgreSQL e migrações

- Consultas de auditoria foram executadas somente em transações `BEGIN READ ONLY`, retornando contagens e metadados, nunca linhas de clientes/usuários. Não houve DML, DDL, seed ou migração nesta auditoria.
- O catálogo confirmou RLS habilitado nas 12 tabelas centrais verificadas e 29 policies associadas. Contudo, `BYPASSRLS` na conexão atual neutraliza essas policies nas consultas que usam essa conexão; veja o risco da seção 1.
- A tabela `schema_migrations` registra as migrações 001–015. A migração 016 não está registrada e `public.user_invitations` não existe; o fluxo de convites depende dela e pode falhar no banco atual. A tabela `hr_employees`, da migração 015, existe.
- As 12 colunas esperadas pelo novo modelo de obrigações foram encontradas. A migração 014 contém `UPDATE` de compatibilidade e não foi reexecutada.
- `server.ts` inicia `startObligationStatusJob()`. O job chama imediatamente e depois diariamente `recalculate_obligation_statuses()` via `pool.query`; a função SQL atualiza obrigações sem filtro de tenant. Com a conexão `BYPASSRLS` observada, o job pode alterar status de todos os tenants no boot e diariamente. Não reiniciei a API nem executei a função. Não é possível determinar nesta auditoria se/quantas linhas foram alteradas por inicializações anteriores.
- O README do banco descreve apenas as migrações 001–012, embora existam 013–016.

## 6. Autenticação e segurança

- Login e cadastro usam API real; JWT fica em `sessionStorage` e tem duração padrão de 8 horas. O esquema de refresh tokens existe, mas não foi identificado fluxo de refresh no frontend.
- Recuperação de senha **não está implementada**: a API responde `{sent:true}`, não gera token nem envia e-mail e registra o e-mail solicitado no log. Há risco de exposição de dado pessoal em logs.
- A página de login expunha usuários e senha mock, apesar de usar `realAuth`. Essa interface foi removida e a senha deixou de aparecer nos bundles gerados; os arquivos mock/seed históricos continuam no repositório.
- `server/.env` existe. O `.gitignore` contém regras `.env` e `.env.*`, com exceção para `.env.example`. O executável Git não está disponível neste ambiente; por isso não foi possível confirmar se o arquivo está rastreado, verificar status Git nem pesquisar histórico. A varredura de caminhos foi feita sem imprimir conteúdo e não substitui auditoria do histórico.
- CORS, JWT, banco e chaves de terceiros são configuráveis por ambiente. Os valores ativos não foram exibidos nem auditados. A configuração efetiva de produção e a ausência de segredos no histórico permanecem **não verificadas**.
- Não foi alterada nenhuma credencial. Plano de rotação: inventariar no provedor quais chaves/DSNs realmente foram expostos; criar credenciais novas e de menor privilégio mantendo as antigas válidas; configurar e validar a instância nova em janela controlada; migrar tráfego/instâncias; só então revogar as antigas. Para `JWT_SECRET`, planejar explicitamente a expiração/invalidação de sessões. Se o histórico confirmar exposição, tratar a rotação e eventual saneamento do histórico em ação coordenada separada.

## 7. Correções realizadas

- `modules/empresas/Empresas.tsx`: removido o texto acidental `setSelected` que aparecia no formulário.
- `modules/auth/LoginPage.tsx`: removidos o preenchimento de contas demo, a senha de demonstração e a mensagem falsa de “autenticação mock”.
- `modules/auth/index.ts`: removida a reexportação de usuários/senha mock, evitando incluí-los no bundle de produção. Os arquivos fonte de demonstração foram preservados.
- `modules/empresas/components/tabs/FinanceiroTab.tsx`: corrigido o caminho quebrado do import de `Company`.

Não foram alterados dados persistidos, esquema, credenciais, configurações Railway/Neon ou infraestrutura. Não foi feito deploy.

## 8. Testes e verificações

- `npm run build` (frontend): **passou**. Vite reporta chunk principal de aproximadamente 1,09 MB, acima do limite de 500 kB.
- `npx tsc --noEmit` (frontend): **passou** após correção do import de FinanceiroTab. Antes da correção, detectou esse import quebrado.
- `npm run build` (server): **passou**.
- `npm test` (server): **25 passaram, 0 falharam**. Os testes usam clients PostgreSQL falsos/in-memory; não validam o banco conectado.
- Diagnósticos do editor nos arquivos corrigidos: sem erros.
- Verificação do bundle após correção: a senha `demo1234` não foi encontrada nos JavaScript gerados. O valor continua em código-fonte de mock/seed.
- Não foram executados testes e2e, testes contra o banco, seed, migrations ou deploy.

## 9. Pendências e riscos

1. **Crítico:** conexão da API com `BYPASSRLS` e ausência de filtro tenant explícito nas listagens de empresas/clientes. Isolamento multi-tenant não está garantido nesta configuração.
2. **Crítico:** job de obrigações pode atualizar registros de todos os tenants ao iniciar e diariamente.
3. **Alto:** migração 016/tabela de convites ausente; fluxo de convite não validado no banco ativo.
4. **Alto:** registros que coincidem com seed aparecem via API sem marcação de demonstração; registros restantes não classificados.
5. **Alto:** recuperação de senha simulada, sem envio/reset real; ausência de rate limit não foi verificada nos endpoints de autenticação.
6. **Médio:** telas fiscais, RH, notícias, abertura, documentos e financeiro não estão integralmente ligadas à API; adaptadores externos permanecem mock/desconectados.
7. **Não verificado:** status Git/histórico, credenciais efetivas, regras de rede/CORS de produção e estado operacional anterior do job.

## 10. Próximas ações recomendadas

1. Antes de continuar o uso com dados reais, solicitar ao responsável pelo PostgreSQL uma configuração de aplicação sem `BYPASSRLS`, com role operacional e caminho administrativo separado. Validar isolamento com testes por dois tenants, sem expor dados.
2. Revisar e conter o job de recálculo antes do próximo restart da API; executá-lo com contexto/role e escopo aprovados, após avaliar o histórico de alterações. Nenhuma mudança foi feita nesta auditoria.
3. Revisar a migração 016 e aplicá-la somente com autorização, backup e janela aprovados; não a executar automaticamente.
4. Fazer inventário seguro de segredos/histórico Git e executar rotação coordenada conforme o plano acima.
5. Implementar recuperação de senha real, proteção contra abuso de login e estratégia de sessão/revogação.
6. Identificar visualmente dados demonstrativos já existentes após validação com o responsável, sem apagar ou alterar registros nesta etapa.
7. Priorizar a integração real de certificado quando a API da parceira for fornecida e substituir as telas mock com fonte/API e validação apropriadas.

**Limite de conclusão:** a compilação e os testes isolados estão verdes, mas o risco de `BYPASSRLS` precisa ser resolvido antes de considerar a plataforma pronta para operação multi-tenant com dados reais.
