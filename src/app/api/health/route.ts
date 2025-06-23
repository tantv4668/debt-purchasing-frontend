import { NextRequest, NextResponse } from 'next/server';

// Ensure BACKEND_URL doesn't include /api path
const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002').replace(/\/api$/, '');

export async function GET(request: NextRequest) {
  try {
    // Test backend connectivity
    const backendHealthUrl = `${BACKEND_URL}/api/health`;

    console.log(`[HEALTH] Checking backend at: ${backendHealthUrl}`);

    const response = await fetch(backendHealthUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000), // 5 seconds
    });

    const backendData = await response.json();
    console.log(`[HEALTH] Backend response: ${response.status}`);

    return NextResponse.json({
      success: true,
      data: {
        frontend: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
        },
        backend: {
          status: response.ok ? 'healthy' : 'error',
          url: backendHealthUrl,
          responseStatus: response.status,
          data: backendData,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[HEALTH] Error checking backend:', error);

    return NextResponse.json(
      {
        success: false,
        data: {
          frontend: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
          },
          backend: {
            status: 'error',
            url: `${BACKEND_URL}/api/health`,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
