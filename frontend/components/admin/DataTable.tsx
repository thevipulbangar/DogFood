"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sort?: (row: T) => string | number;
  align?: "left" | "right";
  className?: string;
};

/** Dense table with search, column sort, row selection and bulk actions. */
export function DataTable<T>({ rows, columns, rowKey, search, bulkActions, caption, pageSize = 12, toolbar }: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  search?: (row: T) => string;
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode;
  caption: string;
  pageSize?: number;
  toolbar?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = s && search ? rows.filter((r) => search(r).toLowerCase().includes(s)) : rows;
    const col = sort && columns.find((c) => c.key === sort.key);
    if (col?.sort) {
      const f = col.sort;
      list = [...list].sort((a, b) => (f(a) > f(b) ? 1 : f(a) < f(b) ? -1 : 0) * sort!.dir);
    }
    return list;
  }, [rows, q, sort, columns, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const view = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const allOnPage = view.length > 0 && view.every((r) => selected.has(rowKey(r)));
  const toggle = (k: string) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const selRows = rows.filter((r) => selected.has(rowKey(r)));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {search && (
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search…" aria-label={`Search ${caption}`} className={cn(fieldClass, "h-8 pl-8 text-[13px]")} />
          </div>
        )}
        {toolbar}
        <span className="ml-auto font-mono text-[10.5px] text-muted">{filtered.length} ROWS</span>
      </div>

      <AnimatePresence>
        {bulkActions && selRows.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-sm border border-accent/30 bg-accent/[0.05] px-3 py-2">
              <span className="font-mono text-[11px] text-accent">{selRows.length} SELECTED</span>
              <span className="mx-1 h-4 w-px bg-line-strong" />
              {bulkActions(selRows, () => setSelected(new Set()))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {filtered.length === 0 ? (
        <EmptyState code="0 ROWS" title="Nothing matches" body="Adjust the search to see more rows." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[640px] text-left">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-line bg-white/[0.02]">
                {bulkActions && (
                  <th scope="col" className="w-10 px-3">
                    <input type="checkbox" aria-label="Select all on page" checked={allOnPage} className="accent-[var(--color-accent)]"
                      onChange={() => setSelected((s) => { const n = new Set(s); view.forEach((r) => (allOnPage ? n.delete(rowKey(r)) : n.add(rowKey(r)))); return n; })} />
                  </th>
                )}
                {columns.map((c) => {
                  const active = sort?.key === c.key;
                  return (
                    <th key={c.key} scope="col" aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : undefined} className={cn("px-4 py-2.5 font-normal", c.align === "right" && "text-right")}>
                      {c.sort ? (
                        <button onClick={() => setSort(active ? (sort!.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 })}
                          className={cn("label inline-flex items-center gap-1 hover:text-fg", active && "text-fg")}>
                          {c.header}{active && (sort!.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                        </button>
                      ) : <span className="label">{c.header}</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {view.map((r) => {
                const k = rowKey(r);
                return (
                  <tr key={k} className={cn("border-b border-line transition-colors last:border-0", selected.has(k) ? "bg-accent/[0.04]" : "hover:bg-white/[0.02]")}>
                    {bulkActions && (
                      <td className="px-3"><input type="checkbox" aria-label={`Select row ${k}`} checked={selected.has(k)} onChange={() => toggle(k)} className="accent-[var(--color-accent)]" /></td>
                    )}
                    {columns.map((c) => <td key={c.key} className={cn("px-4 py-2.5 text-[13px]", c.align === "right" && "text-right", c.className)}>{c.cell(r)}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-3 flex items-center justify-end gap-1 font-mono text-[11px]">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-xs px-2 py-1 text-muted hover:text-fg disabled:opacity-30">PREV</button>
          <span className="px-2 text-fg-2">{page + 1} / {pages}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="rounded-xs px-2 py-1 text-muted hover:text-fg disabled:opacity-30">NEXT</button>
        </nav>
      )}
    </div>
  );
}
