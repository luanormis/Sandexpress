type SupabasePage<T> = {
  data: T[] | null;
  error: { message?: string; code?: string } | null;
};

type PageFactory<T> = (from: number, to: number) => PromiseLike<SupabasePage<T>>;

export async function fetchAllSupabaseRows<T>(
  pageFactory: PageFactory<T>,
  options: { pageSize?: number; maxRows?: number } = {},
) {
  const pageSize = Math.min(1000, Math.max(100, Math.floor(options.pageSize || 1000)));
  const maxRows = Math.max(pageSize, Math.floor(options.maxRows || 50000));
  const rows: T[] = [];

  while (rows.length < maxRows) {
    const from = rows.length;
    const { data, error } = await pageFactory(from, Math.min(from + pageSize - 1, maxRows - 1));
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) return { rows, truncated: false };
  }

  return { rows, truncated: true };
}
