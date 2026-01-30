import { useState, useEffect, useCallback } from 'react';
import type { Customer, Pagination, QueryCustomerDto } from '../types/api.types';
import { customerApi } from '../service/api.ts';

interface UseCustomersReturn {
    customers: Customer[];
    pagination: Pagination | null;
    isLoading: boolean;
    error: string | null;
    fetchCustomers: (params?: QueryCustomerDto) => Promise<void>;
    nextPage: () => void;
    prevPage: () => void;
    goToPage: (page: number) => void;
}

export function useCustomers(initialParams?: QueryCustomerDto): UseCustomersReturn {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [params, setParams] = useState<QueryCustomerDto>(initialParams || { page: 1, limit: 10 });

    const fetchCustomers = useCallback(async (queryParams?: QueryCustomerDto) => {
        const currentParams = queryParams || params;
        try {
            setIsLoading(true);
            setError(null);
            const response = await customerApi.getAll(currentParams);
            setCustomers(response.data.data);
            setPagination(response.data.pagination);
            if (queryParams) {
                setParams(queryParams);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch customers');
            setCustomers([]);
        } finally {
            setIsLoading(false);
        }
    }, [params]);

    const nextPage = useCallback(() => {
        if (pagination?.hasNext) {
            fetchCustomers({ ...params, page: (params.page || 1) + 1 });
        }
    }, [pagination, params, fetchCustomers]);

    const prevPage = useCallback(() => {
        if (pagination?.hasPrev) {
            fetchCustomers({ ...params, page: (params.page || 1) - 1 });
        }
    }, [pagination, params, fetchCustomers]);

    const goToPage = useCallback((page: number) => {
        fetchCustomers({ ...params, page });
    }, [params, fetchCustomers]);

    useEffect(() => {
        fetchCustomers();
    }, []);

    return {
        customers,
        pagination,
        isLoading,
        error,
        fetchCustomers,
        nextPage,
        prevPage,
        goToPage,
    };
}