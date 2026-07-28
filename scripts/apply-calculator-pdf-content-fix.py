from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / 'src/components/public/FreeToolsAdditionalCalculators.tsx'
CONTRACT = ROOT / 'scripts/check-free-tools-pdf-contracts.ts'

component = COMPONENT.read_text(encoding='utf-8')
contract = CONTRACT.read_text(encoding='utf-8')

labels_block = """const BENEFIT_LABELS: Record<InssBenefitType, string> = {
  temporary_incapacity: 'Auxílio por incapacidade temporária (Auxílio-doença)',
  maternity: 'Salário-maternidade',
  death_pension: 'Pensão por morte previdenciária',
  accident_assistance: 'Auxílio-acidente de qualquer natureza',
};
"""

documents_block = labels_block + """

const BENEFIT_DOCUMENTS: Record<InssBenefitType, string[]> = {
  temporary_incapacity: [
    'Documento de identificação com CPF',
    'Carteira de trabalho, carnês ou comprovantes de contribuição',
    'Atestado, laudo e exames médicos com data, assinatura e identificação profissional',
    'Comprovante do afastamento e informações do empregador, quando houver',
  ],
  maternity: [
    'Documento de identificação com CPF',
    'Certidão de nascimento, termo de guarda ou documento do evento gerador',
    'Carteira de trabalho, carnês ou comprovantes de contribuição',
    'Comprovantes da atividade e do vínculo no período analisado',
  ],
  death_pension: [
    'Documento de identificação e CPF do requerente',
    'Certidão de óbito do segurado',
    'Documentos do vínculo previdenciário e da qualidade de segurado',
    'Certidões e comprovantes da condição de dependente ou da dependência econômica',
  ],
  accident_assistance: [
    'Documento de identificação com CPF',
    'Carteira de trabalho, carnês ou comprovantes de contribuição',
    'Comunicação do acidente, quando existente',
    'Laudos, exames e relatórios que demonstrem sequela permanente e redução da capacidade',
  ],
};
"""

if labels_block not in component:
    raise RuntimeError('Bloco de rótulos de benefícios não encontrado.')
component = component.replace(labels_block, documents_block, 1)

checklist_block = """      {
        title: 'Checklist detalhado de requisitos',
        rows: result.requirements.map((req) => ({
          label: req.label,
          value: `${req.met ? 'Atingido' : 'Pendente'} - ${req.detail}`,
        })),
      },
"""

checklist_with_documents = checklist_block + """      {
        title: 'Documentos iniciais para separar',
        items: BENEFIT_DOCUMENTS[benefitType],
      },
"""

if checklist_block not in component:
    raise RuntimeError('Checklist do relatório Pro de benefícios não encontrado.')
component = component.replace(checklist_block, checklist_with_documents, 1)

old_bpc = "assert.match(additional, /Análise detalhada dos critérios/, 'BPC Pro deve incluir todos os critérios no PDF completo.');"
new_bpc = """assert.match(additional, /Análise dos Limites Legais em 2026/, 'BPC Pro deve comparar os limites legais no PDF completo.');
assert.match(additional, /Requisitos Cadastrais e Legais/, 'BPC Pro deve incluir todos os critérios cadastrais e legais.');"""
if old_bpc not in contract:
    raise RuntimeError('Contrato antigo do BPC não encontrado.')
contract = contract.replace(old_bpc, new_bpc, 1)

COMPONENT.write_text(component, encoding='utf-8')
CONTRACT.write_text(contract, encoding='utf-8')
print('Conteúdo dos PDFs Pro corrigido com sucesso.')
