import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { formatPrice } from '@/lib/utils/format'
import {
  getRevenueTimeSeries,
  getProductPerformance,
  getCategoryPerformance,
  getAffiliateROI,
  getCouponPerformance,
  getInventoryHealth,
  getRefundsAnalysis,
  getCustomerLTV,
} from '@/lib/supabase/queries/analytics'

const VALID_REPORTS = ['revenue', 'products', 'categories', 'customers', 'affiliates', 'coupons', 'inventory', 'refunds', 'full_dashboard'] as const
type ReportName = (typeof VALID_REPORTS)[number]

const paramsSchema = z.object({
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
  format: z.enum(['csv', 'xlsx']).default('csv'),
})

async function buildReportData(
  report: ReportName,
  supabase: ReturnType<typeof createServiceClient>,
  range: { dateFrom: string; dateTo: string },
): Promise<{ sheets: { name: string; rows: Record<string, unknown>[] }[] }> {
  switch (report) {
    case 'revenue': {
      const data = await getRevenueTimeSeries(supabase, range)
      return {
        sheets: [{
          name: 'Revenue',
          rows: data.map((r) => ({
            Fecha: r.date,
            'Revenue Bruto': formatPrice(r.revenue),
            Pedidos: r.orders,
            'Ticket Promedio': formatPrice(r.aov),
          })),
        }],
      }
    }
    case 'products': {
      const data = await getProductPerformance(supabase, range, 'revenue', 200)
      return {
        sheets: [{
          name: 'Productos',
          rows: data.map((p) => ({
            Producto: p.product_name,
            Categoria: p.category,
            'Unidades Vendidas': p.units_sold,
            Revenue: formatPrice(p.revenue),
            'Margen %': `${p.margin_pct}%`,
            'Conversion %': `${p.conversion_rate}%`,
          })),
        }],
      }
    }
    case 'categories': {
      const data = await getCategoryPerformance(supabase, range)
      return {
        sheets: [{
          name: 'Categorias',
          rows: data.map((c) => ({
            Categoria: c.category,
            Revenue: formatPrice(c.revenue),
            Unidades: c.units_sold,
            'Margen %': `${c.margin_pct}%`,
            Productos: c.product_count,
          })),
        }],
      }
    }
    case 'affiliates': {
      const data = await getAffiliateROI(supabase, range)
      return {
        sheets: [{
          name: 'Afiliados',
          rows: data.map((a) => ({
            Afiliado: a.affiliate_name,
            Pedidos: a.orders,
            Revenue: formatPrice(a.revenue),
            'Comisiones Pagadas': formatPrice(a.commissions_paid),
            'ROI %': `${a.roi}%`,
            'Conversion %': `${a.conversion_rate}%`,
            Clics: a.clicks,
          })),
        }],
      }
    }
    case 'coupons': {
      const data = await getCouponPerformance(supabase, range)
      return {
        sheets: [{
          name: 'Cupones',
          rows: data.map((c) => ({
            Codigo: c.code,
            Usos: c.uses,
            'Descuento Total': formatPrice(c.discount_total),
            'Revenue Atribuido': formatPrice(c.revenue_attributed),
            'ROI %': `${c.roi}%`,
          })),
        }],
      }
    }
    case 'inventory': {
      const data = await getInventoryHealth(supabase)
      return {
        sheets: [{
          name: 'Inventario',
          rows: data.map((p) => ({
            Producto: p.product_name,
            Categoria: p.category,
            Stock: p.stock_quantity,
            'Ventas 30d': p.units_sold_30d,
            'Dias Inventario': p.days_of_inventory,
            Estado: p.status,
          })),
        }],
      }
    }
    case 'refunds': {
      const data = await getRefundsAnalysis(supabase, range)
      return {
        sheets: [
          {
            name: 'Resumen',
            rows: [
              { Metrica: 'Total Devoluciones', Valor: data.total_refunds },
              { Metrica: 'Monto Total', Valor: formatPrice(data.total_amount) },
              { Metrica: 'Tasa de Devolucion', Valor: `${data.refund_rate}%` },
            ],
          },
          {
            name: 'Por Motivo',
            rows: data.by_reason.map((r) => ({
              Motivo: r.reason,
              Cantidad: r.count,
              Monto: formatPrice(r.amount),
            })),
          },
        ],
      }
    }
    case 'customers': {
      const data = await getCustomerLTV(supabase)
      return {
        sheets: [
          {
            name: 'Top Clientes',
            rows: data.top_customers.map((c) => ({
              Nombre: c.name,
              Telefono: c.phone,
              LTV: formatPrice(c.ltv),
              Pedidos: c.orders,
              'Ultimo Pedido': c.last_order_at ?? '',
            })),
          },
          {
            name: 'Distribucion LTV',
            rows: data.buckets.map((b) => ({
              Rango: b.range,
              Clientes: b.count,
            })),
          },
        ],
      }
    }
    default: {
      const [rev, prod, cats] = await Promise.all([
        getRevenueTimeSeries(supabase, range),
        getProductPerformance(supabase, range, 'revenue', 50),
        getCategoryPerformance(supabase, range),
      ])
      return {
        sheets: [
          { name: 'Revenue', rows: rev.map((r) => ({ Fecha: r.date, Revenue: formatPrice(r.revenue), Pedidos: r.orders })) },
          { name: 'Productos', rows: prod.map((p) => ({ Producto: p.product_name, Revenue: formatPrice(p.revenue), Unidades: p.units_sold })) },
          { name: 'Categorias', rows: cats.map((c) => ({ Categoria: c.category, Revenue: formatPrice(c.revenue) })) },
        ],
      }
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ report: string }> },
) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { report } = await params

  if (!VALID_REPORTS.includes(report as ReportName)) {
    return NextResponse.json({ error: 'Reporte no válido' }, { status: 400 })
  }

  const parsed = paramsSchema.safeParse({
    dateFrom: request.nextUrl.searchParams.get('dateFrom') ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    dateTo: request.nextUrl.searchParams.get('dateTo') ?? new Date().toISOString().slice(0, 10),
    format: request.nextUrl.searchParams.get('format') ?? 'csv',
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const { dateFrom, dateTo, format } = parsed.data
  const supabase = createServiceClient()

  const { sheets } = await buildReportData(report as ReportName, supabase, { dateFrom, dateTo })
  const timestamp = new Date().toISOString().slice(0, 10)
  const filename = `${report}_${dateFrom}_${dateTo}`

  if (format === 'csv') {
    const csv = Papa.unparse(sheets[0].rows)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    })
  }

  const wb = XLSX.utils.book_new()

  const headerRow = [
    [`Reporte: ${report}`],
    [`Periodo: ${dateFrom} al ${dateTo}`],
    [`Generado: ${new Date().toLocaleString('es-MX')}`],
    [],
  ]

  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(headerRow)
    XLSX.utils.sheet_add_json(ws, sheet.rows, { origin: 4 })
    XLSX.utils.book_append_sheet(wb, ws, sheet.name)
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
    },
  })
}
