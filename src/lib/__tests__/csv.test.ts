import { describe, it, expect } from 'vitest'
import { parseCatalogCsv } from '../csv'

describe('parseCatalogCsv', () => {
  it('returns rows for a valid CSV', () => {
    const csv = 'referencia,nombre,medidas,calidad\nREF-01,Camisa,L,Alta'
    const rows = parseCatalogCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ referencia: 'REF-01', nombre: 'Camisa', medidas: 'L', calidad: 'Alta' })
  })

  it('throws when required columns are missing', () => {
    const csv = 'referencia,nombre\nREF-01,Camisa'
    expect(() => parseCatalogCsv(csv)).toThrow('Columnas requeridas no encontradas: medidas, calidad')
  })

  it('accepts columns in any order', () => {
    const csv = 'calidad,nombre,referencia,medidas\nAlta,Camisa,REF-01,L'
    const rows = parseCatalogCsv(csv)
    expect(rows[0]).toEqual({ referencia: 'REF-01', nombre: 'Camisa', medidas: 'L', calidad: 'Alta' })
  })

  it('converts empty cells to empty string', () => {
    const csv = 'referencia,nombre,medidas,calidad\nREF-01,Camisa,,'
    const rows = parseCatalogCsv(csv)
    expect(rows[0].medidas).toBe('')
    expect(rows[0].calidad).toBe('')
  })

  it('converts None to empty string (case-insensitive)', () => {
    const csv = 'referencia,nombre,medidas,calidad\nREF-01,Camisa,None,NaN'
    const rows = parseCatalogCsv(csv)
    expect(rows[0].medidas).toBe('')
    expect(rows[0].calidad).toBe('')
  })

  it('ignores extra columns', () => {
    const csv = 'referencia,nombre,medidas,calidad,precio\nREF-01,Camisa,L,Alta,100'
    const rows = parseCatalogCsv(csv)
    expect(rows[0]).toEqual({ referencia: 'REF-01', nombre: 'Camisa', medidas: 'L', calidad: 'Alta' })
    expect(rows[0]).not.toHaveProperty('precio')
  })

  it('returns empty array for header-only CSV', () => {
    const csv = 'referencia,nombre,medidas,calidad'
    expect(parseCatalogCsv(csv)).toHaveLength(0)
  })

  it('handles Windows line endings (CRLF)', () => {
    const csv = 'referencia,nombre,medidas,calidad\r\nREF-01,Camisa,L,Alta'
    const rows = parseCatalogCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].referencia).toBe('REF-01')
  })

  it('is case-insensitive for column names', () => {
    const csv = 'Referencia,Nombre,Medidas,Calidad\nREF-01,Camisa,L,Alta'
    const rows = parseCatalogCsv(csv)
    expect(rows[0].referencia).toBe('REF-01')
  })
})
