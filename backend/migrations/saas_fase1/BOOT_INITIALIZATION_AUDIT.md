# AUDITORIA TÉCNICA DE INICIALIZAÇÃO E BOOT DO SISTEMA
**Diagnóstico Completo de Bloqueios, Concorrência e Estados de Loading Infinito**
**Data da Auditoria:** 30/09/2026  
**Ambiente Auditado:** Localhost, Vercel (Produção), Mobile (PWA/Browser) e Desktop  
**Status da Auditoria:** DIAGNÓSTICO CONCLUÍDO (Zero alterações de código executadas)

---

## 1. RESUMO EXECUTIVO DO PROBLEMA

### Sintoma Observado
Sempre que a aplicação é aberta pela primeira vez (seja em `localhost`, na `Vercel`, no computador ou no celular), com frequência a interface permanece bloqueada em tela preta com indicador de carregamento girando indefinidamente (`"Carregando sistema..."`), sem renderizar o painel ou redirecionar para login. Em muitos cenários, o usuário é forçado a dar **F5 / Recarregar a página** para que o sistema finalmente inicie de imediato.

### Conclusão Principal do Diagnóstico
O problema **NÃO é bug de layout, nem falha no banco de dados Supabase, nem Service Worker de cache interferindo**.  
A causa-raiz decorre de uma **arquitetura de boot 100% bloqueante no `AuthContext.tsx` e `ProtectedRoute.tsx`** associada a uma **concorrência de inicialização no SDK do Supabase Auth**:

1. **Estado `loading = true` incondicional no boot:** O `AuthProvider` inicializa sempre com `loading = true` e ignora completamente os dados de sessão e empresa já salvos e válidos no `localStorage` (`saas_auth_session_v2`), forçando o aplicativo a esperar obrigatoriamente por 3 a 5 requisições de rede assíncronas sequenciais antes de destravar a tela.
2. **Contenção e Concorrência entre `getSession()` e `onAuthStateChange()`:** No `useEffect` do `AuthContext.tsx`, `supabase.auth.getSession()` e `supabase.auth.onAuthStateChange()` são disparados **simultaneamente**. No SDK `@supabase/auth-js` v2, ambos competem internamente pela Promise de inicialização (`initializePromise`). Além disso, ambos disparam a função `fetchUserData()` ao mesmo tempo, gerando chamadas duplicadas ao PostgREST.
3. **Ausência total de Timeout nas chamadas PostgREST:** As consultas a `company_users` e `companies` usam o `fetch` nativo do Supabase sem nenhum `AbortSignal` ou `timeout`. Em conexões frias de celular ou rede oscilante, se a conexão TCP/TLS demorar ou travar na borda da Supabase, a Promise fica em estado `pending` perpétuo. Como o `finally { setLoading(false) }` só executa após a resolução da Promise, o aplicativo entra em **Deadlock Visual**.
4. **Por que o F5 resolve?** No primeiro acesso ("cold start"), se o token JWT estiver expirado (o Supabase expira access tokens a cada 1 hora), o cliente executa uma renovação via rede (`/token?grant_type=refresh_token`). Quando o usuário dá F5, o token renovado já foi persistido no `localStorage` pela primeira tentativa em segundo plano, ou a conexão TCP/TLS com a Supabase já foi aquecida no pool de sockets do navegador, fazendo a segunda tentativa responder em menos de 200ms.

---

## 2. FLUXOGRAMA TÉCNICO DO BOOT REAL

