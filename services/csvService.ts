import { DataPoint, UploadedFile, ParsedResult } from '../types';

// Helper: Parse date strings like "30/09/2025 00:00" or "2025-09-30"
const parseFlexibleDate = (value: string): number | null => {
  if (!value || typeof value !== 'string' || value.trim() === '') return null;
  const str = value.trim();

  const euroMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (euroMatch) {
    const day = parseInt(euroMatch[1], 10);
    const month = parseInt(euroMatch[2], 10) - 1;
    const year = parseInt(euroMatch[3], 10);
    const hour = euroMatch[4] ? parseInt(euroMatch[4], 10) : 0;
    const minute = euroMatch[5] ? parseInt(euroMatch[5], 10) : 0;
    const second = euroMatch[6] ? parseInt(euroMatch[6], 10) : 0;
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    const date = new Date(year, month, day, hour, minute, second);
    if (!isNaN(date.getTime())) return date.getTime();
  }

  const isoMatch = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      const hour = isoMatch[4] ? parseInt(isoMatch[4], 10) : 0;
      const minute = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
      const second = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
      const date = new Date(year, month, day, hour, minute, second);
      if (!isNaN(date.getTime())) return date.getTime();
  }

  if (/^\d{4}$/.test(str)) return null;
  const stdDate = new Date(str);
  if (!isNaN(stdDate.getTime()) && str.length > 5 && !/^\d+$/.test(str)) {
     return stdDate.getTime();
  }
  return null;
};

export const detectDelimiter = (text: string): string => {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0).slice(0, 5);
  if (lines.length === 0) return ',';
  const commaCount = (lines[0].match(/,/g) || []).length;
  const semiCount = (lines[0].match(/;/g) || []).length;
  const tabCount = (lines[0].match(/\t/g) || []).length;
  if (semiCount > commaCount && semiCount >= tabCount) return ';';
  if (tabCount > commaCount && tabCount > semiCount) return '\t';
  return ',';
};

export const detectDecimalSeparator = (text: string, delimiter: string): '.' | ',' => {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0).slice(1, 10);
  if (lines.length === 0) return '.';
  let dotScore = 0;
  let commaScore = 0;
  lines.forEach(line => {
    const cleanLine = line.replace(/"[^"]*"/g, '');
    const parts = cleanLine.split(delimiter);
    parts.forEach(part => {
      if (part.match(/^\d+\.\d+$/)) dotScore++;
      if (part.match(/^\d+,\d+$/)) commaScore++;
    });
  });
  return commaScore > dotScore ? ',' : '.';
};

const parseCSVLine = (line: string, delimiter: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else current += char;
  }
  result.push(current.trim());
  return result;
};

const parseExclusions = (input: string): Set<number> => {
    const indices = new Set<number>();
    if (!input || typeof input !== 'string') return indices;
    const trimmed = input.trim();
    if (trimmed === '') return indices;
    trimmed.split(',').forEach(part => {
        const p = part.trim();
        if (p === '') return;
        if (p.includes('-')) {
            const [start, end] = p.split('-').map(n => parseInt(n));
            if (!isNaN(start) && !isNaN(end)) for (let i = start; i <= end; i++) indices.add(i);
        } else {
            const num = parseInt(p);
            if (!isNaN(num)) indices.add(num);
        }
    });
    return indices;
};

const cleanHeader = (header: string): string => header.replace(/[\uFEFF\u200B]/g, '').trim();

