import React from 'react';
import { LookVersion } from '../types';
import { Icons } from './Icons';

interface Props {
  version: LookVersion;
}

export const NanoBananaStrip: React.FC<Props> = ({ version }) => {
  // Calcolo colori dinamici basati sulle metriche AI
  // Warmth influenza la tonalità, Saturation l'intensità del colore
  
  const shadowColor = `hsl(${210 + (version.metrics.warmth / 2)}, ${version.metrics.saturation * 0.5}%, ${30 + (version.metrics.contrast / 10)}%)`;
  const midColor = `hsl(${25 + (version.metrics.warmth / 5)}, ${version.metrics.saturation}%, 60%)`; // Skin-tone range
  const highlightColor = `hsl(${40 + (version.metrics.warmth / 10)}, ${version.metrics.saturation * 0.3}%, 85%)`;

  // Livelli (usiamo i valori salvati nella versione per coerenza con gli slider + metriche AI per i medi)
  const shadowLevel = version.shadows; 
  const midLevel = version.metrics.exposure; // L'esposizione generale mappa bene sui medi
  const highlightLevel = version.highlights;

  const renderBar = (label: string, level: number, color: string) => (
    <div className="flex-1 flex flex-col gap-2 h-full group/bar">
        {/* Track Container */}
        <div className="relative flex-1 w-full bg-anthracite-900 rounded border border-anthracite-700 overflow-hidden hover:border-anthracite-500 transition-colors">
            
            {/* 50% Reference Line */}
            <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/10 z-10 pointer-events-none"></div>

            {/* Fill Bar */}
            <div 
                className="absolute bottom-0 left-0 right-0 transition-all duration-500 ease-out flex items-start justify-center pt-1"
                style={{ 
                    height: `${level}%`,
                    backgroundColor: color,
                    boxShadow: `0 0 15px ${color}40`
                }}
            >
                {/* Value Label inside bar (visible if bar is tall enough) */}
                {level > 15 && (
                    <span className="text-[9px] font-bold text-black/60 mix-blend-multiply drop-shadow-sm">
                        {level}
                    </span>
                )}
            </div>
            
            {/* Fallback Value Label (if bar is too short) */}
            {level <= 15 && (
                 <span className="absolute bottom-0 w-full text-center text-[9px] font-bold text-gray-500 mb-6">
                    {level}
                </span>
            )}
        </div>
        
        {/* Label Footer */}
        <span className="text-[9px] font-bold text-gray-500 uppercase text-center tracking-wider">{label}</span>
    </div>
  );

  return (
    <div className="mt-4 p-3 bg-anthracite-800 rounded-lg border border-anthracite-600 group-hover:border-anthracite-500 transition-colors">
      
      {/* Header Info */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
               <Icons.Activity size={10} className="text-neon-banana" />
               Densitometria
            </h4>
        </div>
        <span className="text-[9px] text-gray-600 font-mono bg-anthracite-900 px-1 rounded">V.{version.id}</span>
      </div>
      
      {/* Visualizzatore a Barre Verticali */}
      <div className="flex gap-2 h-24 w-full items-end pb-1 border-b border-anthracite-700/50">
        
        {renderBar("Ombre", shadowLevel, shadowColor)}
        {renderBar("Medi", midLevel, midColor)}
        {renderBar("Luci", highlightLevel, highlightColor)}

         {/* Indicatore REF laterale (Reference Check) */}
        <div className="w-4 flex flex-col justify-end items-center gap-1 h-full pl-2 border-l border-anthracite-700 ml-1">
             <div className="relative w-1.5 h-full bg-anthracite-900 rounded-full overflow-hidden">
                 <div 
                    className="absolute bottom-0 w-full bg-neon-banana transition-all duration-500"
                    style={{ height: `${version.intensity}%` }}
                 ></div>
             </div>
             <span className="text-[8px] text-neon-banana font-bold rotate-180" style={{writingMode: 'vertical-rl'}}>INT</span>
        </div>

      </div>
      
      {/* Technical Footer */}
      <div className="flex justify-between mt-2 pt-1 text-[9px] text-gray-500 font-mono">
        <div className="flex gap-3">
            <span>SAT:<span className="text-gray-300 ml-1">{version.metrics.saturation}</span></span>
            <span>CON:<span className="text-gray-300 ml-1">{version.metrics.contrast}</span></span>
        </div>
        <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${version.metrics.warmth > 50 ? 'bg-orange-400' : 'bg-blue-400'}`}></div>
            <span className="text-gray-400">{version.metrics.warmth > 50 ? 'WARM' : 'COOL'}</span>
        </div>
      </div>
    </div>
  );
};