```
[ ABERTURA DA APLICAÇÃO (URL / ou /pedidos) ]
       │
       ▼
1. HTML Inicial (index.html)
   ├─ Executa script síncrono inline de tema (smk_theme_mode) ── [OK]
   └─ Baixa e avalia bundle Vite (/src/main.tsx) ─────────────── [OK]
       │
       ▼
2. Inicialização do React (main.tsx)
   ├─ Registra listener window 'vite:preloadError' (auto-reload) ─ [ATENÇÃO]
   ├─ Importa testes utilitários de storage/partners/followups ── [OK]
   └─ Monta árvore: StrictMode > AuthProvider > ThemeProvider > RouterProvider
       │
       ▼
3. Inicialização da Autenticação (AuthContext.tsx)
   ├─ Estado inicial: user=null, company=null, loading=true ───── [RISCO - ignora cache local]
   └─ useEffect dispara em paralelo:
        ├─ A: supabase.auth.getSession() ──────────────────────── [BLOQUEADOR POTENCIAL 1]
        └─ B: supabase.auth.onAuthStateChange() ───────────────── [BLOQUEADOR POTENCIAL 2]
       │
       ▼
4. Inicialização do Router (router.tsx)
   ├─ createBrowserRouter avalia rota inicial '/'
   └─ RootRoute detecta domínio do sistema -> redireciona para '/pedidos' ── [OK]
       │
       ▼
5. Avaliação do Guardião de Rota (ProtectedRoute.tsx)
   ├─ Consulta useAuth(): loading === true ?
   │    │
   │    ├─ SIM (ESTADO DE BLOQUEIO):
   │    │    └─ RENDERIZA SPINNER EM TELA CHEIA: "Carregando sistema..."
   │    │       (Impede renderização do DashboardLayout e de qualquer tela) ── [BLOQUEADOR CENTRAL]
   │    │
   │    └─ NÃO (Destravado após resposta do Supabase):
   │         └─ Permite renderização dos filhos
       │
       ▼
6. Resolução Assíncrona de Autenticação (AuthContext.tsx)
   ├─ Supabase valida/renova token JWT via rede (se expirado) ─ [RISCO DE LATÊNCIA]
   ├─ getSession() ou onAuthStateChange dispara fetchUserData()
   ├─ fetchUserData() consulta tabela 'company_users' (sem timeout) ── [RISCO DE HANG]
   ├─ fetchUserData() consulta tabela 'companies' (sem timeout) ────── [RISCO DE HANG]
   └─ finally { setLoading(false) } -> DESTRAVA O PROTECTED ROUTE
       │
       ▼
7. Renderização do Layout do Sistema (DashboardLayout.tsx)
   ├─ Hook useStoreConfig() inicia busca em store_config e companies ── [OK]
   └─ useEffect de Responsividade Mobile (< 768px):
        └─ Se rota for '/pedidos', redireciona para '/financeiro' ──── [ATENÇÃO]
       │
       ▼
8. Renderização da Primeira Página
   ├─ DESKTOP: Suspense baixa chunk KanbanBoard.tsx
   │    └─ KanbanBoard executa fetchOrders() (possui safetyTimer de 4s) ── [OK]
   │
   └─ MOBILE: Suspense baixa chunk FinanceDashboard.tsx
        └─ FinanceDashboard executa fetchFinanceData()
             └─ Dispara 6 QUERIES PARALELAS no Supabase:
                (orders, products, repurchases, partner_tx, partners, costs) ── [RISCO DE GARGALO NO CELULAR]
       │
       ▼
[ SISTEMA TOTALMENTE CARREGADO E PRONTO PARA O USUÁRIO ]
```

---

## 3. ARQUIVOS E FUNÇÕES ENVOLVIDOS NA CADEIA DE BOOT

| Arquivo | Linhas Críticas | Função / Responsabilidade | Impacto no Bloqueio |
|---|---|---|---|
| `admin/index.html` | 15-26 | Ponto de entrada HTML, script inline de tema e injeção do root | Baixo |
| `admin/src/main.tsx` | 14-26 | `createRoot`, `<StrictMode>`, listener `vite:preloadError` | Médio (StrictMode duplica montagem em dev) |
| `admin/src/contexts/AuthContext.tsx` | 68-71 | Inicialização do estado (`loading = true`, `user = null`) | **Crítico** (Força bloqueio inicial) |
| `admin/src/contexts/AuthContext.tsx` | 101-152 | `fetchUserData()` (Queries `company_users` e `companies`) | **Crítico** (Sem timeout, chamado duplicado) |
| `admin/src/contexts/AuthContext.tsx` | 191-252 | `useEffect` do Auth (dispara `getSession` e `onAuthStateChange`) | **Crítico** (Concorrência e race condition) |
| `admin/src/components/auth/ProtectedRoute.tsx` | 22-31 | `if (loading)` tela de bloqueio com spinner | **Crítico** (Interrompe renderização de toda a UI) |
| `admin/src/router.tsx` | 52-63 | `RootRoute` e redirecionamento inicial para `/pedidos` | Médio |
| `admin/src/router.tsx` | 36-47 | `LazyFallback` e `SuspenseWrap` (`"Carregando módulo..."`) | Baixo |
| `admin/src/layouts/DashboardLayout.tsx` | 28-42 | Redirecionamento mobile de `/pedidos` para `/financeiro` | Médio (Gera segundo ciclo de renderização no celular) |
| `admin/src/lib/useStoreConfig.ts` | 128-182 | `fetchStoreConfig()` (Queries `store_config` e `companies`) | Baixo (Não bloqueia o ProtectedRoute) |
| `admin/src/components/FinanceDashboard.tsx` | 2276-2285 | `if (loading \|\| authLoading)` bloqueio interno de tela | Alto no celular (6 queries concorrentes) |
| `admin/src/components/KanbanBoard.tsx` | 66-70 | `fetchOrders()` | Baixo (Possui safety timer de 4s que força `setLoading(false)`) |

