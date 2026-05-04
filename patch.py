import re

with open('frontend/src/components/MapComponent.tsx', 'r') as f:
    content = f.read()

# Replace lucide-react imports
content = re.sub(
    r"import {([^}]+)} from 'lucide-react';",
    lambda m: f"import {{{m.group(1).replace('Database, ', '').replace('Plus, ', '').replace('Trash2, ', '')}, Database, Plus, Trash2}} from 'lucide-react';",
    content
)

# Find where EditAssetModal starts
idx = content.find("function EditAssetModal({ data, enrichedData, onSave, onClose }:")

if idx != -1:
    content = content[:idx] + """function EditAssetModal({ data, enrichedData, onSave, onClose }: { data: any, enrichedData: any, onSave: (updates: any) => void, onClose: () => void }) {
  const initialTags = useMemo(() => {
    const skip = ['id', '@id', 'osm_id'];
    const t: {key: string, value: string}[] = [];
    
    // Base OSM tags from geometry data
    for (const [k, v] of Object.entries(data)) {
      if (!skip.includes(k) && typeof v === 'string' && v.trim() !== '') {
        t.push({ key: k, value: v });
      } else if (typeof v === 'number') {
        t.push({ key: k, value: String(v) });
      }
    }

    // Include some useful data from enriched address if missing
    if (enrichedData?.address) {
      if (!t.find(x => x.key === 'addr:city') && enrichedData.address.city) t.push({ key: 'addr:city', value: enrichedData.address.city });
      if (!t.find(x => x.key === 'addr:postcode') && enrichedData.address.postcode) t.push({ key: 'addr:postcode', value: enrichedData.address.postcode });
      if (!t.find(x => x.key === 'addr:street') && enrichedData.address.road) t.push({ key: 'addr:street', value: enrichedData.address.road });
    }

    return t.sort((a, b) => a.key.localeCompare(b.key));
  }, [data, enrichedData]);

  const [tags, setTags] = useState<{key: string, value: string}[]>(initialTags);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSync = async () => {
    console.log("Starting Hi-Fi Mesh Bake for asset:", data['@id'] || data.osm_id || data.id);
    try {
      setIsSaving(true);
      const updates: any = {};
      
      // Update all tags
      tags.forEach(t => {
        if (t.key.trim()) {
          updates[t.key.trim()] = t.value.trim();
        }
      });
      
      // Mark removed tags as empty string so backend deletes them
      initialTags.forEach(t => {
        if (!tags.find(nt => nt.key === t.key)) {
          updates[t.key] = "";
        }
      });

      await onSave(updates);
    } catch (err: any) {
      console.error("Sync Error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const copyOSMTags = () => {
    const lines = tags
      .filter(t => t.key.trim() && t.value.trim())
      .map(t => `${t.key.trim()}=${t.value.trim()}`)
      .join('\\n');
    navigator.clipboard.writeText(lines);
    alert('Full OSM Tag-Set copied to clipboard!');
  };

  const updateTag = (index: number, field: 'key' | 'value', val: string) => {
    const newTags = [...tags];
    newTags[index][field] = val;
    setTags(newTags);
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (newKey.trim()) {
      if (tags.find(t => t.key === newKey.trim())) {
        alert('Tag already exists! Edit it below instead.');
        return;
      }
      setTags([{ key: newKey.trim(), value: newVal.trim() }, ...tags]);
      setNewKey('');
      setNewVal('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300 p-4">
      <div className="glass-panel border border-neon-blue/30 w-full max-w-2xl rounded-3xl shadow-[0_0_100px_rgba(0,210,255,0.15)] animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-white/5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-neon-blue/20 flex items-center justify-center text-neon-blue border border-neon-blue/50 shadow-[0_0_15px_rgba(0,210,255,0.4)]">
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tighter uppercase">Entity Tag Editor</h2>
              <div className="text-xs text-neon-blue font-bold uppercase tracking-widest">{data['@id'] || data.osm_id || data.id || 'N/A'}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors bg-white/5 p-2 rounded-xl">
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <div className="space-y-4">
            {/* New Tag Input */}
            <div className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10 focus-within:border-neon-blue/50 transition-all">
              <input 
                type="text" 
                placeholder="Key (e.g. building:colour)" 
                value={newKey} 
                onChange={e => setNewKey(e.target.value)}
                className="flex-1 bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white text-sm font-bold outline-none font-mono"
              />
              <input 
                type="text" 
                placeholder="Value (e.g. #ff0000)" 
                value={newVal} 
                onChange={e => setNewVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                className="flex-[1.5] bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white text-sm font-bold outline-none"
              />
              <button 
                onClick={addTag}
                disabled={!newKey.trim()}
                className="p-3 rounded-xl bg-neon-blue text-slate-950 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={20} />
              </button>
            </div>

            {/* Tag List */}
            <div className="space-y-2 pt-2">
              <div className="flex px-4 pb-2">
                <div className="flex-1 text-[10px] text-slate-500 font-black uppercase tracking-widest">Key</div>
                <div className="flex-[1.5] text-[10px] text-slate-500 font-black uppercase tracking-widest ml-12">Value</div>
              </div>
              
              {tags.map((t, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5 group hover:border-white/20 transition-all">
                  <input 
                    type="text" 
                    value={t.key} 
                    onChange={e => updateTag(i, 'key', e.target.value)}
                    className="flex-1 bg-transparent border-none px-3 py-2 text-slate-300 text-xs font-bold outline-none font-mono"
                  />
                  <input 
                    type={t.key.includes('colour') || t.key.includes('color') ? 'color' : 'text'} 
                    value={t.value} 
                    onChange={e => updateTag(i, 'value', e.target.value)}
                    className={`flex-[1.5] bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-white text-sm font-bold outline-none focus:border-neon-blue/30 transition-all ${t.key.includes('color') || t.key.includes('colour') ? 'h-10 cursor-pointer p-1' : ''}`}
                  />
                  <button 
                    onClick={() => removeTag(i)}
                    className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-black/40 border-t border-white/10 shrink-0 space-y-4">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-2 text-neon-blue">
               <RefreshCw size={14} />
               <span className="text-[10px] font-black uppercase tracking-widest">OSM Synergy Tool</span>
             </div>
             <button type="button" onClick={copyOSMTags} className="text-[10px] font-black text-neon-blue uppercase hover:underline">Copy Tags</button>
          </div>
          
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-4 rounded-2xl border border-white/10 text-slate-400 font-black uppercase text-xs hover:bg-white/5 transition-all">Cancel</button>
            <button 
              type="button" 
              onClick={handleSync}
              disabled={isSaving} 
              className="flex-[2] py-4 rounded-2xl bg-neon-blue text-slate-950 font-black uppercase text-xs hover:bg-blue-400 transition-all shadow-[0_0_30px_rgba(0,210,255,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              {isSaving ? 'Synchronizing...' : 'Update High-Fi Model'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
"""

    with open('frontend/src/components/MapComponent.tsx', 'w') as f:
        f.write(content)
    print("Successfully patched MapComponent.tsx")
else:
    print("Could not find EditAssetModal")

