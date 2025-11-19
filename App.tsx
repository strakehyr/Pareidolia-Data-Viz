
import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Download, Plus, Trash2, RefreshCw, Sparkles, FileText, X, BarChart2, Activity, Droplet, ChevronDown, ChevronRight } from 'lucide-react';
import FileUpload from './components/FileUpload';
import ChartRenderer from './components/ChartRenderer';
import { UploadedFile, PlotConfig, SeriesConfig, DataPoint, AxisConfig, PALETTES, ColorPalette } from './types';
import { parseCSV, combineDatasets, aggregateData } from './services/csvService';
import { generateDataInsights } from './services/geminiService';

const App: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [combinedData, setCombinedData] = useState<DataPoint[]>([]);
  const [allColumns, setAllColumns] = useState<string[]>([]);
  
  const [activeTab, setActiveTab] = useState<'upload' | 'visualize'>('upload');
  const [showAiModal, setShowAiModal] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);

  // Config with default axes
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

  const [editingAxisId, setEditingAxisId] = useState<string | null>(null);

  const handleFilesUploaded = (newFiles: UploadedFile[]) => {
    setFiles(prev => [...prev, ...newFiles]);
  };

  const updateFileConfig = (id: string, key: keyof UploadedFile, value: any) => {
    setFiles(prev => prev.map(f => {
      if (f.id === id) {
        const updated = { ...f, [key]: value };
        if (['delimiter', 'skipRows', 'excludeRows', 'excludeColumns', 'decimalSeparator', 'hasHeader'].includes(key)) {
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
              // Clean up empty names
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
      yAxisId: 'left', // Default to left
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
    const headers = Object.keys(processedData[0]).join(',');
    const rows = processedData.map(row => Object.values(row).join(',')).join('\n');
    const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pareidolia_processed.csv';
    a.click();
  };

  const handleGenerateInsights = async () => {
    setGeminiLoading(true);
    setInsights(null);
    const result = await generateDataInsights(processedData, plotConfig.xAxisColumn, plotConfig.series);
    setInsights(result);
    setGeminiLoading(false);
  };

  const renderPreviewCell = (val: any) => {
      if (val === null || val === undefined) return <span className="text-[#B0B0A8] italic">null</span>;
      if (typeof val === 'number' && val > 946684800000) {
          try {
              return new Date(val).toLocaleString('en-GB'); 
          } catch { return val; }
      }
      if (typeof val === 'number') return val.toLocaleString();
      return val.toString();
  };

  const getEditingAxis = () => plotConfig.axes.find(a => a.id === editingAxisId);

  return (
    <div className="min-h-screen pb-12 relative text-[#2A2A2A]">
      
      {/* Retro Header */}
      <header className="bg-[#F2F0E9] border-b border-[#D1D1C7] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2A2A2A] rounded-sm flex items-center justify-center text-[#F2F0E9] shadow-[2px_2px_0px_0px_rgba(217,79,43,1)]">
              <Activity size={20} />
            </div>
            <div>
                <h1 className="text-2xl font-bold tracking-tight uppercase leading-none" style={{ fontFamily: 'Space Grotesk' }}>
                Pareidolia
                </h1>
                <p className="text-[10px] font-bold text-[#D94F2B] uppercase tracking-widest font-mono opacity-80">// Data Viz</p>
            </div>
          </div>
          <nav className="flex gap-1 bg-[#E5E5DC] p-1 rounded-md">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-5 py-2 text-sm font-bold uppercase tracking-wide rounded-sm transition-all ${activeTab === 'upload' ? 'bg-[#2A2A2A] text-[#F2F0E9] shadow-md' : 'text-[#6B6B63] hover:text-[#2A2A2A]'}`}
            >
              Data Source
            </button>
            <button
              onClick={() => setActiveTab('visualize')}
              className={`px-5 py-2 text-sm font-bold uppercase tracking-wide rounded-sm transition-all ${activeTab === 'visualize' ? 'bg-[#2A2A2A] text-[#F2F0E9] shadow-md' : 'text-[#6B6B63] hover:text-[#2A2A2A]'}`}
            >
              Visualize
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {activeTab === 'upload' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section>
              <h2 className="text-xl font-bold text-[#2A2A2A] mb-2 uppercase tracking-wide flex items-center gap-2">
                <FileText size={20} className="text-[#D94F2B]" /> Upload Data
              </h2>
              <p className="text-[#5D6D7E] mb-6 font-mono text-sm">Drag and drop CSV files to begin parsing sequence.</p>
              <FileUpload onFilesUploaded={handleFilesUploaded} />
            </section>

            {files.length > 0 && (
              <section>
                <h3 className="text-lg font-bold text-[#2A2A2A] mb-4 uppercase tracking-wide border-b-2 border-[#D1D1C7] inline-block pb-1">File Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {files.map(file => (
                    <div key={file.id} className="bg-[#F9F9F4] p-5 rounded-sm border border-[#D1D1C7] shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-[#D94F2B]"></div>
                      <div className="flex justify-between items-start mb-4 pl-2">
                        <div className="flex items-center gap-2 text-[#2A2A2A] font-bold font-mono">
                          <span className="truncate max-w-[200px]">{file.name}</span>
                        </div>
                        <button onClick={() => removeFile(file.id)} className="text-[#8C8C85] hover:text-[#D94F2B] transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-xs font-mono pl-2">
                        <div className="col-span-2">
                             <label className="block text-[#5D6D7E] mb-1 uppercase">Exclude Rows (Indices)</label>
                             <input 
                                type="text" 
                                className="w-full bg-[#F2F0E9] border border-[#D1D1C7] rounded-none px-2 py-1.5 focus:border-[#D94F2B] outline-none text-[#2A2A2A]"
                                placeholder="e.g., 2, 3-5"
                                value={file.excludeRows || ""}
                                onChange={(e) => updateFileConfig(file.id, 'excludeRows', e.target.value)}
                              />
                        </div>

                        <div className="col-span-2">
                             <label className="block text-[#5D6D7E] mb-1 uppercase">Exclude Cols (Indices)</label>
                             <input 
                                type="text" 
                                className="w-full bg-[#F2F0E9] border border-[#D1D1C7] rounded-none px-2 py-1.5 focus:border-[#D94F2B] outline-none text-[#2A2A2A]"
                                placeholder="e.g., 1, 4"
                                value={file.excludeColumns || ""}
                                onChange={(e) => updateFileConfig(file.id, 'excludeColumns', e.target.value)}
                              />
                        </div>

                        <div>
                          <label className="block text-[#5D6D7E] mb-1 uppercase">Delimiter</label>
                          <select 
                            className="w-full bg-[#F2F0E9] border border-[#D1D1C7] rounded-none px-2 py-1.5 focus:border-[#D94F2B] outline-none text-[#2A2A2A]"
                            value={file.delimiter}
                            onChange={(e) => updateFileConfig(file.id, 'delimiter', e.target.value)}
                          >
                            <option value=",">Comma (,)</option>
                            <option value=";">Semicolon (;)</option>
                            <option value={"\t"}>Tab</option>
                          </select>
                        </div>
                         <div>
                          <label className="block text-[#5D6D7E] mb-1 uppercase">Decimals</label>
                          <select 
                            className="w-full bg-[#F2F0E9] border border-[#D1D1C7] rounded-none px-2 py-1.5 focus:border-[#D94F2B] outline-none text-[#2A2A2A]"
                            value={file.decimalSeparator}
                            onChange={(e) => updateFileConfig(file.id, 'decimalSeparator', e.target.value)}
                          >
                            <option value=".">Dot (.)</option>
                            <option value=",">Comma (,)</option>
                          </select>
                        </div>
                        
                        {/* New Options */}
                         <div className="flex items-center gap-4 col-span-2 pt-2 border-t border-[#E5E5DC]">
                            <label className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                                <div className={`w-4 h-4 border flex items-center justify-center ${file.hasHeader ? 'bg-[#D94F2B] border-[#D94F2B]' : 'border-[#8C8C85]'}`}>
                                    {file.hasHeader && <div className="w-2 h-2 bg-white"></div>}
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={file.hasHeader}
                                    onChange={(e) => updateFileConfig(file.id, 'hasHeader', e.target.checked)}
                                    className="hidden"
                                />
                                <span className="text-[#2A2A2A] uppercase font-bold text-[10px]">Has Header</span>
                            </label>

                             <label className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                                <div className={`w-4 h-4 border flex items-center justify-center ${file.prefixColumns ? 'bg-[#D94F2B] border-[#D94F2B]' : 'border-[#8C8C85]'}`}>
                                    {file.prefixColumns && <div className="w-2 h-2 bg-white"></div>}
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={file.prefixColumns}
                                    onChange={(e) => updateFileConfig(file.id, 'prefixColumns', e.target.checked)}
                                    className="hidden"
                                />
                                <span className="text-[#2A2A2A] uppercase font-bold text-[10px]">Prefix Filename</span>
                            </label>
                        </div>

                        {/* Column Renaming Section */}
                        <div className="col-span-2 mt-2">
                            <details className="group/details">
                                <summary className="cursor-pointer text-[10px] font-bold uppercase text-[#5D6D7E] hover:text-[#D94F2B] flex items-center gap-1 transition-colors select-none">
                                    <ChevronRight size={12} className="group-open/details:rotate-90 transition-transform" />
                                    Column Mapping / Renaming
                                </summary>
                                <div className="mt-2 pl-2 space-y-2 max-h-40 overflow-y-auto border-l border-[#E5E5DC]">
                                    {file.columns.map(col => (
                                        <div key={col} className="grid grid-cols-2 gap-2 items-center">
                                            <span className="truncate text-[10px] text-[#8C8C85]" title={col}>{col}</span>
                                            <input 
                                                type="text"
                                                className="w-full bg-white border border-[#D1D1C7] rounded-none px-2 py-1 text-[10px] focus:border-[#D94F2B] outline-none text-[#2A2A2A]"
                                                placeholder="Alias..."
                                                value={file.columnRenames?.[col] || ""}
                                                onChange={(e) => updateColumnRename(file.id, col, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Data Preview Table */}
            {combinedData.length > 0 && (
                <section>
                    <div className="bg-[#F9F9F4] p-5 rounded-sm border border-[#D1D1C7] shadow-sm overflow-hidden">
                        <h3 className="text-xs font-bold text-[#2A2A2A] uppercase tracking-widest mb-4 border-b border-[#D1D1C7] pb-2">Data Preview Sequence</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-xs text-left font-mono">
                                <thead className="bg-[#E5E5DC] text-[#2A2A2A]">
                                    <tr>
                                        {allColumns.map(c => <th key={c} className="px-3 py-2 border-b border-[#D1D1C7]">{c}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E5E5DC]">
                                    {combinedData.slice(0, 5).map((row, i) => (
                                        <tr key={i} className="hover:bg-[#F2F0E9]">
                                            {allColumns.map(c => (
                                                <td key={c} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate text-[#5D6D7E]">
                                                   {renderPreviewCell(row[c])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-[#E5E5DC] px-3 py-2 text-[10px] font-mono text-[#5D6D7E] uppercase tracking-wide">
                             Buffer Size: {combinedData.length} records
                        </div>
                    </div>
                </section>
            )}
          </div>
        )}

        {activeTab === 'visualize' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="lg:col-span-1 space-y-6">
              
              <div className="bg-[#F9F9F4] p-5 rounded-sm border border-[#D1D1C7] shadow-[4px_4px_0px_0px_rgba(217,79,43,0.1)]">
                <h3 className="text-xs font-bold text-[#2A2A2A] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Settings size={14} /> Global Parameters
                </h3>
                <div className="space-y-4 font-mono">
                    <div>
                        <label className="block text-[10px] font-bold text-[#5D6D7E] mb-1 uppercase">X-Axis Column</label>
                        <select 
                            className="w-full bg-[#F2F0E9] border border-[#D1D1C7] rounded-none px-3 py-2 text-xs focus:border-[#D94F2B] outline-none text-[#2A2A2A]"
                            value={plotConfig.xAxisColumn}
                            onChange={(e) => setPlotConfig(prev => ({ ...prev, xAxisColumn: e.target.value }))}
                        >
                            {allColumns.map(col => <option key={col} value={col}>{col}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-[#5D6D7E] mb-1 uppercase">Time Aggregation</label>
                        <select 
                            className="w-full bg-[#F2F0E9] border border-[#D1D1C7] rounded-none px-3 py-2 text-xs focus:border-[#D94F2B] outline-none text-[#2A2A2A]"
                            value={plotConfig.timeAggregation}
                            onChange={(e) => setPlotConfig(prev => ({ ...prev, timeAggregation: e.target.value as any }))}
                        >
                            <option value="none">Original Granularity</option>
                            <option value="15min">15 Minutes</option>
                            <option value="minute">By Minute</option>
                            <option value="hour">By Hour</option>
                            <option value="day">By Day</option>
                            <option value="week">By Week</option>
                            <option value="month">By Month</option>
                        </select>
                    </div>
                    
                    {/* Palette Selector */}
                    <div>
                        <label className="block text-[10px] font-bold text-[#5D6D7E] mb-1 uppercase">Color Palette</label>
                        <div className="grid grid-cols-3 gap-2">
                            {Object.values(PALETTES).map(palette => (
                                <button
                                    key={palette.id}
                                    onClick={() => setPlotConfig(prev => ({ ...prev, activePalette: palette.id }))}
                                    className={`h-8 rounded-sm border flex overflow-hidden transition-transform hover:scale-105 ${plotConfig.activePalette === palette.id ? 'border-[#2A2A2A] ring-1 ring-[#2A2A2A]' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                    title={palette.name}
                                >
                                    {palette.colors.slice(0, 3).map(c => (
                                        <div key={c} className="flex-1 h-full" style={{ backgroundColor: c }} />
                                    ))}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
              </div>

              {/* Series Management */}
              <div className="bg-[#F9F9F4] p-5 rounded-sm border border-[#D1D1C7] shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-[#2A2A2A] uppercase tracking-widest flex items-center gap-2">
                         <BarChart2 size={14}/> Data Series
                    </h3>
                    <button onClick={addSeries} className="text-[#D94F2B] hover:bg-[#D94F2B] hover:text-white p-1 rounded-sm transition-colors">
                        <Plus size={18} />
                    </button>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {plotConfig.series.map((series) => (
                        <div key={series.id} className="p-3 border border-[#E5E5DC] bg-[#F2F0E9] relative group transition-colors hover:border-[#D1D1C7]">
                            <button 
                                onClick={() => removeSeries(series.id)}
                                className="absolute top-2 right-2 text-[#B0B0A8] hover:text-[#D94F2B] opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={14} />
                            </button>
                            
                            <div className="space-y-3">
                                <select 
                                    className="w-full bg-white border border-[#D1D1C7] rounded-none text-xs py-1.5 px-2 font-bold text-[#2A2A2A] font-mono"
                                    value={series.columnName}
                                    onChange={(e) => updateSeries(series.id, 'columnName', e.target.value)}
                                >
                                    {allColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                
                                <div className="flex gap-2 font-mono">
                                    <select 
                                        className="flex-1 bg-white border border-[#D1D1C7] rounded-none text-[10px] py-1 px-2 text-[#2A2A2A]"
                                        value={series.chartType}
                                        onChange={(e) => updateSeries(series.id, 'chartType', e.target.value)}
                                    >
                                        <option value="line">Line</option>
                                        <option value="bar">Bar</option>
                                        <option value="area">Area</option>
                                        <option value="scatter">Scatter</option>
                                    </select>
                                     <select 
                                        className="flex-1 bg-white border border-[#D1D1C7] rounded-none text-[10px] py-1 px-2 text-[#2A2A2A]"
                                        value={series.aggregation}
                                        onChange={(e) => updateSeries(series.id, 'aggregation', e.target.value)}
                                    >
                                        <option value="mean">Avg</option>
                                        <option value="sum">Sum</option>
                                        <option value="max">Max</option>
                                        <option value="min">Min</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="relative group/picker">
                                        <div 
                                            className="w-6 h-6 cursor-pointer border border-[#D1D1C7]" 
                                            style={{ backgroundColor: series.color }}
                                        ></div>
                                        {/* Mini Palette Picker on Hover */}
                                        <div className="absolute top-full left-0 mt-1 bg-white border border-[#D1D1C7] p-1 shadow-lg grid grid-cols-4 gap-1 z-20 hidden group-hover/picker:grid w-32">
                                            {PALETTES[plotConfig.activePalette]?.colors.map(c => (
                                                <div 
                                                    key={c} 
                                                    className="w-6 h-6 cursor-pointer hover:scale-110 transition-transform" 
                                                    style={{ backgroundColor: c }}
                                                    onClick={() => updateSeries(series.id, 'color', c)}
                                                ></div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 flex items-center gap-1">
                                        <select 
                                            className="flex-1 bg-white border border-[#D1D1C7] rounded-none text-[10px] py-1.5 px-2 text-[#2A2A2A] font-mono"
                                            value={series.yAxisId}
                                            onChange={(e) => handleSeriesAxisChange(series.id, e.target.value)}
                                        >
                                            <optgroup label="Active Axes">
                                                {plotConfig.axes.map(a => (
                                                    <option key={a.id} value={a.id}>{a.label || a.id}</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Create New">
                                                <option value="NEW_LEFT">+ Left Axis</option>
                                                <option value="NEW_RIGHT">+ Right Axis</option>
                                            </optgroup>
                                        </select>
                                        <button 
                                            onClick={() => setEditingAxisId(series.yAxisId)}
                                            className="p-1.5 bg-white border border-[#D1D1C7] text-[#5D6D7E] hover:text-[#D94F2B] hover:border-[#D94F2B] transition-colors"
                                            title="Configure Axis"
                                        >
                                            <Settings size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {plotConfig.series.length === 0 && (
                         <div className="text-center py-8 border border-dashed border-[#D1D1C7] text-[#8C8C85] text-xs font-mono uppercase">
                            No signals added
                        </div>
                    )}
                </div>
              </div>

               <button 
                onClick={downloadCSV}
                disabled={processedData.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-[#2A2A2A] text-[#F2F0E9] border border-transparent py-3 px-4 rounded-sm hover:bg-[#D94F2B] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed uppercase font-bold text-sm tracking-wide"
              >
                <Download size={18} />
                Export CSV
              </button>

            </div>

            <div className="lg:col-span-3 space-y-6">
              <ChartRenderer data={processedData} config={plotConfig} />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#F9F9F4] p-4 rounded-sm border border-[#D1D1C7] shadow-sm">
                      <p className="text-[10px] text-[#8C8C85] uppercase font-bold tracking-wider mb-1">Dataset Size</p>
                      <p className="text-2xl font-bold text-[#2A2A2A] font-mono">{processedData.length}</p>
                  </div>
                   <div className="bg-[#F9F9F4] p-4 rounded-sm border border-[#D1D1C7] shadow-sm">
                      <p className="text-[10px] text-[#8C8C85] uppercase font-bold tracking-wider mb-1">Start Time</p>
                      <p className="text-xs font-medium text-[#2A2A2A] font-mono truncate">
                          {processedData.length > 0 && typeof processedData[0][plotConfig.xAxisColumn] === 'number'
                            ? new Date(processedData[0][plotConfig.xAxisColumn]).toLocaleString()
                            : '--'}
                      </p>
                  </div>
                  <div className="bg-[#F9F9F4] p-4 rounded-sm border border-[#D1D1C7] shadow-sm">
                      <p className="text-[10px] text-[#8C8C85] uppercase font-bold tracking-wider mb-1">End Time</p>
                      <p className="text-xs font-medium text-[#2A2A2A] font-mono truncate">
                         {processedData.length > 0 && typeof processedData[processedData.length-1][plotConfig.xAxisColumn] === 'number'
                            ? new Date(processedData[processedData.length-1][plotConfig.xAxisColumn]).toLocaleString()
                            : '--'}
                      </p>
                  </div>
                   <div className="bg-[#F9F9F4] p-4 rounded-sm border border-[#D1D1C7] shadow-sm">
                      <p className="text-[10px] text-[#8C8C85] uppercase font-bold tracking-wider mb-1">Active Signals</p>
                      <p className="text-2xl font-bold text-[#2A2A2A] font-mono">{plotConfig.series.length}</p>
                  </div>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {activeTab === 'visualize' && (
        <>
          <button 
            onClick={() => setShowAiModal(true)}
            className="fixed bottom-8 right-8 bg-[#2A2A2A] text-[#F2F0E9] p-4 rounded-sm shadow-[4px_4px_0px_0px_rgba(217,79,43,1)] hover:translate-y-[-2px] transition-all z-50 group border border-[#D94F2B]"
          >
            <Sparkles size={24} className="group-hover:rotate-12 transition-transform" />
          </button>

          {/* AI Modal */}
          {showAiModal && (
            <div className="fixed inset-0 bg-[#2A2A2A]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-[#F2F0E9] rounded-sm shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200 border border-[#D94F2B]">
                <div className="flex items-center justify-between p-4 border-b border-[#D1D1C7] bg-[#E5E5DC]">
                    <h3 className="font-bold text-[#2A2A2A] flex items-center gap-2 uppercase tracking-wide">
                      <Sparkles size={18} className="text-[#D94F2B]"/> AI Neural Analysis
                    </h3>
                    <button onClick={() => setShowAiModal(false)} className="text-[#8C8C85] hover:text-[#D94F2B] p-1 rounded transition-colors">
                      <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto bg-noise">
                    {!insights && !geminiLoading && (
                      <div className="text-center py-12">
                          <div className="bg-[#2A2A2A] w-16 h-16 rounded-sm flex items-center justify-center mx-auto mb-4 text-[#D94F2B] shadow-[4px_4px_0px_0px_rgba(217,79,43,0.3)]">
                            <Sparkles size={32} />
                          </div>
                          <h4 className="text-lg font-bold text-[#2A2A2A] mb-2 uppercase">Awaiting Input</h4>
                          <p className="text-[#5D6D7E] mb-6 max-w-md mx-auto font-mono text-sm">
                            Initialize neural scan to detect anomalies and trends in the current signal.
                          </p>
                          <button 
                              onClick={handleGenerateInsights}
                              disabled={processedData.length === 0}
                              className="px-6 py-3 bg-[#D94F2B] text-white font-bold uppercase tracking-wider rounded-sm hover:bg-[#C0392B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                          >
                              Start Analysis
                          </button>
                      </div>
                    )}

                    {geminiLoading && (
                      <div className="flex flex-col items-center justify-center py-12 text-[#5D6D7E]">
                          <RefreshCw className="animate-spin mb-4 text-[#D94F2B]" size={32} />
                          <p className="font-mono text-sm">Processing neural pathways...</p>
                      </div>
                    )}

                    {insights && !geminiLoading && (
                        <div className="prose prose-stone prose-sm max-w-none">
                            <div className="flex justify-between items-center mb-4 border-b border-[#D1D1C7] pb-4">
                              <span className="text-xs font-bold text-[#8C8C85] uppercase tracking-widest">Scan Results</span>
                              <button 
                                onClick={handleGenerateInsights} 
                                className="text-[#D94F2B] hover:text-[#C0392B] text-xs font-bold uppercase flex items-center gap-1"
                              >
                                <RefreshCw size={14} /> Re-Scan
                              </button>
                            </div>
                            <div className="whitespace-pre-wrap text-[#2A2A2A] font-mono text-sm leading-relaxed">
                              {insights}
                            </div>
                        </div>
                    )}
                </div>
              </div>
            </div>
          )}
          
          {/* Axis Configuration Modal */}
          {editingAxisId && (
             <div className="fixed inset-0 bg-[#2A2A2A]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
                <div className="bg-[#F9F9F4] rounded-sm shadow-xl w-full max-w-sm animate-in zoom-in-95 duration-150 p-6 border border-[#D1D1C7]">
                     <div className="flex items-center justify-between mb-6 border-b border-[#E5E5DC] pb-2">
                        <h3 className="font-bold text-[#2A2A2A] uppercase tracking-wide">Configure Axis</h3>
                        <button onClick={() => setEditingAxisId(null)} className="text-[#8C8C85] hover:text-[#D94F2B]">
                            <X size={18} />
                        </button>
                    </div>
                    
                    {getEditingAxis() ? (
                        <div className="space-y-5 font-mono">
                            <div>
                                <label className="block text-[10px] font-bold text-[#5D6D7E] mb-1 uppercase">Label</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-[#F2F0E9] border border-[#D1D1C7] rounded-none px-3 py-2 text-sm focus:border-[#D94F2B] outline-none text-[#2A2A2A]"
                                    value={getEditingAxis()!.label || getEditingAxis()!.id}
                                    onChange={(e) => updateAxis(editingAxisId, 'label', e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-[#5D6D7E] mb-1 uppercase">Min Value</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-[#F2F0E9] border border-[#D1D1C7] rounded-none px-3 py-2 text-sm focus:border-[#D94F2B] outline-none text-[#2A2A2A]"
                                        placeholder="Auto"
                                        value={getEditingAxis()!.min === 'auto' ? '' : getEditingAxis()!.min}
                                        onChange={(e) => updateAxis(editingAxisId, 'min', e.target.value === '' ? 'auto' : Number(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-[#5D6D7E] mb-1 uppercase">Max Value</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-[#F2F0E9] border border-[#D1D1C7] rounded-none px-3 py-2 text-sm focus:border-[#D94F2B] outline-none text-[#2A2A2A]"
                                        placeholder="Auto"
                                        value={getEditingAxis()!.max === 'auto' ? '' : getEditingAxis()!.max}
                                        onChange={(e) => updateAxis(editingAxisId, 'max', e.target.value === '' ? 'auto' : Number(e.target.value))}
                                    />
                                </div>
                            </div>
                             <div>
                                <label className="block text-[10px] font-bold text-[#5D6D7E] mb-1 uppercase">Orientation</label>
                                <div className="flex bg-[#E5E5DC] p-1">
                                    <button 
                                        className={`flex-1 py-1 text-xs font-bold uppercase transition-colors ${getEditingAxis()!.orientation === 'left' ? 'bg-[#2A2A2A] text-[#F2F0E9] shadow-sm' : 'text-[#6B6B63]'}`}
                                        onClick={() => updateAxis(editingAxisId, 'orientation', 'left')}
                                    >
                                        Left
                                    </button>
                                    <button 
                                        className={`flex-1 py-1 text-xs font-bold uppercase transition-colors ${getEditingAxis()!.orientation === 'right' ? 'bg-[#2A2A2A] text-[#F2F0E9] shadow-sm' : 'text-[#6B6B63]'}`}
                                        onClick={() => updateAxis(editingAxisId, 'orientation', 'right')}
                                    >
                                        Right
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-[#D94F2B] text-sm font-mono">Axis signal lost.</div>
                    )}
                    
                    <div className="mt-8 pt-4 border-t border-[#E5E5DC] text-right">
                         <button 
                            onClick={() => setEditingAxisId(null)}
                            className="bg-[#2A2A2A] text-[#F2F0E9] px-5 py-2 rounded-sm hover:bg-[#D94F2B] text-xs font-bold uppercase tracking-wide transition-colors"
                        >
                            Confirm
                         </button>
                    </div>
                </div>
             </div>
          )}

        </>
      )}
    </div>
  );
};

export default App;