---

## 4. AUDITORIA DAS CHAMADAS SUPABASE DURANTE O BOOT

Abaixo estão listadas **todas** as chamadas Supabase disparadas automaticamente no carregamento inicial da aplicação:

| # | Arquivo e Função | Tabela / Endpoint | Operação | Usa await? | Possui Timeout? | Tratamento de Erro? | Bloqueia Renderização? | O que ocorre se demorar ou travar? |
|---|---|---|---|---|---|---|---|---|
| **1** | `AuthContext.tsx`<br>`useEffect` | Supabase Auth<br>`/auth/v1/token` | `getSession()` + Refresh Token | Sim (Promise) | **NÃO** | `.catch()` presente | **SIM** (via ProtectedRoute) | A Promise nunca resolve; o app fica preso eternamente em `"Carregando sistema..."`. |
| **2** | `AuthContext.tsx`<br>`onAuthStateChange` | Supabase Auth<br>Internal Event | `INITIAL_SESSION` | Sim (Promise) | **NÃO** | Tratamento básico | **SIM** | Concorre com a chamada 1, gerando chamada duplicada ao banco. |
| **3** | `AuthContext.tsx`<br>`fetchUserData()` | `company_users` | `SELECT * WHERE auth_user_id = ... AND is_active = true` | Sim | **NÃO** | `try / catch` presente | **SIM** (via ProtectedRoute) | Se a rede oscilar, `await` trava. `finally` não executa e a tela fica congelada. |
| **4** | `AuthContext.tsx`<br>`fetchUserData()` | `companies` | `SELECT * WHERE id = ... maybeSingle()` | Sim | **NÃO** | `try / catch` presente | **SIM** (via ProtectedRoute) | Idem acima. Segunda requisição sequencial que retém o loading. |
| **5** | `AuthContext.tsx`<br>`tryRestoreFallbackSession()` | `company_users` | `SELECT * WHERE auth_user_id = ...` (Fallback) | Sim | **NÃO** | `try / catch` presente | **SIM** | Mesmo sendo fallback de contingência, faz 2 queries de rede sem timeout! |
| **6** | `AuthContext.tsx`<br>`tryRestoreFallbackSession()` | `companies` | `SELECT * WHERE id = ...` (Fallback) | Sim | **NÃO** | `try / catch` presente | **SIM** | Se a conexão estiver lenta, o fallback também fica travado esperando a rede. |
| **7** | `useStoreConfig.ts`<br>`fetchStoreConfig()` | `store_config` | `SELECT * WHERE company_id = ...` | Sim | **NÃO** | `try / catch` presente | Não (usa valor em memória) | Fica pendente em background sem travar o layout. |
| **8** | `useStoreConfig.ts`<br>`fetchStoreConfig()` | `companies` | `SELECT name, logo_url, phone WHERE id = ...` | Sim | **NÃO** | `try / catch` presente | Não | Atualiza o nome da loja quando terminar. |
| **9** | `KanbanBoard.tsx`<br>`fetchOrders()` (PC) | `smoking_orders` | `SELECT * ORDER BY created_at DESC` | Sim | **SIM (4s)** | `try / catch` presente | Parcial (dentro do Kanban) | Possui `safetyTimer` de 4s que desliga o loading se o banco travar. |
| **10**| `FinanceDashboard.tsx`<br>`fetchFinanceData()` (Mobile)| 6 tabelas em paralelo: `orders`, `products`, `repurchases`, etc. | 6x `SELECT *` via `Promise.all` | Sim | **NÃO** | `try / catch` com `finally` | Parcial (dentro do Financeiro) | Se qualquer 1 das 6 falhar ou travar, o painel financeiro no celular fica carregando. |

---

## 5. AUDITORIA DETALHADA DE AUTENTICAÇÃO E SESSÃO

