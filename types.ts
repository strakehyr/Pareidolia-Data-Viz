
export interface DataPoint {
  [key: string]: any;
}

export interface ColumnInfo {
  name: string;
  originalName: string;
  type: 'number' | 'date' | 'string';
  sourceFileId: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  rawContent: string;
  delimiter: string;
  skipRows: number; // Legacy
  excludeRows: string; // "2, 3-5"
  excludeColumns: string; // "1, 4"
  hasHeader: boolean;
  prefixColumns: boolean; // Defaults to false
  decimalSeparator: '.' | ',';
  columns: string[];
  columnRenames?: { [original: string]: string };
  data: DataPoint[];
}

export type ChartType = 'line' | 'area' | 'bar' | 'scatter';
export type AggregationType = 'none' | 'sum' | 'mean' | 'min' | 'max' | 'abs_sum';

export interface AxisConfig {
  id: string;
  orientation: 'left' | 'right';
  min?: number | 'auto';
  max?: number | 'auto';
  label?: string;
}

export interface SeriesConfig {
  id: string;
  columnName: string;
  chartType: ChartType;
  yAxisId: string; // Now references AxisConfig.id
  color: string;
  aggregation: AggregationType;
}

export interface PlotConfig {
  xAxisColumn: string;
  xAxisLabel: string;
  series: SeriesConfig[];
  axes: AxisConfig[]; // List of configured Y axes
  timeAggregation: 'none' | 'minute' | '15min' | 'hour' | 'day' | 'week' | 'month';
  activePalette: string;
}

export interface ParsedResult {
  data: DataPoint[];
  columns: string[];
}

export interface ColorPalette {
  id: string;
  name: string;
  colors: string[];
}

export const PALETTES: { [key: string]: ColorPalette } = {
  cafeRacer: {
    id: 'cafeRacer',
    name: 'Cafe Racer',
    colors: ['#D94F2B', '#1F2937', '#D99F59', '#3B82F6', '#5D6D7E', '#8C7B75', '#17202A']
  },
  midnightRun: {
    id: 'midnightRun',
    name: 'Midnight Run',
    colors: ['#F43F5E', '#8B5CF6', '#0EA5E9', '#10B981', '#F59E0B', '#6366F1']
  },
  vintageEarth: {
    id: 'vintageEarth',
    name: 'Vintage Earth',
    colors: ['#BC6C25', '#606C38', '#283618', '#DDA15E', '#A68A64', '#5E503F']
  }
};
