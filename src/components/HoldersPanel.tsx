'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Holder = {
  owner: string;
  uiAmount: number;
};

const PAGE_SIZE = 12;
const REFRESH_MS = 30000;

const shorten = (value: string) =>
  value.length > 12 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value;

export default function HoldersPanel() {
  const [holders, setHolders] = useState<Holder[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const minHold = parseInt(process.env.NEXT_PUBLIC_MIN_HOLD || '0');
  const safeMinHold = Number.isFinite(minHold) ? minHold : 0;

  const fetchHolders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `/api/holders?min=${safeMinHold}`
      );

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          (data && (data.details || data.error)) || 'Failed to fetch holders';
        throw new Error(message);
      }

      const list = Array.isArray(data) ? data : data.holders || [];
      setHolders(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [safeMinHold]);

  useEffect(() => {
    let isActive = true;

    const run = async () => {
      if (!isActive) return;
      await fetchHolders();
    };

    run();
    const interval = setInterval(run, REFRESH_MS);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [fetchHolders]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const sorted = [...holders].sort((a, b) => b.uiAmount - a.uiAmount);
    if (!term) return sorted;
    return sorted.filter(holder => holder.owner.toLowerCase().includes(term));
  }, [holders, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="fixed top-20 right-4 z-40 w-80 max-h-[calc(100vh-6rem)] bg-black/80 text-white rounded-lg border border-white/10 shadow-xl backdrop-blur">
      <div className="px-4 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide">Holders</h2>
          <button
            onClick={fetchHolders}
            className="text-xs text-gray-300 hover:text-white"
          >
            Refresh
          </button>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Sorted by balance (high → low)
        </div>
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search wallet address..."
          className="mt-3 w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-400"
        />
      </div>

      <div className="px-4 py-3">
        {loading && (
          <div className="text-xs text-gray-400">Loading holders...</div>
        )}
        {!loading && error && (
          <div className="text-xs text-red-300">{error}</div>
        )}
        {!loading && !error && (
          <div className="space-y-2">
            <div className="flex text-[11px] uppercase tracking-wide text-gray-400">
              <div className="w-6">#</div>
              <div className="flex-1">Wallet</div>
              <div className="w-24 text-right">Tokens</div>
            </div>
            <div className="max-h-[42vh] overflow-y-auto pr-1">
              {pageItems.length === 0 ? (
                <div className="text-xs text-gray-400 py-2">
                  No holders found.
                </div>
              ) : (
                pageItems.map((holder, index) => (
                  <div
                    key={holder.owner}
                    className="flex items-center text-xs text-gray-200 border-b border-white/5 py-2"
                  >
                    <div className="w-6 text-gray-500">
                      {pageStart + index + 1}
                    </div>
                    <div className="flex-1">
                      <span title={holder.owner}>{shorten(holder.owner)}</span>
                    </div>
                    <div className="w-24 text-right">
                      {Math.round(holder.uiAmount).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
        <div>
          {filtered.length === 0
            ? '0 results'
            : `${pageStart + 1}-${Math.min(
                pageStart + PAGE_SIZE,
                filtered.length
              )} of ${filtered.length}`}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(prev => Math.max(1, prev - 1))}
            disabled={safePage === 1}
            className="px-2 py-1 rounded border border-white/10 disabled:opacity-40"
          >
            Prev
          </button>
          <div>
            {safePage}/{totalPages}
          </div>
          <button
            onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
            disabled={safePage === totalPages}
            className="px-2 py-1 rounded border border-white/10 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
