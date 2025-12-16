import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip } from 'recharts';
import { LookMetrics } from '../types';

interface Props {
  data: LookMetrics;
}

export const RadarAnalysis: React.FC<Props> = ({ data }) => {
  const chartData = [
    { subject: 'Contrasto', A: data.contrast, fullMark: 100 },
    { subject: 'Saturazione', A: data.saturation, fullMark: 100 },
    { subject: 'Calore', A: data.warmth, fullMark: 100 },
    { subject: 'Uniformità', A: data.uniformity, fullMark: 100 },
    { subject: 'Esposizione', A: data.exposure, fullMark: 100 },
  ];

  return (
    <div className="h-64 w-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid stroke="#3A3A3A" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#9CA3AF', fontSize: 10 }} 
          />
          <Radar
            name="Look Profile"
            dataKey="A"
            stroke="#D4FF00"
            strokeWidth={2}
            fill="#D4FF00"
            fillOpacity={0.3}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1E1E1E', borderColor: '#3A3A3A', color: '#fff' }}
            itemStyle={{ color: '#D4FF00' }}
          />
        </RadarChart>
      </ResponsiveContainer>
      <div className="absolute top-0 right-0 text-xs text-neon-banana font-mono">
        ANALISI AI V2.5
      </div>
    </div>
  );
};
