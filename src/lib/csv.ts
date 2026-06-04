export interface CsvRow {
  referencia: string
  nombre: string
  medidas: string
  calidad: string
}

const REQUIRED_COLUMNS = ['referencia', 'nombre', 'medidas', 'calidad']
const EMPTY_VALUES = ['', 'none', 'nan']

function normalise(value: string): string {
  const trimmed = value.trim()
  return EMPTY_VALUES.includes(trimmed.toLowerCase()) ? '' : trimmed
}

export function parseCatalogCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '')
  const firstLine = lines[0]
  if (!firstLine) return []

  const headers = firstLine.split(',').map(h => h.trim().toLowerCase())

  const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col))
  if (missing.length > 0) {
    throw new Error(`Columnas requeridas no encontradas: ${missing.join(', ')}`)
  }

  const idx = {
    referencia: headers.indexOf('referencia'),
    nombre: headers.indexOf('nombre'),
    medidas: headers.indexOf('medidas'),
    calidad: headers.indexOf('calidad'),
  }

  return lines.slice(1).map(line => {
    const cells = line.split(',')
    return {
      referencia: normalise(cells[idx.referencia] ?? ''),
      nombre: normalise(cells[idx.nombre] ?? ''),
      medidas: normalise(cells[idx.medidas] ?? ''),
      calidad: normalise(cells[idx.calidad] ?? ''),
    }
  })
}