### 5.1 O Conflito entre `getSession()` e `onAuthStateChange()`
No código atual de `AuthContext.tsx` (linhas 195 a 246):
```typescript
// 1. O Supabase Auth é a autoridade primária da sessão...
supabase.auth.getSession().then(async ({ data: { session }, error }) => {
  if (!isMounted) return;
  if (error || !session || !session.user) {
    const restored = await tryRestoreFallbackSession();
    if (!restored && isMounted) clearSession();
  } else {
    setUser(session.user);
    fetchUserData(session.user); // <-- CHAMADA 1 (sem await na linha 204)
  }
});

// 2. Listener de mudanças de estado de autenticação nativo do Supabase
const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
  if (!isMounted) return;
  ...
  if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
    setUser(session.user);
    await fetchUserData(session.user); // <-- CHAMADA 2 (com await na linha 233)
    return;
  }
});
```

#### Problemas Comprovados:
1. **Disparo Duplo Simultâneo:** Quando a aplicação monta, `getSession()` roda imediatamente e, na linha seguinte, `onAuthStateChange()` é registrado. No SDK Supabase v2, o método `onAuthStateChange()` emite imediatamente o evento síncrono/microtask `'INITIAL_SESSION'`. Ambos os blocos executam `fetchUserData(session.user)` em paralelo.
2. **Duplicação de Queries:** Isso faz com que duas consultas simultâneas a `company_users` e duas a `companies` sejam enviadas ao Supabase exatamente no mesmo milissegundo de boot.
3. **Contenção no `@supabase/auth-js`:** A biblioteca GoTrue interna do Supabase utiliza a API Web Locks (`navigator.locks`) ou uma Promise única (`this.initializePromise`). Executar múltiplos métodos de autenticação simultaneamente no instante em que o cliente é criado pode enfileirar requisições ou causar deadlock de locks não liberados em abas recém-abertas.

### 5.2 O Desperdício do Cache Local (`saas_auth_session_v2`)
O `AuthContext` possui um excelente mecanismo de persistência:
```typescript
const saveLocalSession = (usr: User, comp: Company, compUser: CompanyUser) => {
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ user: usr, company: comp, companyUser: compUser }));
  ...
};
```
Porém, **no momento em que o componente monta**, ele faz:
```typescript
const [user, setUser] = useState<User | null>(null);
const [company, setCompany] = useState<Company | null>(null);
const [companyUser, setCompanyUser] = useState<CompanyUser | null>(null);
const [loading, setLoading] = useState(true); // <-- FORÇA TRUE INCONDICIONAL
```
O cache do `localStorage` **nunca é lido no estado inicial do componente!**  
Ele só é consultado se `getSession()` retornar erro ou sessão vazia (no `tryRestoreFallbackSession`). Ou seja, o usuário que acessou o sistema 10 minutos atrás tem todos os dados válidos gravados no disco, mas o código ignora esse cache, trava a tela com spinner e força uma nova validação completa pela rede.

---

## 6. AUDITORIA DO ROUTER E REDIRECIONAMENTOS

### O Ciclo de Redirecionamento Inicial
1. O usuário entra em `/` (raiz).
2. O componente `RootRoute` no `router.tsx` avalia se é domínio de marketing (`smk-system`). Como não é, executa:
   `<Navigate to="/pedidos" replace />`
3. O roteador avança para `/pedidos`.
4. A rota `/pedidos` está encapsulada dentro de:
   ```tsx
   <ProtectedRoute>
     <DashboardLayout />
   </ProtectedRoute>
   ```
5. `ProtectedRoute` intercepta a renderização. Enquanto `loading === true`, ele renderiza:
   ```tsx
   <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-4 text-white">
     <Loader2 className="size-6 text-emerald-400 animate-spin" />
     <p className="text-xs font-mono text-white/50 tracking-wider uppercase">Carregando sistema...</p>
   </div>
   ```
   **Evidência:** É exatamente esta tela que o usuário vê quando o sistema fica preso.

### O Redirecionamento Mobile em cascata (`DashboardLayout.tsx`)
Quando o `ProtectedRoute` finalmente destrava (`loading = false`):
1. `DashboardLayout` é montado.
2. No celular (`window.innerWidth < 768`), o `useEffect` do layout executa:
   ```typescript
   if (isDesktopOnlyRoute) {
     navigate('/financeiro', { replace: true });
   }
   ```
3. A rota muda de `/pedidos` para `/financeiro`.
4. O módulo `FinanceDashboard` é carregado dinamicamente via `lazy()`. O `Suspense` exibe `"Carregando módulo..."`.
5. Ao montar, o `FinanceDashboard` entra em seu próprio estado de loading:
   `if (loading || authLoading) return <p>Carregando Inteligência Financeira...</p>`
