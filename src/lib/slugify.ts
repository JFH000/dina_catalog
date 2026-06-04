export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function generateCatalogSlug(name: string): string {
  const base = slugify(name)
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}
