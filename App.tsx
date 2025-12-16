import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import FileSaver from 'file-saver';
import { ProjectSidebar } from './components/ProjectSidebar';
import { Icons } from './components/Icons';
import { Project, LookVersion, BatchItem, LookMetrics } from './types';
import { RadarAnalysis } from './components/RadarAnalysis';
import { NanoBananaStrip } from './components/NanoBananaStrip';
import { analyzeLookMetrics, applyLookTransfer } from './services/geminiService';
import { ImageCompareModal } from './components/ImageCompareModal';

// Initial Mock Data
const INITIAL_PROJECTS: Project[] = [
  { id: 'p1', name: 'Campagna SS25', client: 'Vogue IT', type: 'Editorial', date: '2024-09-01' },
  { id: 'p2', name: 'Urban Run', client: 'Nike', type: 'Commercial', date: '2024-09-15' },
  { id: 'p3', name: 'Serie Food', client: 'Barilla', type: 'Social', date: '2024-10-01' },
];

const App: React.FC = () => {
  // Projects State
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [selectedProject, setSelectedProject] = useState<string>('p1');
  const [newProjectName, setNewProjectName] = useState("Nuovo Progetto");
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'build' | 'batch' | 'compare'>('build');
  
  // Grading State
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [gradingParams, setGradingParams] = useState({
    intensity: 80,
    shadows: 50,
    highlights: 50,
    preset: 'Estate' as const
  });
  
  // Versions & Results
  const [versions, setVersions] = useState<LookVersion[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<LookMetrics>({ contrast: 0, saturation: 0, warmth: 0, uniformity: 0, exposure: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Batch
  const [batchImages, setBatchImages] = useState<BatchItem[]>([]);
  const [selectedBatchItem, setSelectedBatchItem] = useState<BatchItem | null>(null);
  
  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  const handleProjectSelect = (id: string) => {
    setSelectedProject(id);
    setIsSidebarOpen(false);
  };

  const handleNewProject = () => {
    // Reset State
    setReferenceImage(null);
    setBatchImages([]);
    setVersions([]);
    setGradingParams({
      intensity: 80,
      shadows: 50,
      highlights: 50,
      preset: 'Estate'
    });
    setCurrentMetrics({ contrast: 0, saturation: 0, warmth: 0, uniformity: 0, exposure: 0 });
    
    // Set ID to empty to indicate creation mode
    setSelectedProject('');
    setNewProjectName("Nuovo Progetto");
    setIsSidebarOpen(false);

    // Clear input values
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (batchInputRef.current) batchInputRef.current.value = '';
  };

  const handleSaveProject = () => {
    if (!newProjectName.trim()) {
      alert("Inserisci un nome valido per il progetto");
      return;
    }

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
    if (selectedProject === id) {
      // If we deleted the active project, select the first one or go to new mode
      if (projects.length > 1) {
        setSelectedProject(projects.find(p => p.id !== id)?.id || '');
      } else {
        setSelectedProject('');
      }
    }
  };

  const handleSaveMaster = () => {
      if (!referenceImage) {
          alert("Nessuna immagine reference caricata da salvare.");
          return;
      }
      const link = document.createElement('a');
      link.href = referenceImage;
      link.download = `LookLab_Master_${new Date().toISOString().slice(0,10)}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleExportZip = async () => {
      if (batchImages.length === 0) {
          alert("Nessuna immagine da esportare.");
          return;
      }
      
      const processedImages = batchImages.filter(img => img.status === 'done' && img.processedUrl);
      
      if (processedImages.length === 0) {
          alert("Nessuna immagine è stata ancora processata.");
          return;
      }

      setIsProcessing(true);
      try {
          const zip = new JSZip();
          const currentProj = projects.find(p => p.id === selectedProject);
          const projectName = currentProj ? currentProj.name : newProjectName;
          const folder = zip.folder(projectName.replace(/\s+/g, '_'));

          // Add Reference if exists
          if (referenceImage && folder) {
              folder.file("Master_Reference.jpg", referenceImage.split(',')[1], {base64: true});
          }

          // Add Processed Images
          processedImages.forEach((img, index) => {
              if (img.processedUrl && folder) {
                  folder.file(`Batch_${index + 1}_Look.png`, img.processedUrl.split(',')[1], {base64: true});
              }
          });

          const content = await zip.generateAsync({type:"blob"});
          FileSaver.saveAs(content, `${projectName}_Export.zip`);

      } catch (error) {
          console.error("Errore export ZIP:", error);
          alert("Errore durante la creazione dello ZIP.");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const base64 = ev.target.result as string;
          setReferenceImage(base64);
          analyzeImage(base64); // Send full Data URL
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
      console.error(err);
      if (err.message === "API_KEY_MISSING") {
        alert("ERRORE API KEY: La chiave API non è stata trovata.\n\nAssicurati di aver creato un file .env locale con API_KEY=... e di aver rieseguito 'npm run deploy'.");
      } else {
        // Fallback silently for visual demo if AI fails
         setCurrentMetrics({ contrast: 50, saturation: 50, warmth: 50, uniformity: 50, exposure: 50 });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const restoreVersion = (v: LookVersion) => {
    // 1. Restore UI Parameters
    setGradingParams({
        intensity: v.intensity,
        shadows: v.shadows,
        highlights: v.highlights,
        preset: v.preset as any
    });

    // 2. Restore Metrics (Radar Chart)
    setCurrentMetrics(v.metrics);

    // 3. Restore Image in Batch View (Preview)
    if (batchImages.length > 0 && v.previewUrl) {
         setBatchImages(prev => prev.map((item, idx) => 
            idx === 0 ? { ...item, processedUrl: v.previewUrl, qualityScore: 92, status: 'done' as const } : item
        ));
    }
  };

  const generateLookVersion = async () => {
    if (!referenceImage || batchImages.length === 0) {
        alert("Carica una reference e almeno un'immagine batch.");
        return;
    }

    setIsProcessing(true);
    try {
        // For demo: Apply look to the FIRST batch image only to save tokens/time
        // In real app, this would queue a job
        const target = batchImages[0];
        const targetDataUrl = await fetch(target.originalUrl)
            .then(r => r.blob())
            .then(blob => new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            }));

        const resultBase64 = await applyLookTransfer(
            referenceImage, // Pass full Data URL
            targetDataUrl,  // Pass full Data URL
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
        
        // Update the batch item locally
        setBatchImages(prev => prev.map((item, idx) => 
            idx === 0 ? { ...item, processedUrl: resultBase64, status: 'done', qualityScore: 92 } : item
        ));

    } catch (err: any) {
        console.error("Generation failed", err);
        const msg = err.message || 'Errore sconosciuto';
        
        if (msg === "API_KEY_MISSING") {
            alert("ERRORE API KEY: Chiave mancante. Verifica il file .env.");
        } else if (msg.includes("safety") || msg.includes("blocked")) {
            alert("L'immagine è stata bloccata dai filtri di sicurezza dell'AI. Prova con un'immagine diversa.");
        } else {
            alert(`Errore generazione look: ${msg}`);
        }
    } finally {
        setIsProcessing(false);
    }
  };

  // Find currently selected project object
  const activeProject = projects.find(p => p.id === selectedProject);

  return (
    <div className="flex h-screen bg-anthracite-900 text-gray-200 overflow-hidden">
      
      {/* Modal Layer */}
      {selectedBatchItem && (
        <ImageCompareModal 
          item={selectedBatchItem} 
          onClose={() => setSelectedBatchItem(null)} 
        />
      )}

      <ProjectSidebar 
        projects={projects} 
        selectedId={selectedProject} 
        onSelect={handleProjectSelect}
        onNewProject={handleNewProject}
        onDeleteProject={handleDeleteProject}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header */}
        <header className="h-16 border-b border-anthracite-700 bg-anthracite-900/95 backdrop-blur flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-gray-400">
              <Icons.LayoutGrid size={20} />
            </button>
            
            {selectedProject ? (
              // Display Mode
              <>
                <h2 className="text-lg font-medium text-white">
                  {activeProject?.name}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] bg-anthracite-700 text-gray-400 border border-anthracite-600">
                  {activeProject?.type || 'GENERIC'}
                </span>
              </>
            ) : (
              // Edit/New Project Mode
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="bg-anthracite-800 text-white px-3 py-1.5 rounded border border-anthracite-600 focus:border-neon-banana outline-none"
                  placeholder="Nome Progetto"
                />
                <button 
                  onClick={handleSaveProject}
                  className="bg-neon-banana text-black px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1 hover:bg-white transition-colors"
                >
                  <Icons.Save size={14} /> Salva
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <button 
                onClick={handleSaveMaster}
                className="flex items-center gap-2 text-sm text-neon-banana hover:text-white transition-colors"
            >
               <Icons.Save size={16} />
               <span className="hidden md:inline">Salva Master</span>
            </button>
            <button 
                onClick={handleExportZip}
                className="bg-white text-anthracite-900 px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 hover:bg-neon-banana transition-colors"
            >
              <Icons.Download size={16} />
              Export ZIP
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto flex flex-col lg:flex-row">
            
            {/* Left Panel: Controls & Input */}
            <div className="w-full lg:w-96 bg-anthracite-800 p-6 border-r border-anthracite-700 overflow-y-auto">
                
                {/* Reference Upload */}
                <div className="mb-8">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex justify-between">
                        Reference Look
                        {referenceImage && <span className="text-neon-green flex items-center gap-1"><Icons.CheckCircle size={10}/> Caricata</span>}
                    </h3>
                    
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative aspect-video rounded-lg border-2 border-dashed transition-all cursor-pointer overflow-hidden group ${referenceImage ? 'border-neon-banana' : 'border-anthracite-600 hover:border-gray-400'}`}
                    >
                        {referenceImage ? (
                            <img src={referenceImage} alt="Ref" className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                <Icons.Image size={32} className="mb-2" />
                                <span className="text-sm">Trascina Reference RAW/JPG</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-xs font-bold">CAMBIA REF</span>
                        </div>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleReferenceUpload} accept="image/*" />
                </div>

                {/* Grading Controls */}
                <div className="space-y-6 mb-8">
                    <div>
                        <label className="text-sm text-gray-300 mb-2 block">Preset Look</label>
                        <select 
                            value={gradingParams.preset}
                            onChange={(e) => setGradingParams({...gradingParams, preset: e.target.value as any})}
                            className="w-full bg-anthracite-900 border border-anthracite-600 text-white rounded p-2 text-sm focus:border-neon-banana outline-none"
                        >
                            <option value="Estate">Estate (Summer)</option>
                            <option value="Dark">Dark / Moody</option>
                            <option value="Corporate">Corporate Clean</option>
                            <option value="Analog">Analog Film</option>
                        </select>
                    </div>

                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-xs text-gray-400 uppercase">Intensità</label>
                            <span className="text-xs text-neon-banana font-mono">{gradingParams.intensity}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" max="100" 
                            value={gradingParams.intensity} 
                            onChange={(e) => setGradingParams({...gradingParams, intensity: parseInt(e.target.value)})}
                            className="w-full h-1 bg-anthracite-600 rounded-lg appearance-none cursor-pointer accent-neon-banana" 
                        />
                    </div>
                    
                    {/* Simplified Curves */}
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-xs text-gray-400 uppercase mb-2 block">Alte Luci</label>
                            <input 
                                type="range" 
                                min="0" max="100" 
                                value={gradingParams.highlights}
                                onChange={(e) => setGradingParams({...gradingParams, highlights: parseInt(e.target.value)})}
                                className="w-full h-1 bg-anthracite-600 rounded-lg appearance-none cursor-pointer accent-white" 
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 uppercase mb-2 block">Ombre</label>
                            <input 
                                type="range" 
                                min="0" max="100" 
                                value={gradingParams.shadows}
                                onChange={(e) => setGradingParams({...gradingParams, shadows: parseInt(e.target.value)})}
                                className="w-full h-1 bg-anthracite-600 rounded-lg appearance-none cursor-pointer accent-gray-500" 
                            />
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <button 
                    onClick={generateLookVersion}
                    disabled={isProcessing}
                    className="w-full bg-neon-banana text-anthracite-900 font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(212,255,0,0.2)]"
                >
                    {isProcessing ? (
                        <>
                            <Icons.Activity className="animate-spin" size={20} />
                            GENERANDO...
                        </>
                    ) : (
                        <>
                            <Icons.Zap size={20} />
                            GENERA LOOK
                        </>
                    )}
                </button>

                {/* Radar */}
                <div className="mt-8 pt-8 border-t border-anthracite-700">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Analisi Spettrale</h3>
                    <RadarAnalysis data={currentMetrics} />
                </div>
            </div>

            {/* Right Panel: Workspace */}
            <div className="flex-1 bg-anthracite-900 p-6 flex flex-col relative">
                
                {/* Batch Upload Area (if empty) or Grid */}
                {batchImages.length === 0 ? (
                     <div 
                        onClick={() => batchInputRef.current?.click()}
                        className="flex-1 border-2 border-dashed border-anthracite-700 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:border-neon-banana hover:text-neon-banana transition-colors cursor-pointer"
                    >
                        <Icons.FolderOpen size={48} className="mb-4" />
                        <h3 className="text-xl font-medium mb-2">Carica Batch</h3>
                        <p className="text-sm opacity-60">Trascina cartella o file RAW/JPG qui</p>
                        <input type="file" ref={batchInputRef} multiple className="hidden" onChange={handleBatchUpload} accept="image/*" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                             <div className="flex gap-4">
                                <button onClick={() => setActiveTab('build')} className={`text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab === 'build' ? 'text-white border-neon-banana' : 'text-gray-500 border-transparent'}`}>Griglia</button>
                                <button onClick={() => setActiveTab('compare')} className={`text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab === 'compare' ? 'text-white border-neon-banana' : 'text-gray-500 border-transparent'}`}>Confronto A/B</button>
                             </div>
                             <span className="text-xs text-gray-500 font-mono">{batchImages.length} ASSETS • {versions.length} VERSIONI</span>
                        </div>

                        {/* Images Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {batchImages.map((img, idx) => (
                                <div 
                                    key={img.id} 
                                    onClick={() => setSelectedBatchItem(img)}
                                    className="group relative bg-anthracite-800 rounded-lg overflow-hidden border border-anthracite-700 hover:border-neon-banana transition-all cursor-pointer shadow-lg hover:shadow-xl hover:shadow-neon-banana/10"
                                >
                                    {/* Status Indicator */}
                                    <div className="absolute top-3 left-3 z-10 flex gap-2 pointer-events-none">
                                        {img.status === 'done' && (
                                            <div className="bg-black/80 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-neon-green border border-neon-green/30 flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-neon-green"></div>
                                                {img.qualityScore}% MATCH
                                            </div>
                                        )}
                                    </div>

                                    {/* Image Display */}
                                    <div className="aspect-[4/5] relative">
                                        <img 
                                            src={img.processedUrl || img.originalUrl} 
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            alt="Batch item" 
                                        />
                                        
                                        {/* Hover Overlay hint */}
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <div className="bg-black/80 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 backdrop-blur">
                                                <Icons.Eye size={12} />
                                                {img.processedUrl ? 'CONFRONTA' : 'VEDI'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Look Info Footer */}
                                    <div className="p-3 border-t border-anthracite-700 bg-anthracite-800 flex justify-between items-center group-hover:bg-anthracite-700 transition-colors">
                                        <div className="text-xs text-gray-400 font-mono">IMG_{1000 + idx}.CR3</div>
                                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                            <button className="text-gray-500 hover:text-white transition-colors"><Icons.Heart size={14}/></button>
                                            <button className="text-gray-500 hover:text-white transition-colors"><Icons.Share2 size={14}/></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </main>

        {/* Sticky Bottom Bar (Versions) */}
        {versions.length > 0 && (
            <div className="h-24 bg-anthracite-800 border-t border-anthracite-700 flex items-center px-6 gap-6 overflow-x-auto z-30 shadow-2xl">
                <div className="text-xs font-bold text-gray-500 uppercase w-16 flex-shrink-0">
                    Versioni Recenti
                </div>
                {versions.map((v) => (
                    <div 
                        key={v.id} 
                        onClick={() => restoreVersion(v)}
                        className="relative flex-shrink-0 w-48 bg-anthracite-900 rounded border border-anthracite-600 p-2 hover:border-neon-banana cursor-pointer transition-colors group"
                    >
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-white truncate">{v.name}</span>
                            <span className="text-[10px] text-neon-banana">{v.preset}</span>
                        </div>
                        <div className="flex gap-1 h-1 w-full bg-anthracite-700 rounded-full overflow-hidden mb-2">
                            <div style={{width: `${v.intensity}%`}} className="bg-gray-400"></div>
                        </div>
                        <div className="flex justify-between items-end">
                            <NanoBananaStrip version={v} />
                        </div>
                         {/* Selection Overlay */}
                        <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <div className="bg-neon-banana text-anthracite-900 rounded-full p-1">
                                 <Icons.CheckCircle size={12} />
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default App;