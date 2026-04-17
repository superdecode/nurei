import { NextResponse } from 'next/server'

const CSV_TEMPLATE = `sku,nombre,categoria,stock,precio,alerta_stock
NUR-EJEMPLO-001,Ramen ejemplo,ramen,24,8500,5
NUR-EJEMPLO-002,Bebida ejemplo,drinks,12,4500,8
`

export async function GET() {

  return new NextResponse(CSV_TEMPLATE, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="plantilla_inventario_nurei.csv"',
    },
  })
}
