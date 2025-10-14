import api from '@/api/api';
import { fetchUserInfoByUId } from '@/helpers/UserHelper';

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
  if (key === '__first_name__') val = (r as any).__first_name__;
  else if (key === '__last_name__') val = (r as any).__last_name__;
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

  const uniqueUserIds = [...new Set(rows.map((row: any) => row?.user_id).filter(Boolean))] as string[];
  const userInfoMap: Record<string, { first_name?: string; last_name?: string }> = {};

  if (uniqueUserIds.length > 0) {
    const infoResults = await Promise.all(
      uniqueUserIds.map(async (uid) => {
        try {
          const info = await fetchUserInfoByUId(uid);
          return { uid, info };
        } catch (error) {
          console.error('Failed to fetch user info for CSV export:', error);
          return { uid, info: null };
        }
      })
    );

    infoResults.forEach(({ uid, info }) => {
      if (info) {
        userInfoMap[uid] = { first_name: info.first_name, last_name: info.last_name };
      }
    });
  }

  const enrichedRows = rows.map((row: any) => {
    const uid = row?.user_id;
    const info = uid ? userInfoMap[uid] : null;
    const firstName = info?.first_name || (uid ? uid : 'Anonymous');
    const lastName = info?.last_name || '';
    return {
      ...row,
      __first_name__: firstName,
      __last_name__: lastName,
    };
  });

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
    ? options!.existingColumns!.filter((c) => c.key !== '__user__' && c.key !== '__submitted__' && c.key !== '__first_name__' && c.key !== '__last_name__')
    : (options?.existingColumnKeys || []).map((k) => ({ key: k, label: k }));

  const cols = [
    { key: '__first_name__', label: 'First Name' },
    { key: '__last_name__', label: 'Last Name' },
    { key: '__submitted__', label: 'Submitted' },
    ...baseExisting,
    ...extra,
  ];
  const uniq: Col[] = [];
  const seen = new Set<string>();
  for (const c of cols) {
    if (!seen.has(c.key)) {
      seen.add(c.key);
      uniq.push(c);
    }
  }

  buildCsvAndDownload(enrichedRows, uniq, options?.filename);
  return { rows: enrichedRows, cols: uniq };
};
