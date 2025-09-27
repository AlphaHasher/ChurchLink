import api from '@/api/api';

export type Col = { key: string; label: string };

export const buildCsvAndDownload = (rows: any[], cols: Col[], filename?: string) => {
  const escape = (s: any) => {
    if (s === null || s === undefined) return '';
    let str = typeof s === 'object' ? JSON.stringify(s) : String(s);
    if (typeof s === 'boolean') str = s ? 'Yes' : 'No';
    if (str.indexOf('"') !== -1) str = str.replace(/"/g, '""');
    if (/[",\n]/.test(str)) return `"${str}"`;
    return str;
  };

  const header = cols.map((c) => c.label ?? c.key);
  const lines: string[] = [];
  lines.push(header.map((h) => escape(h)).join(','));
  for (const r of rows) {
    const line = cols
      .map((col) => {
        const key = col.key;
        let val: any = undefined;
        if (key === '__user__') val = (r as any).user_id;
        else if (key === '__submitted__') val = (r as any).submitted_at;
        else val = (r as any).response?.[key];
        if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) return escape('');
        if (Array.isArray(val)) return escape(val.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', '));
        if (typeof val === 'object') return escape(JSON.stringify(val));
        if (typeof val === 'boolean') return escape(val ? 'Yes' : 'No');
        return escape(val);
      })
      .join(',');
    lines.push(line);
  }

  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `responses.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const fetchResponsesAndDownloadCsv = async (
  formId: string,
  options?: { existingColumns?: Col[]; existingColumnKeys?: string[]; limit?: number; filename?: string }
) => {
  const limit = options?.limit ?? 1500;
  const resp = await api.get(`/v1/forms/${formId}/responses`, { params: { skip: 0, limit } });
  let rows = resp.data?.items || [];
  if (!Array.isArray(rows)) rows = [];

  const existing = new Set<string>((options?.existingColumns?.map((c) => c.key) || options?.existingColumnKeys) || []);
  const extra: Col[] = [];
  for (const it of rows) {
    const respObj = it?.response || {};
    Object.keys(respObj).forEach((k) => {
      if (!existing.has(k)) {
        existing.add(k);
        extra.push({ key: k, label: k });
      }
    });
  }

  const baseExisting: Col[] = options?.existingColumns
    ? options!.existingColumns!.filter((c) => c.key !== '__user__' && c.key !== '__submitted__')
    : (options?.existingColumnKeys || []).map((k) => ({ key: k, label: k }));

  const cols = [{ key: '__user__', label: 'User' }, { key: '__submitted__', label: 'Submitted' }, ...baseExisting, ...extra];
  const uniq: Col[] = [];
  const seen = new Set<string>();
  for (const c of cols) {
    if (!seen.has(c.key)) {
      seen.add(c.key);
      uniq.push(c);
    }
  }

  buildCsvAndDownload(rows, uniq, options?.filename);
  return { rows, cols: uniq };
};
