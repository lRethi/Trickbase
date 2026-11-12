export const COLOR_DEFINITIONS = [
  { id: 'mente', label: 'Mente', aliases: ['mente', 'azul'], value: '#25b8e9' },
  { id: 'calma', label: 'Calma', aliases: ['calma', 'verde'], value: '#71d96d' },
  { id: 'ordem', label: 'Ordem', aliases: ['ordem', 'amarelo'], value: '#e6e936' },
  { id: 'corpo', label: 'Corpo', aliases: ['corpo', 'laranja'], value: '#ff963e' },
  { id: 'furia', label: 'Fúria', aliases: ['furia', 'fúria', 'vermelho'], value: '#f0445f' },
  { id: 'caos', label: 'Caos', aliases: ['caos', 'roxo'], value: '#a25ce9' }
]

export const COLOR_MAP = Object.fromEntries(COLOR_DEFINITIONS.map(color => [color.id, color.value]))
export const COLOR_LABELS = Object.fromEntries(COLOR_DEFINITIONS.map(color => [color.id, color.label]))

export function fold(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
}

const aliases = new Map(COLOR_DEFINITIONS.flatMap(color => color.aliases.map(alias => [fold(alias), color.id])))

export function canonicalColor(value) {
  const key = fold(value)
  if (key === 'incolor' || key === 'colorless' || key === 'sem cor') return null
  return aliases.get(key) ?? null
}

export function canonicalColorLabel(value) {
  const color = canonicalColor(value)
  if (color) return COLOR_LABELS[color]
  return fold(value) === 'incolor' ? 'Incolor' : String(value ?? '')
}

export function canonicalColors(values, options = {}) {
  const list = Array.isArray(values) ? values : []
  const colors = [...new Set(list.map(canonicalColor).filter(Boolean))]
  if (options.includeColorless && list.some(value => fold(value) === 'incolor')) return [...colors, 'incolor']
  return colors
}

export function isColorless(values) {
  return canonicalColors(values).length === 0
}

export function matchesColorFilter(values, requested) {
  const wanted = fold(requested)
  if (wanted === 'incolor' || wanted === 'colorless' || wanted === 'sem cor') return isColorless(values)
  const color = canonicalColor(requested)
  return Boolean(color && canonicalColors(values).includes(color))
}

export function colorValue(value) {
  return COLOR_MAP[canonicalColor(value)] ?? '#b9b2a8'
}
