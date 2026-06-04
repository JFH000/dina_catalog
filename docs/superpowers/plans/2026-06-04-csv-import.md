# CSV Product Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let owners import products into a catalog by uploading a CSV file with columns referencia, nombre, medidas, calidad.

**Architecture:** Pure `parseCatalogCsv` utility handles all CSV logic and is fully unit-tested. A new `importProducts` store method calls `addProduct` per row. `CatalogDetailView` adds a hidden file input and "Importar CSV" button that wires everything together.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vitest

---

## File Map

### New files
- `src/lib/csv.ts` — CSV parsing and validation utility
- `src/lib/__tests__/csv.test.ts` — unit tests for the utility

### Modified files
- `src/stores/products.ts` — add `importProducts` method
- `src/views/owner/CatalogDetailView.vue` — add CSV import button and handler

---

## Task 1: CSV parsing utility (TDD)

**Files:**
- Create: `src/lib/__tests__/csv.test.ts`
- Create: `src/lib/csv.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/csv.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/lib/__tests__/csv.test.ts
```

Expected: FAIL — "Cannot find module '../csv'"

- [ ] **Step 3: Implement csv.ts**

Create `src/lib/csv.ts`:

```typescript
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
  if (lines.length === 0) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/lib/__tests__/csv.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run
```

Expected: All 33 tests PASS (24 existing + 9 new).

- [ ] **Step 6: Commit**

```bash
git add src/lib/csv.ts src/lib/__tests__/csv.test.ts
git commit -m "feat: add CSV parsing utility with tests"
```

---

## Task 2: Add importProducts to products store

**Files:**
- Modify: `src/stores/products.ts`

- [ ] **Step 1: Add the import to the top of the file**

Read `src/stores/products.ts`. Add this import after the existing imports:

```typescript
import type { CsvRow } from '../lib/csv'
```

- [ ] **Step 2: Add importProducts method before the return statement**

In `src/stores/products.ts`, add this method before `return { ... }`:

```typescript
  async function importProducts(catalogId: string, rows: CsvRow[]): Promise<number> {
    let count = 0
    for (const row of rows) {
      await addProduct(catalogId, {
        reference: row.referencia,
        name: row.nombre,
        measurements: row.medidas,
        quality: row.calidad,
      })
      count++
    }
    return count
  }
```

- [ ] **Step 3: Add importProducts to the return object**

Change the return statement from:
```typescript
  return { products, fetchByCatalog, addProduct, updateProduct, toggleProductActive }
```
To:
```typescript
  return { products, fetchByCatalog, addProduct, updateProduct, toggleProductActive, importProducts }
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run
```

Expected: All 33 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/products.ts
git commit -m "feat: add importProducts method to products store"
```

---

## Task 3: Add CSV import UI to CatalogDetailView

**Files:**
- Modify: `src/views/owner/CatalogDetailView.vue`

- [ ] **Step 1: Add import at top of script**

In `src/views/owner/CatalogDetailView.vue`, add to the existing imports in `<script setup>`:

```typescript
import { parseCatalogCsv } from '../../lib/csv'
```

- [ ] **Step 2: Add refs and handler after the existing refs**

After the line `const selectedProduct = ref<Product | undefined>(undefined)`, add:

```typescript
const csvInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)
const importMessage = ref('')
const importError = ref(false)
```

And add this function after `toggleProduct`:

```typescript
async function onCsvChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  importMessage.value = ''
  importError.value = false
  importing.value = true
  try {
    const text = await file.text()
    const rows = parseCatalogCsv(text)
    if (rows.length === 0) {
      importMessage.value = 'El CSV no tiene filas'
      importError.value = true
      return
    }
    const count = await productStore.importProducts(catalog.value!.id, rows)
    importMessage.value = `${count} producto${count !== 1 ? 's' : ''} importado${count !== 1 ? 's' : ''}`
  } catch (e: any) {
    importMessage.value = e.message
    importError.value = true
  } finally {
    importing.value = false
    if (csvInput.value) csvInput.value.value = ''
  }
}
```

- [ ] **Step 3: Update the template header-actions section**

Replace this block in the template:
```html
      <div class="header-actions">
        <button @click="toggleCatalog">
          {{ catalog.is_active ? 'Desactivar' : 'Activar' }}
        </button>
        <button class="primary" @click="openCreate">+ Agregar producto</button>
      </div>
```

With:
```html
      <div class="header-actions">
        <button @click="toggleCatalog">
          {{ catalog.is_active ? 'Desactivar' : 'Activar' }}
        </button>
        <input ref="csvInput" type="file" accept=".csv" style="display:none" @change="onCsvChange" />
        <button :disabled="importing" @click="csvInput?.click()">
          {{ importing ? 'Importando...' : 'Importar CSV' }}
        </button>
        <button class="primary" @click="openCreate">+ Agregar producto</button>
      </div>
```

- [ ] **Step 4: Add import message below the products section header**

In the template, replace:
```html
      <h2>Productos ({{ productStore.products.length }})</h2>
```
With:
```html
      <h2>Productos ({{ productStore.products.length }})</h2>
      <p v-if="importMessage" :class="importError ? 'error' : 'import-msg'">{{ importMessage }}</p>
```

- [ ] **Step 5: Add import-msg style**

In the `<style scoped>` section, add after `.empty { color: #9ca3af; }`:

```css
.import-msg { margin-bottom: 0.75rem; color: #166534; font-size: 0.9rem; }
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run
```

Expected: All 33 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/views/owner/CatalogDetailView.vue
git commit -m "feat: add CSV import button to catalog detail view"
```
