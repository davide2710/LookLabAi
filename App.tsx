import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import FileSaver from 'file-saver';
import { ProjectSidebar } from './components/ProjectSidebar';
import { Icons } from './components/Icons';
import { Project, LookVersion, BatchItem, LookMetrics } from './types';
import { RadarAnalysis } from './components/RadarAnalysis';
import { NanoBananaStrip } from './components/NanoBananaStrip';
import { analyzeLookMetrics, applyLookTransfer } from './services/geminiService';
import { ImageCompareModal } from './components/ImageCompareModal';

const INITIAL_PROJECTS: Project[] = [
  { id: 'p1', name: 'Campagna SS25', client: 'Vogue IT', type: 'Editorial', date: '2024-09-01' },
  { id: 'p2', name: 'Urban Run', client: 'Nike', type: 'Commercial', date: '2024-09-15' },
];

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [selectedProject, setSelectedProject] = useState<string>('p1');
  const [newProjectName, setNewProjectName] = useState("Nuovo Progetto");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'build' | 'batch' | 'compare'>('build');
  const [hasProKey, setHasProKey] = useState(false);
  
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [gradingParams, setGradingParams] = useState({
    intensity: 80, shadows: 50, highlights: 50, preset: 'Estate' as const
  });
  
  const [versions, setVersions] = useState<LookVersion[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<LookMetrics>({ contrast: 0, saturation: 0, warmth: 0, uniformity: 0, exposure: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchImages, setBatchImages] = useState<BatchItem[]>([]);
  const [selectedBatchItem, setSelectedBatchItem] = useState<BatchItem | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasProKey(hasKey);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasProKey(true);
    }
  };

  const handleError = (err: any) => {
    console.error(err);
    if (err.message === "QUOTA_EXCEEDED") {
      if (confirm("Hai esaurito la quota gratuita di Gemini.\n\nVuoi collegare una chiave API Pro (GCP con fatturazione) per continuare senza limiti?")) {
        handleOpenKeySelector();
      }
    } else if (err.message === "KEY_INVALID") {
      alert("La chiave API selezionata non è valida. Riprova la selezione.");
      handleOpenKeySelector();
    } else if (err.message === "API_KEY_MISSING") {
      alert("Chiave API mancante.");
    } else {
      alert(`Errore: ${err.message || 'Si è verificato un problema durante la generazione.'}`);
    }
  };

  const handleProjectSelect = (id: string) => {
    setSelectedProject(id);
    setIsSidebarOpen(false);
  };

  const handleNewProject = () => {
    setReferenceImage(null);
    setBatchImages([]);
    setVersions([]);
    setGradingParams({ intensity: 80, shadows: 50, highlights: 50, preset: 'Estate' });
    setCurrentMetrics({ contrast: 0, saturation: 0, warmth: 0, uniformity: 0, exposure: 0 });
    setSelectedProject('');
    setNewProjectName("Nuovo Progetto");
    setIsSidebarOpen(false);
  };

  const handleSaveProject = () => {
    if (!newProjectName.trim()) return;
    const newProj: Project = {
      id: `p-${Date.now()}`,
      name: newProjectName,
      client: 'Nuovo Cliente',
      type: 'Editorial',
      date: new Date().toISOString().split('T')[0]
    };
    setProjects(prev => [newProj, ...prev]);
    setSelectedProject(newProj.id);
  };

  const handleDeleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (selectedProject === id) setSelectedProject(projects[0]?.id || '');
  };

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const base64 = ev.target.result as string;
          setReferenceImage(base64);
          analyzeImage(base64);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files) {
         const newBatch: BatchItem[] = Array.from(e.target.files).map((f, i) => ({
             id: `b-${Date.now()}-${i}`,
             originalUrl: URL.createObjectURL(f as Blob),
             status: 'pending'
         }));
         setBatchImages(prev => [...prev, ...newBatch]);
     }
  };

  const analyzeImage = async (base64DataUrl: string) => {
    setIsProcessing(true);
    try {
      const metrics = await analyzeLookMetrics(base64DataUrl);
      setCurrentMetrics(metrics);
    } catch (err: any) {
      handleError(err);
    } finally { setIsProcessing(false); }
  };

  const generateLookVersion = async () => {
    if (!referenceImage || batchImages.length === 0) {
        alert("Carica una reference e almeno un'immagine batch.");
        return;
    }

    setIsProcessing(true);
    try {
        const target = batchImages[0];
        const targetDataUrl = await fetch(target.originalUrl)
            .then(r => r.blob())
            .then(blob => new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            }));

        const resultBase64 = await applyLookTransfer(
            referenceImage,
            targetDataUrl,
            gradingParams.intensity,
            gradingParams.preset
        );

        const newVersion: LookVersion = {
            id: `v${versions.length + 1}`,
            name: `Look ${gradingParams.preset} ${versions.length + 1}`,
            intensity: gradingParams.intensity,
            shadows: gradingParams.shadows,
            highlights: gradingParams.highlights,
            preset: gradingParams.preset,
            metrics: currentMetrics,
            previewUrl: resultBase64,
            isFavorite: false
        };

        setVersions(prev => [newVersion, ...prev]);
        setBatchImages(prev => prev.map((item, idx) => 
            idx === 0 ? { ...item, processedUrl: resultBase64, status: 'done', qualityScore: 92 } : item
        ));

    } catch (err: any) {
        handleError(err);
    } finally { setIsProcessing(false); }
  };

  const handleExportZip = async () => {
    const processedItems = batchImages.filter(item => item.processedUrl);
    if (processedItems.length === 0) {
      alert("Nessuna immagine processata da esportare.");
      return;
    }
    
    setIsProcessing(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("LookLab_Export");
      
      for (const item of processedItems) {
        if (item.processedUrl) {
          const res = await fetch(item.processedUrl);
          const blob = await res.blob();
          folder?.file(`looklab_asset_${item.id.slice(-4)}.png`, blob);
        }
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      FileSaver.saveAs(content, `LookLab_Export_${new Date().getTime()}.zip`);
    } catch (err) {
      console.error("Errore durante l'esportazione:", err);
      alert("Errore durante la creazione dello ZIP.");
    } finally {
      setIsProcessing(false);
    }
  };

  const activeProject = projects.find(p => p.id === selectedProject);

  return (
    <div className="flex h-screen bg-anthracite-900 text-gray-200 overflow-hidden">
      {selectedBatchItem && <ImageCompareModal item={selectedBatchItem} onClose={() => setSelectedBatchItem(null)} />}

      <ProjectSidebar 
        projects={projects} selectedId={selectedProject} 
        onSelect={handleProjectSelect} onNewProject={handleNewProject} 
        onDeleteProject={handleDeleteProject} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-anthracite-700 bg-anthracite-900/95 backdrop-blur flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-gray-400">
              <Icons.LayoutGrid size={20} />
            </button>
            {selectedProject ? (
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-medium text-white">{activeProject?.name}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] bg-anthracite-700 text-gray-400 border border-anthracite-600 uppercase">
                  {activeProject?.type || 'GENERIC'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input 
                  type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
                  className="bg-anthracite-800 text-white px-3 py-1.5 rounded border border-anthracite-600 focus:border-neon-banana outline-none text-sm"
                  placeholder="Nome Progetto"
                />
                <button onClick={handleSaveProject} className="bg-neon-banana text-black px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1 hover:bg-white transition-colors">
                  <Icons.Save size={14} /> Salva
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button 
                onClick={handleOpenKeySelector}
                className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded border transition-all ${
                  hasProKey 
                    ? 'border-neon-green text-neon-green bg-neon-green/10' 
                    : 'border-yellow-500/50 text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20'
                }`}
            >
               <Icons.Zap size={14} />
               <span>{hasProKey ? 'QUOTA PRO ATTIVA' : 'SBLOCCA QUOTA PRO'}</span>
            </button>
            <button 
              onClick={handleExportZip}
              className="bg-white text-anthracite-900 px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 hover:bg-neon-banana transition-colors disabled:opacity-50"
              disabled={isProcessing || batchImages.filter(i => i.processedUrl).length === 0}
            >
              <Icons.Download size={16} /> <span className="hidden sm:inline">Export ZIP</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto flex flex-col lg:flex-row">
            <div className="w-full lg:w-96 bg-anthracite-800 p-6 border-r border-anthracite-700 overflow-y-auto">
                <div className="mb-8">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex justify-between">Reference Look</h3>
                    <div onClick={() => fileInputRef.current?.click()} className={`relative aspect-video rounded-lg border-2 border-dashed transition-all cursor-pointer overflow-hidden group ${referenceImage ? 'border-neon-banana' : 'border-anthracite-600 hover:border-gray-400'}`}>
                        {referenceImage ? <img src={referenceImage} alt="Ref" className="w-full h-full object-cover" /> : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                <Icons.Image size={32} className="mb-2" />
                                <span className="text-xs">Trascina Reference</span>
                            </div>
                        )}
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleReferenceUpload} accept="image/*" />
                </div>

                <div className="space-y-6 mb-8">
                    <div>
                        <label className="text-xs text-gray-400 uppercase mb-2 block">Preset Look</label>
                        <select value={gradingParams.preset} onChange={(e) => setGradingParams({...gradingParams, preset: e.target.value as any})} className="w-full bg-anthracite-900 border border-anthracite-600 text-white rounded p-2 text-sm focus:border-neon-banana outline-none">
                            <option value="Estate">Estate (Summer)</option>
                            <option value="Dark">Dark / Moody</option>
                            <option value="Corporate">Corporate Clean</option>
                            <option value="Analog">Analog Film</option>
                        </select>
                    </div>
                    <div>
                        <div className="flex justify-between mb-2"><label className="text-xs text-gray-400 uppercase">Intensità</label><span className="text-xs text-neon-banana font-mono">{gradingParams.intensity}%</span></div>
                        <input type="range" min="0" max="100" value={gradingParams.intensity} onChange={(e) => setGradingParams({...gradingParams, intensity: parseInt(e.target.value)})} className="w-full h-1 bg-anthracite-600 rounded-lg appearance-none cursor-pointer accent-neon-banana" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-[10px] text-gray-400 uppercase mb-2 block">Alte Luci</label>
                            <input type="range" min="0" max="100" value={gradingParams.highlights} onChange={(e) => setGradingParams({...gradingParams, highlights: parseInt(e.target.value)})} className="w-full h-1 bg-anthracite-600 rounded-lg appearance-none cursor-pointer accent-white" />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-400 uppercase mb-2 block">Ombre</label>
                            <input type="range" min="0" max="100" value={gradingParams.shadows} onChange={(e) => setGradingParams({...gradingParams, shadows: parseInt(e.target.value)})} className="w-full h-1 bg-anthracite-600 rounded-lg appearance-none cursor-pointer accent-gray-400" />
                        </div>
                    </div>
                </div>

                <button onClick={generateLookVersion} disabled={isProcessing} className="w-full bg-neon-banana text-anthracite-900 font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:bg-white transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(212,255,0,0.2)]">
                    {isProcessing ? <><Icons.Activity className="animate-spin" size={20} /> GENERANDO...</> : <><Icons.Zap size={20} /> GENERA LOOK</>}
                </button>

                <div className="mt-8 pt-8 border-t border-anthracite-700">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Analisi Spettrale</h3>
                    <RadarAnalysis data={currentMetrics} />
                </div>
            </div>

            <div className="flex-1 bg-anthracite-900 p-6 flex flex-col">
                {batchImages.length === 0 ? (
                     <div onClick={() => batchInputRef.current?.click()} className="flex-1 border-2 border-dashed border-anthracite-700 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:border-neon-banana transition-colors cursor-pointer">
                        <Icons.FolderOpen size={48} className="mb-4" />
                        <h3 className="text-xl font-medium mb-1">Carica Batch</h3>
                        <p className="text-xs opacity-60">RAW / JPG</p>
                        <input type="file" ref={batchInputRef} multiple className="hidden" onChange={handleBatchUpload} accept="image/*" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                             <div className="flex gap-4">
                                <button onClick={() => setActiveTab('build')} className={`text-sm font-medium pb-1 border-b-2 ${activeTab === 'build' ? 'text-white border-neon-banana' : 'text-gray-500 border-transparent'}`}>Griglia</button>
                                <button onClick={() => setActiveTab('compare')} className={`text-sm font-medium pb-1 border-b-2 ${activeTab === 'compare' ? 'text-white border-neon-banana' : 'text-gray-500 border-transparent'}`}>A/B</button>
                             </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                            {batchImages.map((img) => (
                                <div key={img.id} onClick={() => setSelectedBatchItem(img)} className="group bg-anthracite-800 rounded-lg overflow-hidden border border-anthracite-700 hover:border-neon-banana transition-all cursor-pointer shadow-lg">
                                    <div className="aspect-[4/5] relative">
                                        <img src={img.processedUrl || img.originalUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="Item" />
                                        {img.status === 'done' && (
                                            <div className="absolute top-3 left-3 bg-black/80 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-neon-green border border-neon-green/30 flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-neon-green"></div>
                                                {img.qualityScore}% MATCH
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3 border-t border-anthracite-700 flex justify-between items-center text-xs text-gray-500 font-mono">
                                        <span>ASSET_{img.id.slice(-4)}</span>
                                        <Icons.Eye size={14} className="group-hover:text-neon-banana transition-colors" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </main>

        {versions.length > 0 && (
            <div className="h-28 bg-anthracite-800 border-t border-anthracite-700 flex items-center px-6 gap-6 overflow-x-auto z-30 shadow-2xl">
                {versions.map((v) => (
                    <div key={v.id} className="relative flex-shrink-0 w-52 bg-anthracite-900 rounded border border-anthracite-600 p-2 hover:border-neon-banana cursor-pointer transition-colors group">
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-[10px] font-bold text-white truncate">{v.name}</span>
                            <span className="text-[9px] text-neon-banana font-mono">{v.preset}</span>
                        </div>
                        <NanoBananaStrip version={v} />
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default App;