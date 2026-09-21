import fs from 'node:fs'

const file = 'src/components/admin/super-domains/pessoas/FornecedoresSection.tsx'
let content = fs.readFileSync(file, 'utf8')

const replacements = new Map([
  ['N�o', 'Não'], ['poss�vel', 'possível'], ['ativa��o', 'ativação'],
  ['notifica��o', 'notificação'], ['Notifica��o', 'Notificação'], ['h�', 'há'],
  ['Relat�rio', 'Relatório'], ['C�digo', 'Código'], ['d�gitos', 'dígitos'],
  ['libera��o', 'liberação'], ['altera��o', 'alteração'], ['Servi�os', 'Serviços'],
  ['Conveni�ncia', 'Conveniência'], ['exclu�do', 'excluído'], ['Exclu�do', 'Excluído'],
  ['Endere�o', 'Endereço'], ['Raz�o', 'Razão'], ['A��es', 'Ações'],
  ['Previs�o', 'Previsão'], ['Benef�cio', 'Benefício'], ['Diret�rio', 'Diretório'],
  ['f�sico', 'físico'], ['n�mero', 'número'], ['Conv�nios', 'Convênios'],
  ['Dossi�', 'Dossiê'], ['Acredita��o', 'Acreditação'], ['suspens�o', 'suspensão'],
  ['inativa��o', 'inativação'], ['informa��es', 'informações'], ['Navega��o', 'Navegação'],
  ['FORMUL�RIO', 'FORMULÁRIO'], ['�tica', 'Ótica'], ['P�gina', 'Página'],
  ['p�gina', 'página'], ['amig�vel', 'amigável'], ['Sa�de', 'Saúde'],
  ['�ticas', 'Óticas'], ['Alimenta��o', 'Alimentação'], ['Descri��o', 'Descrição'],
  ['Apresenta��o', 'Apresentação'], ['condi��es', 'condições'], ['valida��o', 'validação'],
  ['conv�nio', 'convênio'], ['Pr�-visualiza��o', 'Pré-visualização'],
  ['Configura��o', 'Configuração'], ['Op��o', 'Opção'], ['din�mico', 'dinâmico'],
  ['�nico', 'único'], ['identifica��o', 'identificação'], ['Sele��o', 'Seleção'],
  ['Autom�tico', 'Automático'], ['abrir�', 'abrirá'], ['at�', 'até'],
  ['inser��o', 'inserção'], ['benef�cio', 'benefício'], ['Instru��es', 'Instruções'],
  ['Utiliza��o', 'Utilização'], ['recep��o', 'recepção'], ['M�tricas', 'Métricas'],
  ['�ltimo', 'Último'], ['rela��o', 'relação'], ['C�lculo', 'Cálculo'],
  ['Informa��es', 'Informações'], ['Identifica��o', 'Identificação'], ['an�lise', 'análise'],
  ['Solicita��o', 'Solicitação'], ['hor�rios', 'horários'], ['p�blica', 'pública'],
  ['Bot�o', 'Botão'], ['Se��o', 'Seção'], ['R�pida', 'Rápida'],
  ['Exclus�o', 'Exclusão'], ['ser�', 'será'], ['n�o', 'não'], ['cat�logo', 'catálogo'],
  ['raz�o', 'razão'], ['Libera��o', 'Liberação'], ['P�blica', 'Pública'],
  ['S�o', 'São'], ['padr�o', 'padrão'], ['SELE��O', 'SELEÇÃO'],
  ['ATIVA��O', 'ATIVAÇÃO'], ['op��es', 'opções'], ['op��o', 'opção'], ['ficar�', 'ficará'],
  ['BENEF�CIO', 'BENEFÍCIO'], ['aparecer�o', 'aparecerão'], ['Ativa��o', 'Ativação'],
  ['An�lise', 'Análise'], ['A��o', 'Ação'], ['Confirma��o', 'Confirmação'],
])

for (const [broken, fixed] of replacements) content = content.split(broken).join(fixed)

content = content
  .replaceAll('=� Ativo', 'Ativo')
  .replaceAll('=� Inativo', 'Inativo')
  .replaceAll('=� Em análise', 'Em análise')
  .replaceAll('� Encerrado', 'Encerrado')
  .replaceAll('=4 Excluído', 'Excluído')
  .replaceAll('=� Solicitação:', 'Solicitação:')
  .replaceAll('= ', '')
  .replaceAll('(Exclusivo: s� pode', '(Exclusivo: só pode')
  .replaceAll('" <strong>Modo 24h Ativado:', '<strong>Modo 24h Ativado:')
  .replaceAll('" Nenhum benefício imediato', 'Nenhum benefício imediato')

if (content.includes('\uFFFD')) {
  const lines = content.split(/\r?\n/)
  const pending = lines
    .map((line, index) => line.includes('\uFFFD') ? `${index + 1}:${line}` : null)
    .filter(Boolean)
  throw new Error(`Ainda existem caracteres corrompidos:\n${pending.join('\n')}`)
}

fs.writeFileSync(file, content, {encoding: 'utf8'})