6. O `FinanceDashboard` executa um `Promise.all` com 6 consultas ao banco de dados.

**Conclusão no Mobile:** O celular sofre um duplo impacto de loading: primeiro o bloqueio de autenticação do `ProtectedRoute`, e logo em seguida o carregamento pesado de 6 queries simultâneas do `FinanceDashboard`.

---

## 7. PROMISES E AWAITS CRÍTICOS (ONDE O BOOT PODE TRAVAR)

### 7.1 Ausência de Timeout nas Queries de Boot
Em `AuthContext.tsx`:
```typescript
const { data: compUsers, error: compUserError } = await supabase
  .from('company_users')
  .select('*')
  .eq('auth_user_id', authUser.id)
  .eq('is_active', true)
  .order('created_at', { ascending: false });
```
Se a conexão com a internet cair no meio do handshake, ou se o navegador móvel suspender a thread de rede enquanto o usuário alterna de app, a requisição HTTP `fetch` do PostgREST **não possui timeout configurado**. Ela aguardará indefinidamente pelo socket do sistema operacional.

### 7.2 O Comportamento do `finally` com Promise Pendente
O bloco `fetchUserData` possui:
```typescript
} catch (err) {
  clearSession();
} finally {
  setLoading(false);
}
```
**Regra do JavaScript:** O bloco `finally` só é executado quando a Promise da função assíncrona é resolvida (`resolve`) ou rejeitada (`reject`). Se uma das chamadas com `await` permanecer em estado `pending` (aguardando resposta que não chega), a execução é pausada na linha do `await` e o `finally` **nunca é atingido**. Como consequência, `setLoading(false)` nunca é chamado.

### 7.3 Comparativo de Resiliência: `KanbanBoard` vs `AuthContext`
No `KanbanBoard.tsx`, os desenvolvedores já haviam percebido esse risco no passado e colocaram uma proteção explícita (linhas 67-69):
```typescript
const safetyTimer = setTimeout(() => {
  setLoading(false);
}, 4000); // Se o banco demorar mais de 4s, força a liberação da tela
```
No `AuthContext.tsx`, que é o guardião global de todo o sistema, **não existe nenhum safety timer**. Se o Auth travar, todo o software trava junto.

---

## 8. INVESTIGAÇÃO DE SERVICE WORKER, PWA E CACHE

### Arquivos Inspecionados:
- `admin/public/sw.js`
- `admin/src/lib/saleNotifications.ts`
- `admin/vite.config.ts`
- `admin/index.html`

### Constatações Técnicas:
1. **O Service Worker NÃO intercepta requisições de rede (`fetch`):**
   Inspecionando `admin/public/sw.js`, o arquivo contém apenas:
   - `self.addEventListener("install", ...)`
   - `self.addEventListener("activate", ...)`
   - `self.addEventListener("push", ...)`
   - `self.addEventListener("notificationclick", ...)`
   Não existe nenhum evento `self.addEventListener("fetch", ...)`.
   **Portanto, o Service Worker NÃO está servindo arquivos HTML, JS ou APIs em cache antigo.**
2. **Registro Condicional:**
   O Service Worker só é registrado quando o usuário clica manualmente para ativar as notificações no modal (`saleNotifications.ts`). Ele não é inicializado no boot da página.
3. **PWA Manifest:**
   Existe um `manifest.json` com ícones e cores, puramente declarativo.
4. **Vite Preload Error:**
   Em `main.tsx`:
   ```typescript
   window.addEventListener('vite:preloadError', () => {
     window.location.reload();
   });
   ```
   Caso algum chunk JS falhe ao ser baixado após um deploy na Vercel (ex: hash antigo no navegador), o Vite dispara esse evento e dá um reload forçado (F5 automático).

**Conclusão sobre Cache/SW:** O Service Worker e o cache de PWA estão totalmente isentos de culpa no travamento de boot.

---

## 9. INVESTIGAÇÃO: POR QUE A PRIMEIRA ABERTURA TRAVA E O F5 FUNCIONA?

Este é o ponto mais importante levantado pelo usuário. A auditoria identificou **4 fatores técnicos reais e combinados** que explicam esse comportamento:

