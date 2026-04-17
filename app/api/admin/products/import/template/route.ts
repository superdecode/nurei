import { NextResponse } from 'next/server'

/**
 * Plantilla CSV — columnas en español, compatibles con alias en inglés al importar.
 *
 * OBLIGATORIOS (producto nuevo / fila con SKU que no existe):
 *   sku, nombre, categoria_slug, precio_mxn
 *
 * OBLIGATORIOS (solo actualizar producto existente por SKU):
 *   sku + al menos un campo opcional con valor (precio_mxn, stock, nombre, etc.)
 *
 * OPCIONALES:
 *   stock (entero, default 0 en altas), alerta_stock (default 5),
 *   estado (draft | active | archived, default draft en altas),
 *   descripcion, slug (si vacío se genera desde nombre),
 *   unidad (units|ml|g|kg|L|oz|box|pack, default units),
 *   peso_g (entero gramos), compare_precio_mxn (precio tachado en pesos enteros)
 */
const CSV_TEMPLATE = `sku,nombre,categoria_slug,precio_mxn,stock,alerta_stock,estado,descripcion,slug,unidad,peso_g,compare_precio_mxn
NUR-EJEMPLO-001,Ramen ejemplo,ramen,89,24,5,active,Descripción opcional,,units,450,
NUR-EJEMPLO-002,Bebida ejemplo,drinks,45,12,8,draft,,bebida-slug,ml,500,
`

export async function GET() {
  return new NextResponse(CSV_TEMPLATE, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="plantilla_productos_nurei.csv"',
    },
  })
}
