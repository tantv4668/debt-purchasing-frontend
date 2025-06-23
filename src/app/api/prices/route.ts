import { NextRequest, NextResponse } from 'next/server';

// Ensure BACKEND_URL doesn't include /api path
const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002').replace(/\/api$/, '');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Forward all query parameters to the backend
    // Backend routes are mounted at /api, so we need /api/prices
    const queryString = searchParams.toString();
    const backendUrl = `${BACKEND_URL}/api/prices${queryString ? `?${queryString}` : ''}`;

    console.log(`[PROXY] Backend base URL: ${BACKEND_URL}`);
    console.log(`[PROXY] Forwarding request to: ${backendUrl}`);
    console.log(`[PROXY] Query params: ${queryString || 'none'}`);
    console.log(`[PROXY] Original request URL: ${request.url}`);

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      // Add timeout for backend requests
      signal: AbortSignal.timeout(10000), // 10 seconds
    });

    console.log(`[PROXY] Backend response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body');
      console.error(`[PROXY] Backend API error: ${response.status} ${response.statusText}`);
      console.error(`[PROXY] Backend error body: ${errorText}`);

      return NextResponse.json(
        {
          success: false,
          error: `Backend API error: ${response.status}`,
          backendUrl,
          backendError: errorText,
          timestamp: new Date().toISOString(),
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    console.log(`[PROXY] Successfully proxied data, tokens count: ${data.data?.tokens?.length || 0}`);

    // Return the backend response as-is
    return NextResponse.json(data);
  } catch (error) {
    console.error('[PROXY] Error fetching from backend:', error);

    // Return error response
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch price data',
        backendUrl: `${BACKEND_URL}/api/prices`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