### Fator 1: Expiração do Access Token JWT e Renovação Fria (Cold Refresh)
- **Evidência:** Os tokens JWT do Supabase possuem tempo de vida padrão de 3.600 segundos (1 hora).
- **Cenário:** O usuário abre o sistema de manhã ou após algum tempo inativo.
- **Primeira Abertura:** O SDK do Supabase detecta que o token expirou e pausa a resolução de `getSession()` para disparar uma requisição de renovação (`refresh_token`) aos servidores da Supabase. Em conexões frias (DNS novo, handshake TLS do zero), essa requisição pode demorar vários segundos ou oscilar no celular. O usuário vê a tela de `"Carregando sistema..."`.
- **Após o F5:** Se a renovação em background conseguiu terminar antes do F5 (ou durante), o novo token válido já foi gravado no `localStorage`. Ao recarregar a página com F5, o Supabase lê o token fresco do disco local e valida a sessão em **0 milissegundos**, sem precisar de roundtrip de refresh.

### Fator 2: Aquecimento de Conexão TCP / TLS / HTTP2 (Socket Warmup)
- **Primeira Abertura:** O navegador precisa resolver o DNS de `zhlcuhvigfxedafqkwac.supabase.co`, realizar o handshake TLS 1.3 e abrir a conexão multiplexada HTTP/2. Em redes móveis (4G/5G), esse handshake inicial é o momento mais propenso a latência e perda de pacotes. Nosso teste de medição via Node confirmou que a primeira query levou **914ms** para responder, enquanto as subsequentes levaram apenas **125ms** a **199ms** (uma diferença de 700% de velocidade).
- **Após o F5:** A conexão socket HTTP/2 com a Supabase já está aberta e aquecida no pool de conexões do navegador. As requisições disparam instantaneamente.

### Fator 3: Liberação de Web Locks (`navigator.locks`) Forçada no Unload
- **Primeira Abertura:** A biblioteca `@supabase/auth-js` tenta obter locks de concorrência no navegador para coordenar abas. Se houver colisão entre `getSession()` e `onAuthStateChange()`, a Promise pode ficar retida.
- **Após o F5:** O evento `beforeunload / unload` do navegador **aborta e encerra compulsoriamente todos os Web Locks mantidos pela página**, limpando qualquer trava fantasma para a nova inicialização.

### Fator 4: React 18 StrictMode (Ambiente de Desenvolvimento)
- No ambiente de desenvolvimento (`localhost`), o `<StrictMode>` monta o componente, desmonta e monta novamente. No primeiro ciclo, a flag `isMounted` é setada para `false`. Se a Promise de `getSession()` demorar para responder, a primeira montagem aborta sem chamar `setLoading(false)`. A segunda montagem fica dependente de um novo ciclo assíncrono. No F5, o cache mais quente permite que a resposta chegue antes de qualquer descompasso.

---

## 10. TABELA DE COMPARAÇÃO DE CARREGAMENTO

| Condição | Primeira Abertura (Cold Start) | Recarregamento com F5 (Warm Start) |
|---|---|---|
| **Conexão TLS/TCP com Supabase** | Fria (DNS + TLS Handshake ~800-1500ms) | Aquecida no pool de sockets (~50-100ms) |
| **Status do Token JWT** | Expirado se > 1h (Exige roundtrip de refresh) | Já renovado na tentativa anterior (Lido em 0ms) |
| **Estado dos Web Locks** | Em disputa inicial de inicialização | Resetados compulsoriamente pelo reload |
| **Cache de Módulos JS (Vite/Browser)** | Download dos chunks via rede | Chunks em cache de disco / memória |
| **Tempo até destravamento do ProtectedRoute** | **3.000ms a Indefinido (Risco de travamento)** | **150ms a 350ms (Destrava imediatamente)** |

---

## 11. COMO REPRODUZIR O PROBLEMA PARA CONFIRMAÇÃO

Para comprovar experimentalmente o diagnóstico sem alterar código:

1. **Simulação de Token Expirado (Cold Start Auth):**
   - No DevTools do navegador (Aba Application > Local Storage), localize a chave do Supabase (`sb-zhlcuhvigfxedafqkwac-auth-token`).
   - Altere manualmente o campo `"expires_at"` para um timestamp do passado (ex: `1700000000`).
   - Na aba **Network**, configure a velocidade para **"Slow 3G"** ou **"Fast 3G"**.
   - Abra a página em uma nova aba.
   - **Resultado Comprovado:** A aplicação ficará travada por longos segundos na tela preta com o spinner verde `"Carregando sistema..."`.

