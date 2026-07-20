export const PUBLIC_PROJECT_TYPES = [
  { value: 'site', label: 'Site institucional ou landing page' },
  { value: 'loja', label: 'Loja virtual' },
  { value: 'portal', label: 'Portal de clientes' },
  { value: 'sistema', label: 'Sistema web' },
  { value: 'aplicativo', label: 'Aplicativo mobile' },
  { value: 'automacao', label: 'Automação de processos' },
  { value: 'suporte', label: 'Suporte e relacionamento' },
] as const;

export type PublicProjectType = (typeof PUBLIC_PROJECT_TYPES)[number]['value'];

export const PUBLIC_PROJECT_TYPE_LABELS: Record<PublicProjectType, string> = Object.fromEntries(
  PUBLIC_PROJECT_TYPES.map(({ value, label }) => [value, label]),
) as Record<PublicProjectType, string>;

export function isPublicProjectType(value: string): value is PublicProjectType {
  return PUBLIC_PROJECT_TYPES.some((item) => item.value === value);
}
