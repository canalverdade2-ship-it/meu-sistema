# Relatório Técnico de Levantamento e Auditoria — Mobile Codebase (gsa-admin-mobile)

**Data da Auditoria:** 2026-09-19  
**Investigador:** Mobile Codebase Explorer  
**Diretório Alvo:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\gsa-admin-mobile`  
**Objetivo:** Mapear e documentar a arquitetura, telas existentes, layout de navegação, stack de UI/ícones, cliente Supabase, dependências e prontidão técnica do aplicativo móvel React Native / Expo.

---

## 1. Resumo Executivo

O projeto `gsa-admin-mobile` é uma aplicação React Native baseada no ecossistema Expo (versão de ponta Expo SDK ~57 com React 19 e React Native 0.86). A análise detalhada da base de código revelou os seguintes pontos críticos:

1. **Estrutura de Telas Unificada em Arquivo Único:**
   - O diretório `src/screens/` **não existe**. Todas as telas móveis estão consolidadas em um único arquivo: `gsa-admin-mobile/src/Screens.tsx` (678 linhas).
2. **Navegação State-Based sem Biblioteca Externa:**
   - O aplicativo **não utiliza** `@react-navigation` nem `expo-router`.
   - A navegação é gerenciada puramente por estado local no `App.tsx` via `useState` (`currentScreen`), renderizando condicionalmente os componentes de tela.
   - O Drawer (Menu Lateral) é um overlay customizado em React Native puro com backdrop e lista de botões.
3. **Ícones em Emojis Unicode:**
   - Nem `lucide-react-native` nem `@expo/vector-icons` estão instalados. Todos os ícones atuais na interface são emojis nativos do sistema operacional (ex: 📊, 👥, 📝, 🛒).
4. **Integração com Supabase VPS:**
   - O cliente Supabase (`supabase.ts`) aponta diretamente para o servidor VPS de produção via `https://api.147-15-43-141.nip.io`, com persistência de sessão configurada via `@react-native-async-storage/async-storage`.
   - O fluxo de autenticação utiliza a Edge Function `gsa-auth-session` para validar PIN de 6 dígitos e sincronizar sessão do Supabase Auth.
5. **Status de Compilação TypeScript:**
   - A execução de `npx tsc --noEmit` atualmente **falha com código de saída 1** devido a 2 erros de tipagem `TS7006: Parameter 'val' implicitly has an 'any' type` em callbacks de `Alert.prompt` nas linhas 115 e 146 de `src/Screens.tsx`.
   - Além disso, `Alert.prompt` é uma API exclusiva do iOS no React Native; no Android causará falhas silenciosas ou exceções de runtime se acionada sem polyfill/modal.
6. **Disparidade de Escopo (Web ERP vs Mobile):**
   - No ERP Web (`src/components/admin/`) existem **149 componentes `.tsx`**, enquanto no mobile existem apenas 12 telas registradas (sendo 3 stubs de "em desenvolvimento" e a maioria listas somente-leitura com limite de 50 registros).

---

## 2. Inventário de Arquivos do Projeto Mobile

A estrutura física do diretório `gsa-admin-mobile` é composta por:

```
gsa-admin-mobile/
├── .expo/                   # Configuração e caches locais do Expo
├── assets/                  # Imagens e ícones de build (splash, adaptive icons)
├── src/
│   └── Screens.tsx          # TODAS as telas do sistema móvel (678 linhas)
├── App.tsx                  # Ponto de entrada, autenticação, drawer e roteamento (575 linhas)
├── app.json                 # Manifesto de configuração do Expo 57
├── index.ts                 # Registro do root component via expo
├── package.json             # Dependências e scripts npm
├── tsconfig.json            # Configuração do TypeScript (strict mode)
├── supabase.ts              # Inicialização do client Supabase
├── AGENTS.md                # Diretriz de documentação para Expo v57
├── editApp.js               # Script utilitário node para mutação de App.tsx
└── editScreens.js           # Script utilitário node para injeção em Screens.tsx
```

---

## 3. Análise Detalhada de Telas (`src/Screens.tsx`)

Todas as telas do aplicativo estão co-localizadas em `src/Screens.tsx`. Abaixo está a análise técnica exaustiva de cada componente exportado:

| Tela | Linhas | Estado de Implementação | Queries Supabase | Nível de Interatividade |
|---|---|---|---|---|
| **ClientesScreen** | 7–347 | **Completa (Master-Detail)** | `clientes`, `orcamentos`, `faturas`, `ordens_servico` | Alta: Edição de cliente, criação de orçamento, ajuste de saldo e pontos, tabs de histórico |
| **OrcamentosScreen** | 349–381 | **Funcional (Lista Leitura)** | `orcamentos` (order `data_criacao` desc, limit 50) | Baixa: Listagem em cards com código, status e valor total |
| **DemandasScreen** | 383–414 | **Funcional (Lista Leitura)** | `prestador_demandas` (limit 50) | Baixa: Listagem com ID curto e badge de status |
| **FinanceiroScreen** | 416–451 | **Funcional (Lista Leitura)** | `faturas` (status: pendente/vencida/atrasado, limit 50) | Média: Exibição de valor total e data de vencimento formatada em PT-BR |
| **LojaScreen** | 454–480 | **Funcional (Lista Leitura)** | `produtos` (limit 50) | Baixa: Listagem de produtos com nome e preço formatado |
| **ViagensScreen** | 482–489 | **Stub (Em Desenvolvimento)** | Nenhuma | Nula: Renderiza mensagem "Módulo em desenvolvimento" |
| **AfiliadosScreen** | 491–516 | **Funcional (Lista Leitura)** | `afiliados` (limit 50) | Baixa: Listagem com nome do afiliado |
| **CobrancaScreen** | 518–546 | **Funcional (Lista Leitura)** | `faturas` (status: vencida/atrasada, limit 50) | Baixa: Exibe cards de faturas vencidas em destaque vermelho |
| **AtendimentoScreen** | 548–574 | **Funcional (Lista Leitura)** | `atendimentos` (limit 50) | Baixa: Listagem com assunto/título e badge de status |
| **PromocoesScreen** | 576–601 | **Funcional (Lista Leitura)** | `promocoes` (limit 50) | Baixa: Listagem de promoções cadastradas |
| **RelatoriosScreen** | 603–610 | **Stub (Em Desenvolvimento)** | Nenhuma | Nula: Mensagem "Módulo em desenvolvimento" |
| **ConfiguracoesScreen** | 612–619 | **Stub (Em Desenvolvimento)** | Nenhuma | Nula: Mensagem "Módulo em desenvolvimento" |

### 3.1. Destaque: `ClientesScreen`
A tela de clientes é a única com arquitetura completa de dois níveis (Listagem + Painel Detalhado):
- **Lista:** Renderiza `FlatList` com 50 clientes ordenados por data de cadastro mais recente. Ao clicar em um card, ativa `selectedClient`.
- **Visão Detalhada:**
  - Header com botão de voltar, botão "Editar" e botão "+ Orçamento".
  - Barra de abas rolável horizontalmente (`ScrollView horizontal`): `['Dados', 'Carteira', 'Pontos', 'Orçamentos', 'Faturas', 'OS']`.
  - **Aba Dados:** Exibe documento (CPF/CNPJ), contato (telefone, e-mail) e endereço formatado (logradouro, número, complemento, bairro, cidade, estado, CEP).
  - **Aba Carteira:** Exibe o `saldo_carteira` formatado e botões `+ Adicionar` e `- Subtrair` que acionam `handleAdjustBalance`.
  - **Aba Pontos:** Exibe o `saldo_pontos` e botões `+ Adicionar` e `- Subtrair` que acionam `handleAdjustPoints`.
  - **Aba Orçamentos:** Carrega orçamentos vinculados ao cliente (`cliente_id`).
  - **Aba Faturas:** Carrega faturas vinculadas ao cliente (`cliente_id`).
  - **Aba OS:** Carrega ordens de serviço vinculadas ao cliente (`cliente_id`).
- **Modais:**
  - `editModalVisible`: Modal com formulário de `nome`, `cpf`, `email`, `telefone`, atualizando via `supabase.from('clientes').update(...)`.
  - `orcamentoModalVisible`: Modal com formulário de `total` e `status`, inserindo via `supabase.from('orcamentos').insert(...)`.
- **Problema de Portabilidade Detectado:** Os métodos `handleAdjustBalance` (linhas 108–136) e `handleAdjustPoints` (linhas 138–167) utilizam `Alert.prompt()`. Essa função faz parte da API do React Native apenas para iOS; em Android não funciona nativamente.

