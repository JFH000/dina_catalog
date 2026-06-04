# CSV Product Import — Design Spec

**Date:** 2026-06-04  
**Status:** Approved

---

## Overview

Add a "Importar CSV" button to the catalog detail page. The owner selects a CSV file with columns `referencia`, `nombre`, `medidas`, `calidad`. The app validates the columns, parses rows (treating empty/None/NaN as empty string), and creates one product per row via the existing `addProduct` store method. Shows a result count on success or an error message on invalid format.

---

## CSV Format

- Required columns (case-insensitive): `referencia`, `nombre`, `medidas`, `calidad`
- Extra columns are ignored
- Empty cells, `None`, and `NaN` values are converted to empty string `""`
- Header row required
- Comma-separated

---

## New File: `src/lib/csv.ts`

Pure utility with one exported function:

```
parseCatalogCsv(text: string): Array<{ referencia: string; nombre: string; medidas: string; calidad: string }>
```

- Splits text into lines, detects header row
- Validates that all four required columns are present (case-insensitive matching); throws `Error("Columnas requeridas no encontradas: ...")` if any are missing
- For each data row: maps values by column index, normalises empty/`None`/`NaN` to `""`
- Returns the array of row objects (may be empty if file has only a header)

Tested with TDD in `src/lib/__tests__/csv.test.ts`.

---

## Store Change: `src/stores/products.ts`

New method `importProducts(catalogId, rows)`:

```typescript
importProducts(
  catalogId: string,
  rows: Array<{ referencia: string; nombre: string; medidas: string; calidad: string }>
): Promise<number>
```

- Calls `addProduct` in sequence for each row with `fields = { reference: row.referencia, name: row.nombre, measurements: row.medidas, quality: row.calidad }` and no image
- Returns count of successfully created products

---

## View Change: `CatalogDetailView.vue`

- Add `importing: ref(false)` and `importMessage: ref("")`
- Add hidden `<input type="file" ref="csvInput" accept=".csv">` in template
- Add "Importar CSV" button that triggers `csvInput.click()` and is disabled when `importing`
- `onCsvChange` handler:
  1. Reads file as text
  2. Calls `parseCatalogCsv` — on error: sets `importMessage` to the error text, returns
  3. Calls `productStore.importProducts(catalogId, rows)`
  4. Sets `importMessage` to `"${count} productos importados"` (or `"El CSV no tiene filas"` if count is 0)
  5. Resets file input so the same file can be re-selected

---

## Error Handling

| Situation | Result |
|-----------|--------|
| Missing required column | Error message shown, nothing imported |
| Row with empty fields | Imported with empty strings |
| Empty CSV (header only) | Message: "El CSV no tiene filas" |
| Network error during insert | Error message from Supabase shown |

---

## Out of Scope

- Image column in CSV
- Duplicate detection
- Preview before import
- Progress bar
- Rollback on partial failure
