import type {
    ApiResponse,
    Customer,
    PaginatedData,
    ImportJob,
    ImportProgress,
    StartImportDto,
    QueryCustomerDto,
    SSEMessage,
} from '../types/api.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
        ...options,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || `Request failed: ${response.status}`);
    }

    return data;
}

// Customer API
export const customerApi = {
    getAll: (params?: QueryCustomerDto) => {
        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.set('page', String(params.page));
        if (params?.limit) searchParams.set('limit', String(params.limit));
        const query = searchParams.toString();
        return request<ApiResponse<PaginatedData<Customer>>>(`/customers${query ? `?${query}` : ''}`);
    },

    getById: (id: number) => {
        return request<ApiResponse<Customer>>(`/customers/${id}`);
    },
};

// Import API
export const importApi = {
    startSync: (dto?: StartImportDto) => {
        return request<ApiResponse<ImportJob>>('/customers/sync', {
            method: 'POST',
            body: JSON.stringify(dto || {}),
        });
    },

    getProgress: async (totalRows?: number, recentLimit?: number) => {
        const searchParams = new URLSearchParams();
        if (totalRows) searchParams.set('totalRows', String(totalRows));
        if (recentLimit) searchParams.set('recentLimit', String(recentLimit));
        const query = searchParams.toString();
        // This endpoint returns data directly, not wrapped in ApiResponse
        const data = await request<ImportProgress>(`/customers/progress${query ? `?${query}` : ''}`);
        return { data }; // Wrap it to match expected format
    },

    // SSE stream for real-time progress
    createProgressStream: (
        onMessage: (data: SSEMessage) => void,
        onError?: (error: Event) => void,
        totalRows?: number,
        recentLimit?: number
    ): EventSource => {
        const searchParams = new URLSearchParams();
        if (totalRows) searchParams.set('totalRows', String(totalRows));
        if (recentLimit) searchParams.set('recentLimit', String(recentLimit));
        const query = searchParams.toString();

        const eventSource = new EventSource(
            `${API_BASE_URL}/customers/progress/stream${query ? `?${query}` : ''}`
        );

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onMessage(data);
            } catch {
                console.error('Failed to parse SSE message:', event.data);
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE Error:', error);
            onError?.(error);
        };

        return eventSource;
    },
};