---

## 4. Arquitetura de Navegação e Roteamento (`App.tsx`)

### 4.1. Mecânica de Navegação
O arquivo `App.tsx` controla toda a visualização sem nenhuma dependência de bibliotecas de navegação como React Navigation ou Expo Router:

1. **Estado de Tela:**
   ```typescript
   const [currentScreen, setCurrentScreen] = useState<
     'dashboard' | 'clientes' | 'orcamentos' | 'demandas' | 'financeiro' | 
     'loja' | 'viagens' | 'afiliados' | 'cobranca' | 'atendimento' | 
     'promocoes' | 'relatorios' | 'configuracoes'
   >('dashboard');
   ```
2. **Renderização Condicional:**
   - Se `currentScreen === 'dashboard'`: renderiza o ScrollView do Dashboard (métricas, cards e atalhos).
   - Se `currentScreen !== 'dashboard'`: renderiza um container flexível com o componente ativo:
     ```tsx
     {currentScreen === 'clientes' && <ClientesScreen />}
     {currentScreen === 'orcamentos' && <OrcamentosScreen />}
     ...
     ```
3. **Barra Superior (Header):**
   - Ícone Hamburger (`☰`) abre o drawer.
   - Botão dinâmico `← Voltar` para retornar ao Dashboard (`setCurrentScreen('dashboard')`).
   - Título dinâmico obtido via função `getHeaderTitle()`.
   - Botão de logout (`Sair`) que desconecta a sessão.

### 4.2. Drawer Menu Customizado
- Gerenciado pelo estado booleano `isMenuOpen`.
- Implementado como um container com `position: 'absolute'`, ocupando 100% da viewport com fundo semi-transparente `rgba(0,0,0,0.5)`.
- Possui uma área de toque `menuCloseArea` que fecha o menu ao tocar fora.
- O container de itens tem largura máxima de 300px e lista os 13 módulos registrados:
  - 📊 Dashboard
  - 👥 Cadastros e Clientes
  - 📝 Orçamentos e OS
  - 📋 Demandas (Prestadores)
  - 🛒 GSA Store (Loja)
  - ✈️ GSA Viagens
  - 🤝 GSA Afiliados
  - 💰 Financeiro
  - ⚖️ Cobrança
  - 🎧 Atendimento (Tickets)
  - ⭐ Promoções e Fidelidade
  - 📈 Relatórios
  - ⚙️ Configurações

### 4.3. Fluxo de Autenticação
1. **Inicialização:**
   - Na montagem do componente, executa `loadSession()` lendo a chave `@gsa_admin_session` do `AsyncStorage`.
   - Se existir sessão armazenada, carrega os dados e busca as métricas do dashboard (`fetchDashboardData`).
2. **Tela de Login:**
   - Exibida quando `session === null`.
   - Solicita PIN numérico de 4 a 6 dígitos (`keyboardType="numeric"`, `secureTextEntry`).
   - Invoca a Edge Function via Supabase:
     ```typescript
     await supabase.functions.invoke('gsa-auth-session', {
       body: { action: 'login_admin', payload: { code: pin.trim() } },
     });
     ```
   - Valida a resposta `data.valid`. Caso positivo, extrai credenciais de serviço (`email` e `password`) e autentica na instância do Supabase Auth via `supabase.auth.signInWithPassword({ email, password })`.
   - Salva a sessão no `AsyncStorage` e direciona para o Dashboard.
3. **Logout:**
   - `handleLogout()` limpa o estado da sessão, remove `@gsa_admin_session` do AsyncStorage e chama `supabase.auth.signOut()`.

### 4.4. Pipeline de Dados do Dashboard
A função `fetchDashboardData` executa em paralelo:
1. Chamada RPC: `supabase.rpc('gsa_admin_dashboard_snapshot', { p_sessao_id, p_session_token })`.
2. Quatro consultas simultâneas via `Promise.all`:
   - `supabase.from('clientes').select('id', { count: 'exact', head: true })`
   - `supabase.from('orcamentos').select('id', { count: 'exact', head: true })`
   - `supabase.from('prestador_demandas').select('id', { count: 'exact', head: true })`
   - `supabase.from('faturas').select('valor_total').eq('status', 'pendente')`
3. Agrega e calcula a soma das faturas pendentes, populando o estado `dashboardData`.

