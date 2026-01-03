import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Download, Plus, Trash2, X, BarChart2, Activity, Database, Table as TableIcon } from 'lucide-react';
import FileUpload from './components/FileUpload';
import ChartRenderer from './components/ChartRenderer';
import { UploadedFile, PlotConfig, SeriesConfig, DataPoint, AxisConfig, PALETTES } from './types';
import { parseCSV, combineDatasets, aggregateData } from './services/csvService';

const App: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [combinedData, setCombinedData] = useState<DataPoint[]>([]);
  const [allColumns, setAllColumns] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'visualize'>('upload');
  const [editingAxisId, setEditingAxisId] = useState<string | null>(null);
  
  const [exportConfig, setExportConfig] = useState<{ delimiter: string, decimal: '.' | ',' }>({
    delimiter: ',',
    decimal: '.'
  });

  const [plotConfig, setPlotConfig] = useState<PlotConfig>({
    xAxisColumn: '',
    xAxisLabel: '',
    series: [],
    axes: [
        { id: 'left', orientation: 'left', label: 'Left Axis', min: 'auto', max: 'auto' },
        { id: 'right', orientation: 'right', label: 'Right Axis', min: 'auto', max: 'auto' }
    ],
    timeAggregation: 'none',
    activePalette: 'cafeRacer'
  });

  const handleFilesUploaded = (newFiles: UploadedFile[]) => {
    setFiles(prev => [...prev, ...newFiles]);
  };

  const updateFileConfig = (id: string, key: keyof UploadedFile, value: any) => {
    setFiles(prev => prev.map(f => {
      if (f.id === id) {
        const updated = { ...f, [key]: value };
        if (['delimiter', 'excludeRows', 'excludeColumns', 'decimalSeparator', 'hasHeader'].includes(key)) {
          const parsed = parseCSV(updated.rawContent, {
            delimiter: updated.delimiter,
            decimalSeparator: updated.decimalSeparator,
            hasHeader: updated.hasHeader,
            excludeRows: updated.excludeRows,
            excludeColumns: updated.excludeColumns
          });
          updated.data = parsed.data;
          updated.columns = parsed.columns;
        }
        return updated;
      }
      return f;
    }));
  };

  const updateColumnRename = (fileId: string, originalCol: string, newName: string) => {
      setFiles(prev => prev.map(f => {
          if (f.id === fileId) {
              const newRenames = { ...(f.columnRenames || {}), [originalCol]: newName };
              if (!newName.trim()) delete newRenames[originalCol];
              return { ...f, columnRenames: newRenames };
          }
          return f;
      }));
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  useEffect(() => {
    const { combinedData, allColumns } = combineDatasets(files);
    setCombinedData(combinedData);
    setAllColumns(allColumns);

    if (allColumns.length > 0) {
        if (!plotConfig.xAxisColumn || !allColumns.includes(plotConfig.xAxisColumn)) {
            const dateCol = allColumns.find(c => c.toLowerCase().includes('date') || c.toLowerCase().includes('time'));
            setPlotConfig(prev => ({ ...prev, xAxisColumn: dateCol || allColumns[0] }));
        }
    }
  }, [files]);

  const processedData = useMemo(() => {
    return aggregateData(
        combinedData, 
        plotConfig.xAxisColumn, 
        plotConfig.timeAggregation,
        plotConfig.series
    );
  }, [combinedData, plotConfig.xAxisColumn, plotConfig.timeAggregation, plotConfig.series]);

  const getNextColor = () => {
      const palette = PALETTES[plotConfig.activePalette] || PALETTES.cafeRacer;
      const currentIndex = plotConfig.series.length;
      return palette.colors[currentIndex % palette.colors.length];
  };

  const addSeries = () => {
    if (allColumns.length === 0) return;
    const newSeries: SeriesConfig = {
      id: Math.random().toString(36).substr(2, 9),
      columnName: allColumns[1] || allColumns[0],
      chartType: 'line',
      yAxisId: 'left',
      color: getNextColor(),
      aggregation: 'mean'
    };
    setPlotConfig(prev => ({ ...prev, series: [...prev.series, newSeries] }));
  };

  const updateSeries = (id: string, key: keyof SeriesConfig, value: any) => {
    setPlotConfig(prev => ({
      ...prev,
      series: prev.series.map(s => s.id === id ? { ...s, [key]: value } : s)
    }));
  };

  const removeSeries = (id: string) => {
    setPlotConfig(prev => ({
      ...prev,
      series: prev.series.filter(s => s.id !== id)
    }));
  };

  const addAxis = (orientation: 'left' | 'right'): string => {
      const count = plotConfig.axes.filter(a => a.orientation === orientation).length + 1;
      const newId = `${orientation}-${Date.now()}`;
      const newAxis: AxisConfig = {
          id: newId,
          orientation: orientation,
          label: `${orientation.charAt(0).toUpperCase() + orientation.slice(1)} Axis ${count}`,
          min: 'auto',
          max: 'auto'
      };
      setPlotConfig(prev => ({ ...prev, axes: [...prev.axes, newAxis] }));
      return newId;
  };

  const handleSeriesAxisChange = (seriesId: string, value: string) => {
      if (value === 'NEW_LEFT') {
          const newId = addAxis('left');
          updateSeries(seriesId, 'yAxisId', newId);
      } else if (value === 'NEW_RIGHT') {
          const newId = addAxis('right');
          updateSeries(seriesId, 'yAxisId', newId);
      } else {
          updateSeries(seriesId, 'yAxisId', value);
      }
  };

  const updateAxis = (id: string, key: keyof AxisConfig, value: any) => {
    setPlotConfig(prev => ({
        ...prev,
        axes: prev.axes.map(a => a.id === id ? { ...a, [key]: value } : a)
    }));
  };

  const downloadCSV = () => {
    if (processedData.length === 0) return;
    const { delimiter, decimal } = exportConfig;
    const columns = Object.keys(processedData[0]);
    const headers = columns.join(delimiter);
    
    const rows = processedData.map(row => {
        return columns.map(col => {
            let val = row[col];
            if (typeof val === 'number') {
                let s = val.toString();
                if (decimal === ',') s = s.replace('.', ',');
                return s;
            }
            return `"${(val ?? '').toString().replace(/"/g, '""')}"`;
        }).join(delimiter);
    }).join('\n');

    const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pareidolia_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatStatDate = (val: any) => {
    if (val === null || val === undefined) return '-';
    if (typeof val !== 'number') return val.toString();
    
    // Check if it's potentially 1/1/1970 (timestamp 0 or very close)
    if (val === 0) return '-';
    
    // If it's a timestamp (roughly > year 2000), format it
    if (val > 946684800000) {
      const date = new Date(val);
      const formatted = date.toLocaleDateString();
      // Double check formatted string for standard 1970 representations
      if (formatted === '1/1/1970' || formatted === '01/01/1970' || formatted.includes('/1970')) return '-';
      return formatted;
    }
    
    // If it's just a regular number or index (e.g., 1 to 100), return as string
    return val.toString();
  };

  return (
    <div className="min-h-screen pb-12">
      <header className="bg-cream border-b-2 border-charcoal sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-charcoal flex items-center justify-center text-cream shadow-[4px_4px_0px_0px_rgba(217,79,43,1)]">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-tighter leading-none font-display">Pareidolia</h1>
              <p className="text-[10px] font-bold text-rust uppercase tracking-[0.2em] font-mono mt-1">// DATA VIZ</p>
            </div>
          </div>
          <nav className="flex gap-2 bg-charcoal/5 p-1">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'upload' ? 'bg-charcoal text-cream' : 'text-charcoal hover:bg-charcoal/10'}`}
            >
              Source
            </button>
            <button
              onClick={() => setActiveTab('visualize')}
              className={`px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'visualize' ? 'bg-charcoal text-cream' : 'text-charcoal hover:bg-charcoal/10'}`}
            >
              Visualize
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {activeTab === 'upload' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2">
            <section>
              <h2 className="text-xl font-bold text-charcoal uppercase tracking-tight flex items-center gap-2 mb-6">
                <Database size={20} className="text-rust" /> Load Data Sources
              </h2>
              <FileUpload onFilesUploaded={handleFilesUploaded} />
            </section>

            {files.length > 0 && (
              <section>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {files.map(file => (
                    <div key={file.id} className="bg-white p-6 border-2 border-charcoal shadow-[6px_6px_0px_0px_rgba(209,209,199,1)] relative group">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-rust"></div>
                      <div className="flex justify-between items-start mb-6">
                        <h3 className="font-bold font-mono text-sm truncate pr-4">{file.name}</h3>
                        <button onClick={() => removeFile(file.id)} className="text-slate hover:text-rust transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="space-y-4 font-mono text-[11px]">
                        <div>
                          <label className="block text-slate uppercase font-bold mb-1">Exclude Rows</label>
                          <input 
                            type="text" className="w-full bg-cream border border-charcoal px-3 py-2 outline-none focus:bg-white"
                            placeholder="e.g. 1-3, 10" value={file.excludeRows}
                            onChange={(e) => updateFileConfig(file.id, 'excludeRows', e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-slate uppercase font-bold mb-1">Delim</label>
                            <select 
                              className="w-full bg-cream border border-charcoal px-2 py-2 outline-none"
                              value={file.delimiter} onChange={(e) => updateFileConfig(file.id, 'delimiter', e.target.value)}
                            >
                              <option value=",">Comma</option>
                              <option value=";">Semicolon</option>
                              <option value={"\t"}>Tab</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate uppercase font-bold mb-1">Decimals</label>
                            <select 
                              className="w-full bg-cream border border-charcoal px-2 py-2 outline-none"
                              value={file.decimalSeparator} onChange={(e) => updateFileConfig(file.id, 'decimalSeparator', e.target.value)}
                            >
                              <option value=".">Dot (.)</option>
                              <option value=",">Comma (,)</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-cream">
                          <label className="flex items-center gap-2 cursor-pointer group/chk">
                            <input type="checkbox" checked={file.hasHeader} onChange={(e) => updateFileConfig(file.id, 'hasHeader', e.target.checked)} className="hidden" />
                            <div className={`w-3.5 h-3.5 border border-charcoal flex items-center justify-center ${file.hasHeader ? 'bg-charcoal' : 'bg-cream'}`}>
                                {file.hasHeader && <div className="w-1.5 h-1.5 bg-cream" />}
                            </div>
                            <span className="uppercase font-bold text-[9px]">Header</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer group/chk">
                            <input type="checkbox" checked={file.prefixColumns} onChange={(e) => updateFileConfig(file.id, 'prefixColumns', e.target.checked)} className="hidden" />
                            <div className={`w-3.5 h-3.5 border border-charcoal flex items-center justify-center ${file.prefixColumns ? 'bg-charcoal' : 'bg-cream'}`}>
                                {file.prefixColumns && <div className="w-1.5 h-1.5 bg-cream" />}
                            </div>
                            <span className="uppercase font-bold text-[9px]">Prefix</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer group/chk">
                            <input type="checkbox" checked={file.includeIndex} onChange={(e) => updateFileConfig(file.id, 'includeIndex', e.target.checked)} className="hidden" />
                            <div className={`w-3.5 h-3.5 border border-charcoal flex items-center justify-center ${file.includeIndex ? 'bg-charcoal' : 'bg-cream'}`}>
                                {file.includeIndex && <div className="w-1.5 h-1.5 bg-cream" />}
                            </div>
                            <span className="uppercase font-bold text-[9px]">Index</span>
                          </label>
                        </div>
                        <details className="pt-2">
                          <summary className="cursor-pointer text-rust font-bold uppercase hover:underline text-[9px]">Rename Columns</summary>
                          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                            {file.columns.map(col => (
                              <div key={col} className="flex items-center gap-2">
                                <span className="flex-1 truncate text-slate">{col}</span>
                                <input 
                                  className="w-24 bg-cream border border-charcoal px-2 py-1"
                                  placeholder="Alias" value={file.columnRenames?.[col] || ""}
                                  onChange={(e) => updateColumnRename(file.id, col, e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {combinedData.length > 0 && (
              <section className="bg-white border-2 border-charcoal p-6 shadow-[6px_6px_0px_0px_rgba(42,42,42,1)]">
                <div className="flex justify-between items-center mb-6 pb-2 border-b-2 border-cream">
                  <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <TableIcon size={16} className="text-rust" /> Sequence Preview
                  </h3>
                  <div className="text-[10px] font-bold text-slate uppercase tracking-widest">
                    Displaying up to 100 entries
                  </div>
                </div>
                
                <div className="overflow-auto max-h-[500px] border border-charcoal/10 custom-scrollbar">
                  <table className="min-w-full font-mono text-[11px] text-left border-collapse">
                    <thead className="bg-cream sticky top-0 z-10">
                      <tr>
                        {allColumns.map(c => (
                          <th key={c} className="px-4 py-3 border border-charcoal bg-cream uppercase whitespace-nowrap font-bold text-charcoal shadow-[inset_0_-1px_0_rgba(42,42,42,1)]">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cream/50 bg-white">
                      {combinedData.slice(0, 100).map((row, i) => (
                        <tr key={i} className="hover:bg-cream/40 transition-colors even:bg-cream/10">
                          {allColumns.map(c => (
                            <td key={c} className="px-4 py-2 border border-charcoal/20 text-slate whitespace-nowrap">
                              {typeof row[c] === 'number' && row[c] > 946684800000 
                                ? new Date(row[c]).toLocaleString() 
                                : typeof row[c] === 'number' 
                                  ? row[c].toLocaleString(undefined, { maximumFractionDigits: 4 })
                                  : row[c]?.toString() || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-6 text-[10px] font-bold text-slate uppercase tracking-widest flex justify-between items-center">
                  <div className="flex gap-4">
                    <span>Total Rows: {combinedData.length}</span>
                    <span className="text-rust">Active Columns: {allColumns.length}</span>
                  </div>
                  <span className="bg-charcoal text-cream px-2 py-0.5">Buffer: Ready</span>
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === 'visualize' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 animate-in fade-in slide-in-from-bottom-2">
            <aside className="lg:col-span-1 space-y-8">
              <div className="bg-white border-2 border-charcoal p-6 shadow-[4px_4px_0px_0px_rgba(42,42,42,1)]">
                <h3 className="text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Settings size={14} className="text-rust" /> Parameters
                </h3>
                <div className="space-y-6 font-mono text-xs">
                  <div>
                    <label className="block text-slate uppercase font-bold mb-1">X-Axis Base</label>
                    <select 
                      className="w-full bg-cream border border-charcoal px-3 py-2 outline-none"
                      value={plotConfig.xAxisColumn} onChange={(e) => setPlotConfig(prev => ({ ...prev, xAxisColumn: e.target.value }))}
                    >
                      {allColumns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate uppercase font-bold mb-1">Binning / Time</label>
                    <select 
                      className="w-full bg-cream border border-charcoal px-3 py-2 outline-none"
                      value={plotConfig.timeAggregation} onChange={(e) => setPlotConfig(prev => ({ ...prev, timeAggregation: e.target.value as any }))}
                    >
                      <option value="none">None</option>
                      <option value="minute">Minute</option>
                      <option value="15min">15m</option>
                      <option value="hour">Hour</option>
                      <option value="day">Day</option>
                      <option value="week">Week</option>
                      <option value="month">Month</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate uppercase font-bold mb-2">Palette</label>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.values(PALETTES).map(p => (
                        <button 
                          key={p.id} onClick={() => setPlotConfig(prev => ({ ...prev, activePalette: p.id }))}
                          className={`h-8 border-2 ${plotConfig.activePalette === p.id ? 'border-rust shadow-[2px_2px_0px_0px_rgba(217,79,43,1)]' : 'border-charcoal opacity-40'} flex overflow-hidden`}
                        >
                          {p.colors.slice(0, 3).map(c => <div key={c} className="flex-1" style={{ backgroundColor: c }} />)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border-2 border-charcoal p-6 shadow-[4px_4px_0px_0px_rgba(42,42,42,1)]">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <BarChart2 size={14} className="text-rust" /> Series
                  </h3>
                  <button onClick={addSeries} className="bg-charcoal text-cream p-1.5 hover:bg-rust transition-colors">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                  {plotConfig.series.map(s => (
                    <div key={s.id} className="p-4 bg-cream border border-charcoal relative mb-4 last:mb-0">
                      <button onClick={() => removeSeries(s.id)} className="absolute top-2 right-2 text-slate hover:text-rust"><Trash2 size={12} /></button>
                      <div className="space-y-3 font-mono text-[10px]">
                        <select 
                          className="w-full bg-white border border-charcoal px-2 py-1.5 font-bold uppercase"
                          value={s.columnName} onChange={(e) => updateSeries(s.id, 'columnName', e.target.value)}
                        >
                          {allColumns.map(col => <option key={col} value={col}>{col}</option>)}
                        </select>
                        <div className="flex gap-2">
                          <select className="flex-1 bg-white border border-charcoal px-1 py-1" value={s.chartType} onChange={(e) => updateSeries(s.id, 'chartType', e.target.value)}>
                            <option value="line">Line</option>
                            <option value="bar">Bar</option>
                            <option value="area">Area</option>
                            <option value="scatter">Scatter</option>
                          </select>
                          <select className="flex-1 bg-white border border-charcoal px-1 py-1" value={s.aggregation} onChange={(e) => updateSeries(s.id, 'aggregation', e.target.value)}>
                            <option value="mean">Avg</option>
                            <option value="sum">Sum</option>
                            <option value="min">Min</option>
                            <option value="max">Max</option>
                            <option value="abs_sum">AbsSum</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 border border-charcoal" style={{ backgroundColor: s.color }} />
                          <select 
                            className="flex-1 bg-white border border-charcoal px-2 py-1"
                            value={s.yAxisId} onChange={(e) => handleSeriesAxisChange(s.id, e.target.value)}
                          >
                            {plotConfig.axes.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                            <option value="NEW_LEFT">+ Left</option>
                            <option value="NEW_RIGHT">+ Right</option>
                          </select>
                          <button onClick={() => setEditingAxisId(s.yAxisId)} className="p-1.5 border border-charcoal bg-white hover:bg-rust hover:text-cream transition-colors">
                            <Settings size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border-2 border-charcoal p-6 shadow-[4px_4px_0px_0px_rgba(42,42,42,1)]">
                <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-6">
                  <Download size={14} className="text-rust" /> Export Config
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 font-mono text-[10px]">
                    <div>
                      <label className="block text-slate font-bold mb-1 uppercase tracking-tight">Delimiter</label>
                      <select 
                          className="w-full bg-cream border border-charcoal px-2 py-1.5 outline-none"
                          value={exportConfig.delimiter}
                          onChange={(e) => setExportConfig(prev => ({ ...prev, delimiter: e.target.value }))}
                      >
                          <option value=",">Comma (,)</option>
                          <option value=";">Semicolon (;)</option>
                          <option value={"\t"}>Tab</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate font-bold mb-1 uppercase tracking-tight">Decimal</label>
                      <select 
                          className="w-full bg-cream border border-charcoal px-2 py-1.5 outline-none"
                          value={exportConfig.decimal}
                          onChange={(e) => setExportConfig(prev => ({ ...prev, decimal: e.target.value as any }))}
                      >
                          <option value=".">Dot (.)</option>
                          <option value=",">Comma (,)</option>
                      </select>
                    </div>
                  </div>
                  <button 
                    onClick={downloadCSV}
                    className="w-full py-4 px-2 bg-charcoal text-cream font-bold shadow-[6px_6px_0px_0px_rgba(217,79,43,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4 group"
                    disabled={processedData.length === 0}
                  >
                    <Download size={18} className="group-hover:scale-110 transition-transform shrink-0" /> 
                    <span className="uppercase tracking-tight text-[11px] whitespace-nowrap overflow-hidden text-ellipsis">Export Clean CSV</span>
                  </button>
                </div>
              </div>
            </aside>

            <section className="lg:col-span-3 space-y-8">
              <ChartRenderer data={processedData} config={plotConfig} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: "Data points", val: processedData.length },
                  { label: "Series", val: plotConfig.series.length },
                  { label: "Start", val: formatStatDate(processedData[0]?.[plotConfig.xAxisColumn]) },
                  { label: "End", val: formatStatDate(processedData.at(-1)?.[plotConfig.xAxisColumn]) }
                ].map((stat, i) => (
                  <div key={i} className="bg-white border-2 border-charcoal p-5 shadow-[4px_4px_0px_0px_rgba(42,42,42,1)]">
                    <p className="text-[10px] font-bold uppercase text-slate mb-1 tracking-widest">{stat.label}</p>
                    <p className="text-xl font-bold font-display truncate">{stat.val}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {editingAxisId && (
        <div className="fixed inset-0 bg-charcoal/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-charcoal p-8 max-w-sm w-full shadow-[10px_10px_0px_0px_rgba(217,79,43,1)]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-bold uppercase tracking-widest font-display">Axis Config</h3>
              <button onClick={() => setEditingAxisId(null)}><X size={20} /></button>
            </div>
            {plotConfig.axes.find(a => a.id === editingAxisId) && (
              <div className="space-y-6 font-mono text-xs">
                <div>
                  <label className="block font-bold uppercase text-slate mb-2">Display Label</label>
                  <input 
                    type="text" className="w-full bg-cream border border-charcoal px-3 py-2 outline-none"
                    value={plotConfig.axes.find(a => a.id === editingAxisId)?.label}
                    onChange={(e) => updateAxis(editingAxisId, 'label', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold uppercase text-slate mb-2">Min Range</label>
                    <input 
                      type="text" className="w-full bg-cream border border-charcoal px-3 py-2 outline-none"
                      placeholder="Auto" value={plotConfig.axes.find(a => a.id === editingAxisId)?.min === 'auto' ? '' : plotConfig.axes.find(a => a.id === editingAxisId)?.min}
                      onChange={(e) => updateAxis(editingAxisId, 'min', e.target.value === '' ? 'auto' : Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-slate mb-2">Max Range</label>
                    <input 
                      type="text" className="w-full bg-cream border border-charcoal px-3 py-2 outline-none"
                      placeholder="Auto" value={plotConfig.axes.find(a => a.id === editingAxisId)?.max === 'auto' ? '' : plotConfig.axes.find(a => a.id === editingAxisId)?.max}
                      onChange={(e) => updateAxis(editingAxisId, 'max', e.target.value === '' ? 'auto' : Number(e.target.value))}
                    />
                  </div>
                </div>
                <button onClick={() => setEditingAxisId(null)} className="w-full py-3 bg-charcoal text-cream font-bold uppercase tracking-widest hover:bg-rust transition-colors">Apply changes</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;