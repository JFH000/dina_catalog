import { describe, it, expect } from 'vitest'
import { slugify, generateCatalogSlug } from '../slugify'

describe('slugify', () => {
  it('lowercases text', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('removes accents', () => {
    expect(slugify('Colección Verano')).toBe('coleccion-verano')
  })

  it('replaces spaces with hyphens', () => {
    expect(slugify('my catalog name')).toBe('my-catalog-name')
  })

  it('removes special characters', () => {
    expect(slugify('Catálogo #1!')).toBe('catalogo-1')
  })

  it('collapses multiple spaces', () => {
    expect(slugify('hello   world')).toBe('hello-world')
  })
})

describe('generateCatalogSlug', () => {
  it('starts with slugified name', () => {
    const result = generateCatalogSlug('Mi Catálogo')
    expect(result).toMatch(/^mi-catalogo-/)
  })

  it('ends with 4-char alphanumeric suffix', () => {
    const result = generateCatalogSlug('Test')
    expect(result).toMatch(/^test-[a-z0-9]{4}$/)
  })

  it('generates different slugs for the same name', () => {
    const a = generateCatalogSlug('Verano')
    const b = generateCatalogSlug('Verano')
    expect(a).not.toBe(b)
  })
})
