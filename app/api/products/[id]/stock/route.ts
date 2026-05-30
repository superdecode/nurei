import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function getStockStatus(
  stockQuantity: number,
  lowStockThreshold: number,
  trackInventory: boolean,
  allowBackorder: boolean
) {
  if (!trackInventory || allowBackorder) return 'available'
  if (stockQuantity <= 0) return 'out_of_stock'
  if (stockQuantity <= lowStockThreshold) return 'low_stock'
  return 'available'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const requestedQuantity = Number(body?.quantity ?? 1)
    const currentCartQuantity = Number(body?.currentCartQuantity ?? 0)
    const variantId: string | null = body?.variant_id ?? null
    const totalRequested = requestedQuantity + currentCartQuantity

    if (
      !id ||
      !Number.isFinite(requestedQuantity) ||
      !Number.isFinite(currentCartQuantity) ||
      requestedQuantity <= 0 ||
      currentCartQuantity < 0
    ) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data: product, error } = await supabase
      .from('products')
      .select('id, name, stock_quantity, low_stock_threshold, track_inventory, allow_backorder, status, is_active')
      .eq('id', id)
      .single()

    if (error || !product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    const isSellable = product.is_active && product.status === 'active'
    if (!isSellable) {
      return NextResponse.json(
        {
          can_add: false,
          stock_status: 'out_of_stock',
          message: 'Producto no disponible temporalmente.',
          available_quantity: 0,
        },
        { status: 409 }
      )
    }

    // When a variant is selected, check that variant's stock instead of the product total
    if (variantId) {
      const { data: variant, error: vErr } = await supabase
        .from('product_variants')
        .select('id, stock, status')
        .eq('id', variantId)
        .eq('product_id', id)
        .single()

      if (vErr || !variant) {
        return NextResponse.json({ error: 'Variante no encontrada' }, { status: 404 })
      }
      if (variant.status !== 'active') {
        return NextResponse.json(
          { can_add: false, stock_status: 'out_of_stock', message: 'Variante no disponible.', available_quantity: 0 },
          { status: 409 }
        )
      }
      if (product.track_inventory && !product.allow_backorder && variant.stock < totalRequested) {
        return NextResponse.json(
          {
            can_add: false,
            stock_status: variant.stock <= 0 ? 'out_of_stock' : 'low_stock',
            message: variant.stock > 0
              ? `Solo quedan ${variant.stock} unidades de esta variante.`
              : 'Esta variante está agotada.',
            available_quantity: variant.stock,
          },
          { status: 409 }
        )
      }
      return NextResponse.json({
        can_add: true,
        stock_status: variant.stock <= 0 ? 'out_of_stock' : variant.stock <= product.low_stock_threshold ? 'low_stock' : 'available',
        available_quantity: variant.stock,
      })
    }

    const stockStatus = getStockStatus(
      product.stock_quantity,
      product.low_stock_threshold,
      product.track_inventory,
      product.allow_backorder
    )

    if (
      product.track_inventory &&
      !product.allow_backorder &&
      product.stock_quantity < totalRequested
    ) {
      return NextResponse.json(
        {
          can_add: false,
          stock_status: stockStatus,
          message:
            product.stock_quantity > 0
              ? `Solo quedan ${product.stock_quantity} unidades disponibles por ahora.`
              : 'Este producto está agotado.',
          available_quantity: product.stock_quantity,
        },
        { status: 409 }
      )
    }

    return NextResponse.json({
      can_add: true,
      stock_status: stockStatus,
      available_quantity: product.stock_quantity,
    })
  } catch {
    return NextResponse.json(
      { error: 'No pudimos validar inventario en este momento.' },
      { status: 500 }
    )
  }
}