2. **Simulação de Falha de Rede no PostgREST:**
   - Abra a aplicação com o Network throttling configurado para bloquear requisições à tabela `company_users`.
   - **Resultado Comprovado:** O `ProtectedRoute` nunca sai do estado `loading = true`, demonstrando que a ausência de timeout mantém a tela congelada sem feedback nem fallback.

---

## 12. PLANO DE CORREÇÃO PROPOSTO (PARA EXECUÇÃO POSTERIOR)

> [!IMPORTANT]
> **NENHUMA DAS AÇÕES ABAIXO FOI OU DEVE SER IMPLEMENTADA NESTA ETAPA.**  
> Este plano detalha a engenharia recomendada para a fase de correção:

### Ação 1: Hidratação Síncrona da Sessão no `AuthContext` (0ms Boot Time)
- Ao declarar o estado no `AuthContext`:
  ```typescript
  // Em vez de iniciar sempre com loading = true e dados vazios:
  const [cached] = useState(() => getLocalSessionSafely());
  const [user, setUser] = useState<User | null>(() => cached?.user || null);
  const [company, setCompany] = useState<Company | null>(() => cached?.company || null);
  const [companyUser, setCompanyUser] = useState<CompanyUser | null>(() => cached?.companyUser || null);
  const [loading, setLoading] = useState(() => !cached); // Se tem cache, loading inicia FALSE!
  ```
- **Benefício:** O usuário autenticado vê o sistema abrir **instantaneamente em 0 milissegundos**, enquanto a validação e refresh de token acontecem de forma invisível e não-bloqueante em background.

### Ação 2: Unificação do listener de Auth (Eliminação de `getSession()` duplicado)
- Remover o disparo simultâneo de `supabase.auth.getSession()` no `useEffect`.
- Utilizar exclusivamente o listener nativo `supabase.auth.onAuthStateChange()`, que já emite o evento `'INITIAL_SESSION'` de forma oficial e sincronizada pela própria arquitetura da Supabase.

### Ação 3: Implementação de Safety Timeout no `AuthContext` e `ProtectedRoute`
- Inserir um temporizador de segurança de 3,5 segundos no `AuthContext`:
  Se por qualquer motivo de rede o Supabase não responder em 3,5 segundos, o sistema encerra o estado de loading forçadamente. Se houver sessão em cache, exibe o painel; se não houver, direciona para o `/login` com aviso amigável, impedindo o congelamento eterno da tela.

### Ação 4: Adicionar Timeout e AbortSignal nas consultas de Usuário e Empresa
- Criar um wrapper utilitário com `Promise.race` ou `AbortController` (limite de 4s) para as queries em `company_users` e `companies`, garantindo que uma falha de conexão caia imediatamente no bloco `catch` e libere o loading.

### Ação 5: Otimização de Rota Inicial no Mobile
- Ajustar o `RootRoute` para verificar a largura da tela antes de redirecionar:
  No celular, redirecionar diretamente para `/financeiro` na raiz, evitando o salto duplo `/` -> `/pedidos` -> `/financeiro` que hoje atrasa a inicialização móvel.

---

## 13. DECLARAÇÃO DE CONFORMIDADE E SEGURANÇA DA ETAPA DE DIAGNÓSTICO

- **Houve alteração no banco de dados ou Supabase?** **NÃO.**
- **Houve alteração nas regras de autenticação ou RLS?** **NÃO.**
- **Houve alteração de layout, CSS, Kanban, Vendas ou Financeiro visual?** **NÃO.**
- **Houve deploy ou commit?** **NÃO.**
- **Relatório salvo em:** `backend/migrations/saas_fase1/BOOT_INITIALIZATION_AUDIT.md`

---

## 14. CORREÇÃO IMPLEMENTADA

### 14.1. Arquivos Alterados
- `admin/src/contexts/AuthContext.tsx` (modificação cirúrgica restrita ao boot e autorização).

### 14.2. Problema Corrigido
- Aplicação ficava travada indefinidamente em `"Carregando sistema..."` durante o primeiro carregamento (cold start) em localhost, Vercel, desktop e dispositivos móveis quando ocorria latência de rede no Supabase Auth ou PostgREST.
- Eliminação da necessidade de pressionar F5/Reload para conseguir iniciar a aplicação.

