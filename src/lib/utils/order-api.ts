// Backend API types
export interface CreateOrderRequest {
  orderType: 'FULL' | 'PARTIAL';
  chainId: number;
  contractAddress: string;
  seller: string;
  fullSellOrder?: FullSellOrderData;
  partialSellOrder?: PartialSellOrderData;
}

export interface CancelOrderRequest {
  seller: string;
  signature: string;
  message: string;
}

export interface FullSellOrderData {
  debt: string;
  debtNonce: number;
  startTime: number;
  endTime: number;
  triggerHF: string;
  token: string;
  percentOfEquity: string;
  v: number;
  r: string;
  s: string;
}

export interface PartialSellOrderData {
  debt: string;
  debtNonce: number;
  startTime: number;
  endTime: number;
  triggerHF: string;
  interestRateMode: number;
  collateralOut: string[];
  percents: string[];
  repayToken: string;
  repayAmount: string;
  bonus: string;
  v: number;
  r: string;
  s: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface OrderResponse {
  id: string;
  orderType: 'FULL' | 'PARTIAL';
  status: string;
  debtAddress: string;
  seller: string;
  startTime: string;
  endTime: string;
  triggerHF: string;
  createdAt: string;
}

// Configuration - Fixed port to match backend config (3002)
// Ensure we strip any trailing /api to prevent duplication
const API_BASE_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002').replace(/\/api$/, '');

class OrderApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    console.log('🔧 OrderApiService initialized with URL:', this.baseUrl);
  }

  async createOrder(orderData: CreateOrderRequest): Promise<OrderResponse> {
    const url = `${this.baseUrl}/api/orders`;
    console.log('📤 Creating order at URL:', url);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      console.log('📥 Response status:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: ApiResponse<OrderResponse> = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create order');
      }

      if (!result.data) {
        throw new Error('No data returned from API');
      }

      return result.data;
    } catch (error) {
      console.error('❌ Order creation failed:', error);
      if (error instanceof Error && error.message.includes('fetch')) {
        throw new Error(
          `Backend server not available at ${this.baseUrl}. Make sure the backend is running with: cd debt-purchasing-backend && npm run dev`,
        );
      }
      throw error;
    }
  }

  async getOrders(params?: {
    seller?: string;
    debtAddress?: string;
    status?: string;
    orderType?: string;
    chainId?: number;
    page?: number;
    limit?: number;
  }): Promise<{ orders: any[]; pagination: any }> {
    const queryParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const url = `${this.baseUrl}/api/orders?${queryParams}`;
    console.log('📤 Fetching orders from URL:', url);
    console.log('📊 Query params:', params);

    try {
      const response = await fetch(url);

      console.log('📥 Response status:', response.status, response.statusText);
      console.log('📥 Response URL:', response.url);

      if (!response.ok) {
        const responseText = await response.text();
        console.error('❌ Response body:', responseText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}. Response: ${responseText}`);
      }

      const result: ApiResponse = await response.json();
      console.log('✅ Orders fetched successfully:', result.data?.orders?.length || 0, 'orders');

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch orders');
      }

      return result.data;
    } catch (error) {
      console.error('❌ Get orders failed:', error);
      if (error instanceof Error) {
        console.error('❌ Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack ? error.stack.split('\n')[0] : 'No stack trace',
        });

        if (error.message.includes('fetch') || error.message.includes('Network')) {
          throw new Error(
            `Backend server not available at ${this.baseUrl}. Please verify:\n1. Backend is running: cd debt-purchasing-backend && npm run dev\n2. Backend URL is correct: ${this.baseUrl}\n3. No CORS issues in browser console`,
          );
        }
      }
      throw error;
    }
  }

  async getActiveOrders(params?: {
    chainId?: number;
    seller?: string;
    debtAddress?: string;
    orderType?: string;
  }): Promise<{ orders: any[]; count: number }> {
    const queryParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const url = `${this.baseUrl}/api/orders/active?${queryParams}`;
    console.log('📤 Fetching active orders from URL:', url);

    try {
      const response = await fetch(url);

      console.log('📥 Response status:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: ApiResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch active orders');
      }

      return result.data;
    } catch (error) {
      if (error instanceof Error && error.message.includes('fetch')) {
        throw new Error(
          `Backend server not available at ${this.baseUrl}. Make sure the backend is running with: cd debt-purchasing-backend && npm run dev`,
        );
      }
      throw error;
    }
  }

  async getOrderById(orderId: string): Promise<any> {
    const url = `${this.baseUrl}/api/orders/${orderId}`;
    console.log('📤 Fetching order by ID from URL:', url);

    try {
      const response = await fetch(url);

      console.log('📥 Response status:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: ApiResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch order');
      }

      return result.data;
    } catch (error) {
      if (error instanceof Error && error.message.includes('fetch')) {
        throw new Error(
          `Backend server not available at ${this.baseUrl}. Make sure the backend is running with: cd debt-purchasing-backend && npm run dev`,
        );
      }
      throw error;
    }
  }

  /**
   * Cancel an order by ID
   */
  async cancelOrder(
    orderId: string,
    cancelRequest: CancelOrderRequest,
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const url = `${this.baseUrl}/api/orders/${orderId}/cancel`;
    console.log('🔄 Attempting to cancel order:', { orderId, seller: cancelRequest.seller, url });
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cancelRequest),
      });

      console.log('📥 Cancel order response:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        ok: response.ok,
      });

      const data = await response.json();
      console.log('📄 Cancel order response data:', data);

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return {
        success: data.success,
        message: data.data?.message || 'Order cancelled successfully',
      };
    } catch (error) {
      console.error('❌ Failed to cancel order:', error);
      console.error('❌ Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error && error.stack ? error.stack.split('\n').slice(0, 3) : 'No stack',
      });

      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        console.error('❌ Network connectivity issue detected');
        console.error('❌ Please check:');
        console.error('   1. Backend is running on', this.baseUrl);
        console.error('   2. No CORS errors in browser console');
        console.error('   3. Network connectivity is working');
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel order',
      };
    }
  }
}

export const orderApiService = new OrderApiService();