---

## 5. UI Components, Estilização e Bibliotecas de Ícones

### 5.1. Componentes de UI
- **Padrão:** O projeto utiliza exclusivamente componentes primitivos nativos do React Native:
  - `View`, `Text`, `TextInput`, `TouchableOpacity`, `ScrollView`, `FlatList`, `Modal`, `Button`, `ActivityIndicator`, `SafeAreaView`, `StatusBar`, `Alert`.
- **Ausência de Component Libraries:** Não há bibliotecas de componentes instaladas (como NativeWind, React Native Paper, Tamagui, Gluestack ou UI Kitten).

### 5.2. Sistema de Estilos e Tokens
- Estilização realizada puramente via `StyleSheet.create()`.
- **Paleta de Cores do App:**
  - Azul Institucional GSA (Primary): `#17345f`
  - Fundo Geral (Background): `#f0f2f5`
  - Superfícies (Cards/Modals): `#ffffff`
  - Sucesso / Positivo: `#10b981`
  - Erro / Negativo / Vencido: `#ef4444`
  - Secundárias / Badges: `#4f46e5`, `#3b82f6`, `#8b5cf6`, `#6366f1`, `#f43f5e`
  - Neutros / Textos: `#111827`, `#374151`, `#4b5563`, `#6b7280`, `#d1d5db`, `#e5e7eb`

### 5.3. Iconografia
- **Status:** **NENHUMA** biblioteca de ícones vetoriais está instalada (nem `lucide-react-native`, nem `@expo/vector-icons`, nem `react-native-vector-icons`).
- O aplicativo utiliza emojis Unicode em strings de texto para todos os elementos gráficos:
  - Menu e cards: 📊, 👥, 📝, 📋, 🛒, ✈️, 🤝, 💰, ⚖️, 🎧, ⭐, 📈, ⚙️
  - Ações e botões: ☰ (hambúrguer), ← (voltar), → (seta de atalho), ↻ (atualizar)

---

## 6. Configuração do Cliente Supabase (`supabase.ts`)

O arquivo `gsa-admin-mobile/supabase.ts` é responsável pela conectividade backend:

```typescript
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.147-15-43-141.nip.io';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

**Observações Técnicas:**
1. **Endpoint Remoto:** Conecta diretamente ao servidor VPS externo através do domínio dinâmico `nip.io` apontando para o IP `147.15.43.141`.
2. **Polyfill:** Importa `react-native-url-polyfill/auto` na primeira linha para compatibilizar a API `URL` do WHATWG no ambiente JavaScriptCore/Hermes do React Native.
3. **Persistência de Sessão:** Utiliza `@react-native-async-storage/async-storage` como storage adapter para persistência segura dos tokens JWT do Supabase Auth.
4. **Desativação de detecção de URL:** `detectSessionInUrl: false` configurado adequadamente para evitar tentativas de ler parâmetros de URL que não existem no mobile nativo.

---

## 7. Dependências, Scripts e Configuração de Build

### 7.1. Análise do `package.json`
```json
{
  "name": "gsa-admin-mobile",
  "version": "1.0.0",
  "main": "index.ts",
  "dependencies": {
    "@expo/metro-runtime": "~57.0.16",
    "@react-native-async-storage/async-storage": "2.2.0",
    "@supabase/supabase-js": "^2.116.0",
    "expo": "~57.0.24",
    "expo-secure-store": "~57.0.4",
    "expo-status-bar": "~57.0.1",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-native": "0.86.3",
    "react-native-url-polyfill": "^4.0.0",
    "react-native-web": "^0.21.2"
  },
  "devDependencies": {
    "@types/react": "~19.2.2",
    "typescript": "~6.0.3"
  },
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "private": true
}
```

### 7.2. Análise do `tsconfig.json`
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  }
}
```

### 7.3. Diagnóstico de Compilação TypeScript (`npx tsc --noEmit`)
A execução do compilador estrito acusou 2 erros críticos no código atual:
```
src/Screens.tsx(115,27): error TS7006: Parameter 'val' implicitly has an 'any' type.
src/Screens.tsx(146,27): error TS7006: Parameter 'val' implicitly has an 'any' type.
```
- **Causa:** O `tsconfig.json` ativa `"strict": true`, proibindo parâmetros implícitos do tipo `any`. Em `handleAdjustBalance` e `handleAdjustPoints`, o callback `onPress: async (val) =>` não declara a tipagem do argumento `val`.
- **Impacto no Critério de Aceitação:** O requisito de compilação com código de saída 0 no TypeScript é violado no baseline atual. A correção requer tipar `(val?: string)` ou migrar para um modal compatível com Android/iOS.