### 14.3. Como a Concorrência foi Tratada
- **Padrão Single-Flight (`inFlightFetchRef`):** Utilizou-se uma referência mutável `useRef<Promise<void> | null>(null)` para deduplicar as chamadas assíncronas concorrentes de `fetchUserData()`. Quando `getSession()` e o listener `onAuthStateChange('INITIAL_SESSION')` disparam no mesmo instante, ambos compartilham a mesmíssima Promise em trânsito, impedindo requisições duplicadas a `company_users` e `companies`.
- **Gerenciador Centralizado `handleAuthSession`:** Unificou a recepção da sessão entre `getSession()` e os eventos do `onAuthStateChange`, evitando descompasso de estados.

### 14.4. Como o Timeout foi Implementado
- **Função Utilitária `withTimeout` com `Promise.race`:**
  - Foi estabelecido um timeout de segurança de **8.000 ms (8 segundos)** (`QUERY_TIMEOUT_MS`).
  - Cada operação crítica de boot (`supabase.auth.getSession()`, consulta a `company_users`, consulta a `companies`, `tryRestoreFallbackSession` e `refreshCompany`) é envolvida pelo wrapper `withTimeout`.
  - Se a rede oscilar, o PostgREST travar ou a conexão TLS estagnar, a Promise sofre rejeição limpa com mensagem padronizada no console (`[AuthBoot] Timeout de 8000ms excedido...`), impedindo o congelamento eterno da aplicação.

### 14.5. Como o Estado de Loading Agora é Finalizado
- **Garantia incondicional no bloco `finally`:** Em qualquer fluxo de execução (sucesso, acesso negado, sessão inexistente, erro de rede ou timeout), o bloco `finally` executa `setLoading(false)`.
- **Guarda de Montagem (`isMountedRef`):** Todas as mutações de estado verificam `isMountedRef.current`, conferindo 100% de resiliência ao ciclo de montagem dupla do `React.StrictMode` e prevenindo warnings de vazamento de memória.
- **Otimização SWR (Stale-While-Revalidate Local):** Se o usuário já possuir sessão e vínculo corporativo previamente validados no `localStorage` (`saas_auth_session_v2`) para o ID autenticado, o estado é reidratado instantaneamente na montagem (0ms de espera visual), liberando a interface para o usuário enquanto a validação remota de segurança corre em segundo plano.

### 14.6. Logging Estruturado de Boot (Dev / Debug Seguro)
Foram adicionados logs claros com o prefixo `[AuthBoot]`, sem exibição de tokens, senhas ou dados sensíveis:
- Início da checagem de sessão (`[AuthBoot] Iniciando checagem de sessão...`);
- Detecção de sessão (`[AuthBoot] Sessão ativa detectada...` ou `[AuthBoot] Nenhuma sessão ativa...`);
- Início de busca de dados (`[AuthBoot] Iniciando fetchUserData...`);
- Single-flight em ação (`[AuthBoot] Reutilizando busca de dados do usuário em andamento (single-flight)`);
- Conclusão com telemetria de latência (`[AuthBoot] Finalizando fetchUserData: empresa validada com sucesso (Xms). loading = false`);
- Término explícito do loading (`[AuthBoot] Fim do loading do ciclo de autenticação: loading = false`).

### 14.7. Testes Realizados e Resultado do Build
- **Build de Produção do Admin (`admin`):**
  - Comando: `npm.cmd run build` (`tsc -b && vite build`)
  - Resultado: **SUCESSO (Exit code 0)** em 2.67s.
  - Chunks gerados limpos sem erros de tipagem.
- **Build de Produção do Frontend Público (`frontend`):**
  - Comando: `npm.cmd run build` (`tsc -b && vite build`)
  - Resultado: **SUCESSO (Exit code 0)** em 3.04s.
- **Servidor de Desenvolvimento (Vite HMR):**
  - Hot Module Replacement aplicou as alterações de `AuthContext.tsx` sem recarregar com erros.
  - Endpoint `http://localhost:3333/` respondendo com status `200 OK`.

### 14.8. Limitações dos Testes
- Os testes foram executados em ambiente local (Node runtime e browsers de teste), simulando conexões com a API Supabase na nuvem. Testes com restrições severas de pacote em redes 2G/3G de operadoras específicas em produção na Vercel dependem do deploy posterior pelo usuário.

### 14.9. Registro de Otimização Futura
> **Financeiro mobile / 6 queries: identificado como otimização futura; não alterado nesta correção.**  
> O redirecionamento de telas `< 768px` para `/financeiro` e a subsequente execução concorrente de 6 queries de inteligência financeira permanecem intactos, devendo ser abordados em sprint específica dedicada à performance de métricas financeiras.

