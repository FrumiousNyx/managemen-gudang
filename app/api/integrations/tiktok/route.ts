import { NextRequest, NextResponse } from 'next/server'

// Environment variables for TikTok Shop API
const TIKTOK_API_URL = process.env.TIKTOK_API_URL || 'https://partner.tiktokshop.com'
const TIKTOK_APP_KEY = process.env.TIKTOK_APP_KEY
const TIKTOK_APP_SECRET = process.env.TIKTOK_APP_SECRET
const TIKTOK_SHOP_ID = process.env.TIKTOK_SHOP_ID

/**
 * GET /api/integrations/tiktok
 * Get TikTok Shop integration status and configuration
 */
export async function GET(request: NextRequest) {
  try {
    // Check if TikTok Shop integration is configured
    const isConfigured = !!(TIKTOK_APP_KEY && TIKTOK_APP_SECRET && TIKTOK_SHOP_ID)

    return NextResponse.json({
      status: 'success',
      data: {
        configured: isConfigured,
        appKey: TIKTOK_APP_KEY ? '***' + TIKTOK_APP_KEY.slice(-4) : null,
        shopId: TIKTOK_SHOP_ID ? '***' + TIKTOK_SHOP_ID.slice(-4) : null,
        hasCredentials: isConfigured
      }
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Failed to get TikTok Shop integration status' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/integrations/tiktok
 * Configure TikTok Shop integration credentials
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { appKey, appSecret, shopId } = body

    // Validate required fields
    if (!appKey || !appSecret || !shopId) {
      return NextResponse.json(
        { status: 'error', message: 'Missing required fields: appKey, appSecret, shopId' },
        { status: 400 }
      )
    }

    // In production, these should be stored securely in environment variables or a secret manager
    // For now, we'll return success (user will need to update .env.local manually)
    
    return NextResponse.json({
      status: 'success',
      message: 'TikTok Shop integration credentials received. Please update your .env.local file with the provided credentials.',
      requiredEnvVars: {
        TIKTOK_APP_KEY: appKey,
        TIKTOK_APP_SECRET: appSecret,
        TIKTOK_SHOP_ID: shopId
      }
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Failed to configure TikTok Shop integration' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/integrations/tiktok
 * Remove TikTok Shop integration
 */
export async function DELETE(request: NextRequest) {
  try {
    // In production, this would remove the credentials from secure storage
    return NextResponse.json({
      status: 'success',
      message: 'TikTok Shop integration removed. Please remove credentials from .env.local file.'
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Failed to remove TikTok Shop integration' },
      { status: 500 }
    )
  }
}
