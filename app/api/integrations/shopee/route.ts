import { NextRequest, NextResponse } from 'next/server'

// Environment variables for Shopee API
const SHOPEE_API_URL = process.env.SHOPEE_API_URL || 'https://partner.shopeemobile.com'
const SHOPEE_PARTNER_ID = process.env.SHOPEE_PARTNER_ID
const SHOPEE_PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY
const SHOPEE_SHOP_ID = process.env.SHOPEE_SHOP_ID

/**
 * GET /api/integrations/shopee
 * Get Shopee integration status and configuration
 */
export async function GET(request: NextRequest) {
  try {
    // Check if Shopee integration is configured
    const isConfigured = !!(SHOPEE_PARTNER_ID && SHOPEE_PARTNER_KEY && SHOPEE_SHOP_ID)

    return NextResponse.json({
      status: 'success',
      data: {
        configured: isConfigured,
        partnerId: SHOPEE_PARTNER_ID ? '***' + SHOPEE_PARTNER_ID.slice(-4) : null,
        shopId: SHOPEE_SHOP_ID ? '***' + SHOPEE_SHOP_ID.slice(-4) : null,
        hasCredentials: isConfigured
      }
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Failed to get Shopee integration status' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/integrations/shopee
 * Configure Shopee integration credentials
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { partnerId, partnerKey, shopId } = body

    // Validate required fields
    if (!partnerId || !partnerKey || !shopId) {
      return NextResponse.json(
        { status: 'error', message: 'Missing required fields: partnerId, partnerKey, shopId' },
        { status: 400 }
      )
    }

    // In production, these should be stored securely in environment variables or a secret manager
    // For now, we'll return success (user will need to update .env.local manually)
    
    return NextResponse.json({
      status: 'success',
      message: 'Shopee integration credentials received. Please update your .env.local file with the provided credentials.',
      requiredEnvVars: {
        SHOPEE_PARTNER_ID: partnerId,
        SHOPEE_PARTNER_KEY: partnerKey,
        SHOPEE_SHOP_ID: shopId
      }
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Failed to configure Shopee integration' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/integrations/shopee
 * Remove Shopee integration
 */
export async function DELETE(request: NextRequest) {
  try {
    // In production, this would remove the credentials from secure storage
    return NextResponse.json({
      status: 'success',
      message: 'Shopee integration removed. Please remove credentials from .env.local file.'
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Failed to remove Shopee integration' },
      { status: 500 }
    )
  }
}
