import React, { useState, useEffect } from 'react';
import { 
  X, GripVertical, Eye, EyeOff, RefreshCcw, Save, Trash2, ChevronUp, ChevronDown, AlignLeft, AlignCenter, AlignRight 
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableItem = ({ id, column, onToggle, onWidthChange, onAlignChange, onMoveUp, onMoveDown, isFirst, isLast }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`flex items-center gap-3 p-3 bg-white border ${isDragging ? 'border-indigo-500 shadow-lg' : 'border-slate-200'} rounded-xl mb-2 group`}
    >
      {/* Drag Handle */}
      <div {...attributes} {...listeners} className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing">
        <GripVertical size={18} />
      </div>

      {/* Up / Down buttons */}
      <div className="flex flex-col gap-0.5">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="w-6 h-5 flex items-center justify-center rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-20 transition-all"
        >
          <ChevronUp size={13} strokeWidth={3} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="w-6 h-5 flex items-center justify-center rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-20 transition-all"
        >
          <ChevronDown size={13} strokeWidth={3} />
        </button>
      </div>

      {/* Visibility Toggle */}
      <button 
        onClick={() => onToggle(id)}
        className={`p-1.5 rounded-lg transition-colors ${column.visible ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 bg-slate-100'}`}
      >
        {column.visible ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>

      <div className="flex-1">
        <p className={`text-sm font-bold ${column.visible ? 'text-slate-900' : 'text-slate-400'}`}>
          {column.label}
        </p>
        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{id.replace(/_/g, ' ')}</p>
      </div>

      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg mr-2">
        <button onClick={() => onAlignChange(id, 'left')} className={`p-1 rounded ${column.align === 'left' || !column.align ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
          <AlignLeft size={14} />
        </button>
        <button onClick={() => onAlignChange(id, 'center')} className={`p-1 rounded ${column.align === 'center' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
          <AlignCenter size={14} />
        </button>
        <button onClick={() => onAlignChange(id, 'right')} className={`p-1 rounded ${column.align === 'right' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
          <AlignRight size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-[10px] font-bold text-slate-400">WIDTH</label>
        <input 
          type="number" 
          value={parseInt(column.width) || ''} 
          onChange={(e) => {
            const val = e.target.value;
            onWidthChange(id, val ? parseInt(val) + "px" : "100px");
          }}
          className="w-16 h-8 text-center text-xs font-bold border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
          min="20"
          max="800"
        />
        <span className="text-[10px] font-bold text-slate-400">PX</span>
      </div>
    </div>
  );
};

const ColumnConfigModal = ({ isOpen, onClose, config, onUpdate, doctype, themeColor }) => {
  const [localConfig, setLocalConfig] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setLocalConfig([...config]);
    }
  }, [isOpen, config]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setLocalConfig((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleVisibility = (id) => {
    setLocalConfig(prev => prev.map(col => 
      col.id === id ? { ...col, visible: !col.visible } : col
    ));
  };

  const updateWidth = (id, width) => {
    setLocalConfig(prev => prev.map(col => 
      col.id === id ? { ...col, width } : col
    ));
  };

  const updateAlign = (id, align) => {
    setLocalConfig(prev => prev.map(col => 
      col.id === id ? { ...col, align } : col
    ));
  };

  const resetToDefault = () => {
    // This will be handled by Parent passing its default
    if (window.confirm("Reset to default system column configuration?")) {
      onUpdate(null); // Parent should interpret null as Reset
      onClose();
    }
  };

  const moveColumn = (index, direction) => {
    const newConfig = [...localConfig];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newConfig.length) return;
    [newConfig[index], newConfig[targetIndex]] = [newConfig[targetIndex], newConfig[index]];
    setLocalConfig(newConfig);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-50 rounded-3xl overflow-hidden shadow-2xl border border-white/20 flex flex-col" style={{ width: '550px', height: '800px', maxWidth: '95vw', maxHeight: '95vh' }}>
        {/* Header */}
        <div className="px-8 py-6 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <RefreshCcw size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Configure Columns</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{doctype} Matrix Table</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Drag ≡ or use ↑↓ buttons to reorder · Click eye to show/hide
          </p>
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={localConfig.map(c => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {localConfig.map((col, idx) => (
                  <SortableItem 
                    key={col.id} 
                    id={col.id} 
                    column={col} 
                    onToggle={toggleVisibility}
                    onWidthChange={updateWidth}
                    onAlignChange={updateAlign}
                    onMoveUp={() => moveColumn(idx, -1)}
                    onMoveDown={() => moveColumn(idx, 1)}
                    isFirst={idx === 0}
                    isLast={idx === localConfig.length - 1}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-white border-t border-slate-100 flex items-center justify-between">
          <button 
            onClick={resetToDefault}
            className="flex items-center gap-2 text-sm font-bold text-red-500 hover:text-red-600 transition-colors"
          >
            <Trash2 size={16} />
            <span>Reset to Default</span>
          </button>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
            >
              Discard
            </button>
            <button 
              onClick={() => { onUpdate(localConfig); onClose(); }}
              style={{ background: themeColor || '#4f46e5' }}
              className="flex items-center gap-2 px-8 py-3 text-sm font-black text-white rounded-xl shadow-lg shadow-indigo-200 hover:opacity-90 transition-all active:scale-95"
            >
              <Save size={18} />
              <span>Update Matrix</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default ColumnConfigModal;