export const parseCSV = (
  content: string, 
  config: { 
    delimiter?: string, 
    decimalSeparator?: '.' | ',',
    hasHeader: boolean,
    excludeRows?: string,
    excludeColumns?: string
  }
): ParsedResult => {
  let cleanContent = content;
  if (cleanContent.charCodeAt(0) === 0xFEFF) cleanContent = cleanContent.slice(1);
  let allLines = cleanContent.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (allLines.length === 0) return { data: [], columns: [] };
  const excludedRowIndices = parseExclusions(config.excludeRows || "");
  const linesToProcess: string[] = [];
  allLines.forEach((line, idx) => {
      if (!excludedRowIndices.has(idx + 1)) linesToProcess.push(line);
  });
  if (linesToProcess.length === 0) return { data: [], columns: [] };
  const delimiter = config.delimiter || detectDelimiter(cleanContent);
  const decimalSeparator = config.decimalSeparator || detectDecimalSeparator(cleanContent, delimiter);
  let headers: string[] = [];
  let startIndex = 0;
  if (config.hasHeader) {
    headers = parseCSVLine(linesToProcess[0], delimiter).map(h => h.replace(/^"|"$/g, '')).map(cleanHeader);
    startIndex = 1;
  } else {
    headers = parseCSVLine(linesToProcess[0], delimiter).map((_, i) => `Column ${i + 1}`);
  }
  if (startIndex < linesToProcess.length) {
      const secondLine = linesToProcess[startIndex];
      if (/\[.*\]/.test(secondLine) || /\(.*\)/.test(secondLine) || secondLine.toLowerCase().includes('unit')) startIndex++;
  }
  const excludedColIndices = parseExclusions(config.excludeColumns || "");
  const activeColumnIndices: number[] = [];
  const finalHeaders: string[] = [];
  headers.forEach((h, idx) => {
      if (!excludedColIndices.has(idx + 1)) {
          activeColumnIndices.push(idx);
          finalHeaders.push(h);
      }
  });
  const data: DataPoint[] = [];
  for (let i = startIndex; i < linesToProcess.length; i++) {
    const rawValues = parseCSVLine(linesToProcess[i], delimiter);
    if (rawValues.length < headers.length * 0.5) continue; 
    const row: DataPoint = {};
    let hasData = false;
    activeColumnIndices.forEach((originalColIdx, newColIdx) => {
        const headerName = finalHeaders[newColIdx];
        let val = rawValues[originalColIdx];
        if (val !== undefined && val !== '') {
            val = val.replace(/^"|"$/g, '');
            if (decimalSeparator === ',') {
                if (val.includes('.') && val.includes(',')) val = val.replace(/\./g, '').replace(',', '.');
                else if (val.includes(',')) val = val.replace(',', '.');
            }
            if (/^-?\d+(\.\d+)?$/.test(val)) {
                 const num = parseFloat(val);
                 row[headerName] = (!isNaN(num) && isFinite(num)) ? num : null;
            } else {
                const timestamp = parseFlexibleDate(val);
                if (timestamp !== null) row[headerName] = timestamp;
                else {
                    const looseNum = parseFloat(val);
                    row[headerName] = (!isNaN(looseNum) && isFinite(looseNum)) ? looseNum : val;
                }
            }
            hasData = true;
        } else row[headerName] = null;
    });
    if (hasData) data.push(row);
  }
  return { data, columns: finalHeaders };
};

