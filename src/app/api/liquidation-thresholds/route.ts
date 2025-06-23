import { NextResponse } from 'next/server';

// Ensure BACKEND_URL doesn't include /api path
const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002').replace(/\/api$/, '');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Forward query parameters to backend
    const queryString = searchParams.toString();
    const backendUrl = `${BACKEND_URL}/api/liquidation-thresholds${queryString ? `?${queryString}` : ''}`;

    console.log(`Fetching liquidation thresholds from backend: ${backendUrl}`);

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching liquidation thresholds:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch liquidation thresholds',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
