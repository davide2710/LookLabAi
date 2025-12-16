import React from 'react';
import { Project } from '../types';
import { Icons } from './Icons';

interface Props {
  projects: Project[];
  selectedId: string;
  onSelect: (id: string) => void;
  onNewProject: () => void;
  onDeleteProject: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectSidebar: React.FC<Props> = ({ 
  projects, 
  selectedId, 
  onSelect, 
  onNewProject, 
  onDeleteProject,
  isOpen, 
  onClose 
}) => {
  return (
    <div 
      className={`fixed inset-y-0 left-0 z-50 w-72 bg-anthracite-800 border-r border-anthracite-600 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:relative lg:translate-x-0`}
    >
      <div className="p-6 flex flex-col h-full">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-3 h-3 bg-neon-banana rounded-full"></span>
            LOOKLAB
          </h1>
          <button onClick={onClose} className="lg:hidden text-gray-400">
            <Icons.ChevronRight className="rotate-180" />
          </button>
        </div>

        <div className="mb-6">
          <button 
            onClick={onNewProject}
            className="w-full bg-neon-banana text-anthracite-900 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-white transition-colors"
          >
            <Icons.Plus size={18} />
            Nuovo Progetto
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">Progetti Attivi</h3>
          {projects.length === 0 && (
            <p className="px-2 text-xs text-gray-600 italic">Nessun progetto salvato.</p>
          )}
          {projects.map((p) => (
            <div
              key={p.id}
              className={`relative group w-full rounded-md transition-all flex items-center ${
                selectedId === p.id 
                  ? 'bg-anthracite-700 border-l-2 border-neon-banana' 
                  : 'hover:bg-anthracite-700'
              }`}
            >
              <button
                onClick={() => onSelect(p.id)}
                className={`flex-1 text-left p-3 ${
                   selectedId === p.id ? 'text-neon-banana' : 'text-gray-400 group-hover:text-white'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium truncate pr-2">{p.name}</span>
                  {selectedId === p.id && <Icons.Activity size={14} />}
                </div>
                <div className="flex justify-between text-xs opacity-70">
                  <span>{p.client}</span>
                  <span>{p.type}</span>
                </div>
              </button>
              
              {/* Delete Button - Visible on Hover */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if(window.confirm('Eliminare questo progetto?')) {
                    onDeleteProject(p.id);
                  }
                }}
                className="absolute right-2 p-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Elimina Progetto"
              >
                <Icons.Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-anthracite-600 mt-4">
            <div className="flex items-center gap-3 text-sm text-gray-400">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-neon-banana flex items-center justify-center text-anthracite-900 font-bold">
                    JS
                </div>
                <div>
                    <p className="text-white">John Studio</p>
                    <p className="text-xs">Piano Pro</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};