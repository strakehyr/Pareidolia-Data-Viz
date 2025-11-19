
import React from 'react';
import {
  ComposedChart,
  Line,
  Area,
  Bar,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush
} from 'recharts';
import { DataPoint, PlotConfig } from '../types';
import { format } from 'date-fns';

interface Props {
  data: DataPoint[];
  config: PlotConfig;
}

// Externalized Tooltip to prevent re-creation on every render (Crucial for #185 error)
const CustomTooltip = React.memo(({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        let labelStr = label;
        if (typeof label === 'number' && label > 1000000000) {
            try {
                labelStr = format(new Date(label), 'PPP HH:mm');
            } catch (e) { /* ignore */ }
        }

      return (
        <div className="bg-[#F2F0E9]/95 backdrop-blur-sm p-3 border border-[#2A2A2A] shadow-[4px_4px_0px_0px_rgba(42,42,42,1)] rounded-sm z-50">
          <p className="text-xs font-bold text-[#2A2A2A] uppercase tracking-wider mb-2 border-b border-[#D1D1C7] pb-1">{labelStr}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs font-mono">
              <span className="w-2 h-2 rounded-none" style={{ backgroundColor: entry.color }}></span>
              <span className="font-semibold text-[#555]">{entry.name}:</span>
              <span className="font-bold text-[#2A2A2A]">
                  {typeof entry.value === 'number' ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
});

const ChartRenderer: React.FC<Props> = ({ data, config }) => {
  // Default fallback if something goes wrong
  const fallbackColors = ['#2A2A2A'];

  if (!config.xAxisColumn || config.series.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center bg-[#F9F9F4] rounded border border-[#D1D1C7] text-[#8C8C85] italic font-mono">
        // NO DATA SIGNAL DETECTED
      </div>
    );
  }

  const formatXAxis = (tickItem: any) => {
    if (typeof tickItem === 'number' && tickItem > 1000000000) {
      try {
        return format(new Date(tickItem), 'MMM dd HH:mm');
      } catch (e) {
        return tickItem;
      }
    }
    return tickItem;
  };

  // Create dynamic Y Axes configuration
  const axesToRender = config.axes && config.axes.length > 0 ? config.axes : [
      { id: 'left', orientation: 'left' },
      { id: 'right', orientation: 'right' }
  ];

  return (
    <div className="w-full h-[500px] bg-[#F9F9F4] p-4 rounded-sm shadow-sm border border-[#D1D1C7]">
      {/* debounce ensures resize events don't trigger infinite update loops */}
      <ResponsiveContainer width="100%" height="100%" debounce={50}>
        <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                <feComponentTransfer in="coloredBlur" result="glowColored">
                    <feFuncA type="linear" slope="0.6"/>
                </feComponentTransfer>
                <feMerge>
                    <feMergeNode in="glowColored"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5DC" vertical={false} />
          
          <XAxis 
            dataKey={config.xAxisColumn} 
            tickFormatter={formatXAxis} 
            stroke="#6B6B63"
            tick={{ fontSize: 10, fontFamily: 'monospace' }}
            minTickGap={40}
            type="number"
            domain={['dataMin', 'dataMax']}
            allowDataOverflow={false}
            tickMargin={10}
          />
          
          {axesToRender.map((axis) => (
              <YAxis 
                key={axis.id}
                yAxisId={axis.id}
                orientation={axis.orientation}
                stroke="#6B6B63"
                tick={{ fontSize: 10, fontFamily: 'monospace' }}
                width={60} 
                tickMargin={8}
                domain={[
                    axis.min === 'auto' || axis.min === undefined ? 'auto' : axis.min,
                    axis.max === 'auto' || axis.max === undefined ? 'auto' : axis.max
                ]}
                allowDataOverflow={true}
                label={axis.label ? { 
                    value: axis.label, 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { fill: '#2A2A2A', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' },
                    dx: axis.orientation === 'left' ? 10 : -10
                } : undefined}
              />
          ))}

          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#D94F2B', strokeWidth: 1, strokeDasharray: '4 4' }} isAnimationActive={false} />
          <Legend 
            wrapperStyle={{ paddingTop: '15px', fontFamily: 'Space Grotesk', fontSize: '12px' }} 
            iconType="rect"
          />

          {config.series.map((series, index) => {
            const color = series.color || fallbackColors[0];
            const axisId = series.yAxisId || axesToRender[0].id;

            // DISABLED ANIMATIONS to prevent crash #185 during Zoom/Brush operations
            const commonProps = {
                key: series.id,
                dataKey: series.columnName,
                yAxisId: axisId,
                name: series.columnName,
                isAnimationActive: false, // Critical fix
                style: { filter: 'url(#glow)' }
            };

            switch (series.chartType) {
              case 'area':
                return (
                  <Area
                    {...commonProps}
                    type="monotone"
                    fill={color}
                    stroke={color}
                    fillOpacity={0.2}
                  />
                );
              case 'bar':
                return (
                  <Bar
                    {...commonProps}
                    fill={color}
                    radius={[2, 2, 0, 0]}
                  />
                );
              case 'scatter':
                return (
                  <Scatter
                    {...commonProps}
                    fill={color}
                  />
                );
              case 'line':
              default:
                return (
                  <Line
                    {...commonProps}
                    type="monotone"
                    stroke={color}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#2A2A2A', stroke: '#F2F0E9' }}
                  />
                );
            }
          })}
           <Brush 
                height={25} 
                stroke="#B0B0A8" 
                fill="#F2F0E9"
                tickFormatter={() => ''}
                alwaysShowText={false}
                travellerWidth={10}
            />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ChartRenderer;