export const combineDatasets = (files: UploadedFile[]): { combinedData: DataPoint[], allColumns: string[] } => {
    if (files.length === 0) return { combinedData: [], allColumns: [] };
    const isTimeCol = (val: any) => typeof val === 'number' && val > 946684800000; 
    const fileMaps = files.map(f => {
        const timeColOriginal = f.columns.find(c => {
            const validCount = f.data.slice(0, 20).filter(r => isTimeCol(r[c])).length;
            return validCount > 0;
        });
        return { file: f, timeColOriginal: timeColOriginal, prefix: f.name.replace(/\.csv$|\.txt$/i, '') };
    });
    const allHaveTime = fileMaps.every(m => m.timeColOriginal);
    let allColumns: string[] = [];
    let combinedData: DataPoint[] = [];

    if (allHaveTime) {
        const masterMap = new Map<number, DataPoint>();
        fileMaps.forEach(({ file, timeColOriginal, prefix }) => {
            const renames = file.columnRenames || {};
            const indexColName = file.prefixColumns ? `${prefix} - index` : 'index';
            
            file.data.forEach((row, rowIdx) => {
                const timeVal = row[timeColOriginal!];
                if (typeof timeVal !== 'number' || isNaN(timeVal) || timeVal < 946684800000) return;
                
                if (!masterMap.has(timeVal)) masterMap.set(timeVal, { '_timestamp_': timeVal }); 
                const existing = masterMap.get(timeVal)!;
                
                if (file.includeIndex) {
                    existing[indexColName] = rowIdx;
                    if (!allColumns.includes(indexColName)) allColumns.push(indexColName);
                }
                
                file.columns.forEach(col => {
                    let finalName = renames[col] || (col === timeColOriginal ? col : (file.prefixColumns ? `${prefix} - ${col}` : col));
                    const val = row[col];
                    if (val !== null && val !== undefined) existing[finalName] = val;
                    else if (existing[finalName] === undefined) existing[finalName] = null;
                    if (!allColumns.includes(finalName)) allColumns.push(finalName);
                });
            });
        });
        combinedData = Array.from(masterMap.values()).sort((a, b) => (a['_timestamp_'] || 0) - (b['_timestamp_'] || 0));
    } else {
        const maxRows = Math.max(...files.map(f => f.data.length));
        for (let i = 0; i < maxRows; i++) {
            const mergedRow: DataPoint = {};
            fileMaps.forEach(({ file, prefix }) => {
                const indexColName = file.prefixColumns ? `${prefix} - index` : 'index';
                if (file.includeIndex) {
                    mergedRow[indexColName] = i;
                    if (!allColumns.includes(indexColName)) allColumns.push(indexColName);
                }
                
                if (file.data[i]) {
                    const renames = file.columnRenames || {};
                    Object.keys(file.data[i]).forEach(key => {
                        let finalName = renames[key] || (file.prefixColumns ? `${prefix} - ${key}` : key);
                        const val = file.data[i][key];
                        if (val !== null && val !== undefined) mergedRow[finalName] = val;
                        if (!allColumns.includes(finalName)) allColumns.push(finalName);
                    });
                }
            });
            combinedData.push(mergedRow);
        }
    }
    return { combinedData, allColumns };
};

export const aggregateData = (
    data: DataPoint[], 
    xAxisCol: string, 
    method: 'none' | 'minute' | '15min' | 'hour' | 'day' | 'week' | 'month',
    series: any[]
): DataPoint[] => {
    if (!xAxisCol || data.length === 0) return data;
    const validData = data.filter(row => typeof row[xAxisCol] === 'number' && !isNaN(row[xAxisCol]));
    if (method === 'none') return validData.sort((a, b) => (a[xAxisCol] || 0) - (b[xAxisCol] || 0));
    const groups = new Map<number, DataPoint[]>();
    validData.forEach(row => {
        const date = new Date(row[xAxisCol]);
        let key = 0;
        switch (method) {
            case 'minute': key = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()).getTime(); break;
            case '15min': key = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), Math.floor(date.getMinutes() / 15) * 15).getTime(); break;
            case 'hour': key = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).getTime(); break;
            case 'day': key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(); break;
            case 'week': 
                const d = new Date(date);
                const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
                key = new Date(d.setDate(diff)).setHours(0,0,0,0);
                break;
            case 'month': key = new Date(date.getFullYear(), date.getMonth(), 1).getTime(); break;
        }
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
    });
    const aggregated: DataPoint[] = [];
    groups.forEach((rows, timeKey) => {
        const newRow: DataPoint = { [xAxisCol]: timeKey };
        series.forEach(s => {
            const col = s.columnName;
            const values = rows.map(r => r[col]).filter(v => typeof v === 'number');
            let val = 0;
            if (values.length > 0) {
                switch (s.aggregation) {
                    case 'sum': val = values.reduce((a, b) => a + b, 0); break;
                    case 'mean': val = values.reduce((a, b) => a + b, 0) / values.length; break;
                    case 'min': val = Math.min(...values); break;
                    case 'max': val = Math.max(...values); break;
                    case 'abs_sum': val = values.reduce((a, b) => a + Math.abs(b), 0); break;
                }
            }
            newRow[col] = val;
        });
        aggregated.push(newRow);
    });
    return aggregated.sort((a, b) => a[xAxisCol] - b[xAxisCol]);
}