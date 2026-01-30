
import { useRef, useCallback, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Customer } from '../types/api.types';
import { customerApi } from '../service/api';

interface CustomerTableProps {
    recentCustomers?: Customer[];
    isImporting?: boolean;
}

const PAGE_SIZE = 50;
const ROW_HEIGHT = 36;

export function CustomerTable({ recentCustomers = [], isImporting }: CustomerTableProps) {
    const parentRef = useRef<HTMLDivElement>(null);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Fetch customers
    const fetchCustomers = useCallback(async (pageNum: number, append = false) => {
        if (isLoading) return;

        try {
            setIsLoading(true);
            const response = await customerApi.getAll({ page: pageNum, limit: PAGE_SIZE });
            const newCustomers = response.data.data;
            const pagination = response.data.pagination;

            setCustomers(prev => append ? [...prev, ...newCustomers] : newCustomers);
            setHasMore(pagination.hasNext);
            setTotalItems(pagination.totalItems);
            setPage(pageNum);
        } catch (error) {
            console.error('Failed to fetch customers:', error);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading]);

    // Initial load
    useEffect(() => {
        fetchCustomers(1);
    }, []);

    // Refresh when import completes
    useEffect(() => {
        if (!isImporting && recentCustomers.length > 0) {
            fetchCustomers(1);
        }
    }, [isImporting]);

    // Load more when scrolling near bottom
    const loadMore = useCallback(() => {
        if (hasMore && !isLoading) {
            fetchCustomers(page + 1, true);
        }
    }, [hasMore, isLoading, page, fetchCustomers]);

    const rowVirtualizer = useVirtualizer({
        count: customers.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 10,
    });

    // Check if we need to load more
    useEffect(() => {
        const items = rowVirtualizer.getVirtualItems();
        const lastItem = items[items.length - 1];

        if (lastItem && lastItem.index >= customers.length - 10 && hasMore && !isLoading) {
            loadMore();
        }
    }, [rowVirtualizer.getVirtualItems(), customers.length, hasMore, isLoading, loadMore]);

    const virtualItems = rowVirtualizer.getVirtualItems();

    return (
        <section className="table-card" aria-label="Customer table">
            <header className="table-header">
                <h2>
                    Customer table
                    {totalItems > 0 && <span className="table-count"> ({totalItems.toLocaleString()} total)</span>}
                </h2>
            </header>

            {/* Header row */}
            <div className="table-grid-header">
                <div className="table-row table-row--header" role="row">
                    <div className="table-cell table-cell--header" role="columnheader">Name</div>
                    <div className="table-cell table-cell--header" role="columnheader">Email</div>
                    <div className="table-cell table-cell--header" role="columnheader">Company</div>
                    <div className="table-cell table-cell--header" role="columnheader">City</div>
                    <div className="table-cell table-cell--header" role="columnheader">Country</div>
                    <div className="table-cell table-cell--header" role="columnheader">Phone</div>
                </div>
            </div>

            {/* Virtualized body */}
            <div
                ref={parentRef}
                className="table-grid-body"
                role="table"
                aria-label="Customer data grid"
            >
                {customers.length === 0 && !isLoading ? (
                    <div className="table-empty">
                        <span className="empty-message">No customers yet</span>
                    </div>
                ) : (
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {virtualItems.map((virtualRow) => {
                            const customer = customers[virtualRow.index];
                            return (
                                <div
                                    key={customer.id}
                                    className="table-row"
                                    role="row"
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: `${virtualRow.size}px`,
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    <div className="table-cell" role="cell">
                                        {[customer.firstName, customer.lastName].filter(Boolean).join(' ') || '-'}
                                    </div>
                                    <div className="table-cell" role="cell">{customer.email || '-'}</div>
                                    <div className="table-cell" role="cell">{customer.company || '-'}</div>
                                    <div className="table-cell" role="cell">{customer.city || '-'}</div>
                                    <div className="table-cell" role="cell">{customer.country || '-'}</div>
                                    <div className="table-cell" role="cell">{customer.phone1 || '-'}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {isLoading && (
                    <div className="table-loading">Loading...</div>
                )}
            </div>
        </section>
    );
}