---

## 8. Mapeamento Comparativo: Web ERP vs App Mobile

No projeto Web (`src/components/admin/`), foram identificados **149 arquivos `.tsx`** organizados por super-domínios operacionais. Abaixo está o balanço da cobertura atual do aplicativo móvel:

| Domínio Operacional Web | Exemplos de Módulos Web Existentes | Situação Atual no Mobile |
|---|---|---|
| **Pessoas & Clientes** | `ClientesModule.tsx`, `PrestadoresModule.tsx`, `FornecedoresModule.tsx`, `CollaboratorDashboard.tsx` | `ClientesScreen` implementada; Prestadores/Fornecedores/Colaboradores ausentes |
| **Comercial & Vendas** | `OrcamentosModule.tsx`, `ProdutosModule.tsx`, `PromocoesModule.tsx`, `CuponsLojaModule.tsx` | `OrcamentosScreen`, `LojaScreen`, `PromocoesScreen` (apenas listas de 50 itens) |
| **Financeiro & Fiscal** | `FinanceiroModule.tsx`, `CobrancaModule.tsx`, `FiscalModule.tsx`, `CreditoModule.tsx`, `EmprestimosModule.tsx` | `FinanceiroScreen` e `CobrancaScreen` (apenas listas de faturas) |
| **Operações & Serviços** | `OrdensServicoModule.tsx`, `DemandasColaboradorModule.tsx`, `ServicePackagesModule.tsx` | `DemandasScreen` (lista básica de prestador_demandas) |
| **Parcerias & Afiliados** | `AffiliateAdminModule.tsx`, `PartnersAdminModule.tsx`, `IndicacoesModule.tsx` | `AfiliadosScreen` (lista básica) |
| **Comunicação & Suporte** | `AtendimentoScreen` (web tickets/chat), `GsaTvModule.tsx`, `GsaTvControlRoom.tsx` | `AtendimentoScreen` (lista básica) |
| **Viagens & Lazer** | `ViagensModule.tsx` / `TourismModule.tsx` | `ViagensScreen` (stub: em desenvolvimento) |
| **Relatórios & BI** | `RelatoriosModule.tsx`, `PainelRentabilidade.tsx`, `PromoAnalytics.tsx` | `RelatoriosScreen` (stub: em desenvolvimento) |
| **Configuração & Sistema**| `ConfiguracoesModule.tsx`, `AcessosModule.tsx`, `EmpresaModule.tsx` | `ConfiguracoesScreen` (stub: em desenvolvimento) |

---

## 9. Recomendações Técnicas para a Equipe de Implementação

1. **Modularização de Telas (`src/screens/`):**
   - Refatorar o arquivo monolítico `src/Screens.tsx` em módulos organizados por pastas, por exemplo:
     - `src/screens/clientes/ClientesScreen.tsx`
     - `src/screens/orcamentos/OrcamentosScreen.tsx`
     - `src/screens/financeiro/FinanceiroScreen.tsx`
     - etc.
2. **Correção Imediata do TypeScript:**
   - Tipar explicitamente os parâmetros de `Alert.prompt` como `(val?: string) => void` para restaurar o `tsc --noEmit` para exit code 0.
   - Substituir o uso de `Alert.prompt` por um componente customizado de modal de entrada de valor, garantindo funcionamento tanto no Android quanto no iOS.
3. **Adoção de Biblioteca de Ícones:**
   - Instalar `@expo/vector-icons` ou `lucide-react-native` (com `react-native-svg`), eliminando o uso de emojis de texto que variam visualmente dependendo do aparelho.
4. **Evolução da Arquitetura de Navegação:**
   - Para suportar os 50+ módulos do ERP com facilidade de manutenção, sub-rotas e parâmetros de navegação, avaliar a introdução de uma estrutura de roteamento tipada ou um índice modular de navegação escalável.
5. **Componentização e Design System Mobile:**
   - Extrair componentes reutilizáveis (Card de Listagem, Header Padrão, Badge de Status, Empty State, Search Input) para `src/components/common/`.
