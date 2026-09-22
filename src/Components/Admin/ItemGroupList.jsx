import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Plus, Search, X, Loader2, ChevronLeft, ChevronRight, Palette, Layers,
    Edit2, Package, Save, CheckCircle2, ChevronDown, Folder, FolderOpen,
    Tag, Trash2, RefreshCw, ArrowRight, ExternalLink, Info, Filter, LayoutGrid
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import DirhamIcon from '../../assets/Currency/DirhamIcon';

export default function ItemGroupList() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedNodeName, setSelectedNodeName] = useState('All Item Groups');
    const [selectedNodeDetails, setSelectedNodeDetails] = useState(null);
    const [attachedItems, setAttachedItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [itemSearchTerm, setItemSearchTerm] = useState('');

    // Theme toggle (synced across pages)
    const [itTheme, setItTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
    const isGreen = itTheme === 'green';
    const themeColor = isGreen ? '#10b981' : '#0ea5e9';
    const themeColorHover = isGreen ? '#059669' : '#0284c7';
    const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

    useEffect(() => {
        localStorage.setItem('legacySubTheme', itTheme);
        document.documentElement.style.setProperty('--so-primary', themeColor);
        document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
        document.documentElement.style.setProperty('--so-primary-light', themeLight);
    }, [itTheme, themeColor, themeColorHover, themeLight]);

    // Tree Filter & Expansion
    const [treeSearchTerm, setTreeSearchTerm] = useState('');
    const [expandedNodes, setExpandedNodes] = useState({ 'All Item Groups': true });

    // Modal / Form state
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        item_group_name: '',
        parent_item_group: 'All Item Groups',
        is_group: 0,
        description: ''
    });

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/resource/Item Group', {
                params: {
                    fields: JSON.stringify(["name", "item_group_name", "parent_item_group", "is_group", "lft", "rgt"]),
                    limit_page_length: 1000,
                    order_by: 'lft asc'
                },
                withCredentials: true
            });
            const raw = res.data.data || [];
            const normalized = raw.map(g => ({
                ...g,
                item_group_name: g.item_group_name || g.name
            }));
            setGroups(normalized);

            // Expand top-level nodes by default
            const newExpanded = { 'All Item Groups': true };
            normalized.forEach(g => {
                if (!g.parent_item_group || g.parent_item_group === 'All Item Groups') {
                    newExpanded[g.name] = true;
                }
            });
            setExpandedNodes(newExpanded);

            // Select default node if available
            if (normalized.length > 0) {
                const rootNode = normalized.find(g => g.name === 'All Item Groups') || normalized[0];
                selectNode(rootNode.name, normalized);
            }
        } catch (err) {
            console.error('Failed to load item groups:', err);
        } finally {
            setLoading(false);
        }
    };

    const selectNode = useCallback(async (nodeName, groupList = groups) => {
        setSelectedNodeName(nodeName);
        const found = groupList.find(g => g.name === nodeName);
        setSelectedNodeDetails(found || { name: nodeName, item_group_name: nodeName, is_group: 1 });

        // Fetch attached items for this node
        fetchAttachedItems(nodeName);
    }, [groups]);

    const fetchAttachedItems = async (groupName) => {
        try {
            setLoadingItems(true);
            const res = await axios.get('/api/resource/Item', {
                params: {
                    fields: JSON.stringify(["name", "item_code", "item_name", "standard_rate", "stock_uom", "image", "item_group"]),
                    filters: JSON.stringify([["item_group", "=", groupName]]),
                    limit_page_length: 200,
                    order_by: 'item_name asc'
                },
                withCredentials: true
            });
            setAttachedItems(res.data.data || []);
        } catch (err) {
            console.error('Failed to load attached items:', err);
            setAttachedItems([]);
        } finally {
            setLoadingItems(false);
        }
    };

    // Build hierarchical tree structure
    const treeNodes = useMemo(() => {
        const nodeMap = {};
        const roots = [];

        groups.forEach(g => {
            nodeMap[g.name] = { ...g, children: [] };
        });

        groups.forEach(g => {
            const node = nodeMap[g.name];
            if (g.parent_item_group && nodeMap[g.parent_item_group] && g.parent_item_group !== g.name) {
                nodeMap[g.parent_item_group].children.push(node);
            } else {
                roots.push(node);
            }
        });

        return roots;
    }, [groups]);

    // Count subgroups & items under each node
    const groupStats = useMemo(() => {
        const stats = {};
        groups.forEach(g => {
            const childrenCount = groups.filter(child => child.parent_item_group === g.name).length;
            stats[g.name] = { childrenCount };
        });
        return stats;
    }, [groups]);

    const toggleExpand = (nodeName, e) => {
        if (e) e.stopPropagation();
        setExpandedNodes(prev => ({ ...prev, [nodeName]: !prev[nodeName] }));
    };

    const expandAll = () => {
        const allExp = {};
        groups.forEach(g => allExp[g.name] = true);
        setExpandedNodes(allExp);
    };

    const collapseAll = () => {
        setExpandedNodes({ 'All Item Groups': true });
    };

    const openCreateModal = (parentGroup = selectedNodeName) => {
        setForm({
            item_group_name: '',
            parent_item_group: parentGroup || 'All Item Groups',
            is_group: 0,
            description: ''
        });
        setIsEditMode(false);
        setShowModal(true);
    };

    const openEditModal = (node) => {
        setForm({
            item_group_name: node.item_group_name || node.name,
            parent_item_group: node.parent_item_group || 'All Item Groups',
            is_group: node.is_group || 0,
            description: node.description || ''
        });
        setIsEditMode(true);
        setShowModal(true);
    };

    const handleSaveGroup = async (e) => {
        e.preventDefault();
        if (!form.item_group_name.trim()) {
            return Swal.fire('Error', 'Item Group Name is required.', 'error');
        }

        setSaving(true);
        const payload = {
            item_group_name: form.item_group_name.trim(),
            parent_item_group: form.parent_item_group || undefined,
            is_group: form.is_group ? 1 : 0,
            description: form.description || ''
        };

        try {
            if (isEditMode) {
                await axios.put(`/api/resource/Item Group/${encodeURIComponent(selectedNodeName)}`, payload, { withCredentials: true });
                Swal.fire({ icon: 'success', title: 'Updated!', text: `Item group ${form.item_group_name} updated successfully.`, timer: 1500 });
            } else {
                await axios.post('/api/resource/Item Group', payload, { withCredentials: true });
                Swal.fire({ icon: 'success', title: 'Created!', text: `Item group ${form.item_group_name} created successfully.`, timer: 1500 });
            }
            setShowModal(false);
            fetchGroups();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.message || 'Save failed', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteGroup = async (nodeName) => {
        const result = await Swal.fire({
            title: 'Delete Item Group?',
            text: `Are you sure you want to delete "${nodeName}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Yes, Delete'
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`/api/resource/Item Group/${encodeURIComponent(nodeName)}`, { withCredentials: true });
                Swal.fire('Deleted!', `Item Group "${nodeName}" removed.`, 'success');
                fetchGroups();
            } catch (err) {
                Swal.fire('Error', err.response?.data?.message || 'Delete failed', 'error');
            }
        }
    };

    // Filter attached items by search term
    const filteredAttachedItems = useMemo(() => {
        if (!itemSearchTerm.trim()) return attachedItems;
        const q = itemSearchTerm.toLowerCase();
        return attachedItems.filter(i =>
            (i.item_name || '').toLowerCase().includes(q) ||
            (i.item_code || '').toLowerCase().includes(q)
        );
    }, [attachedItems, itemSearchTerm]);

    // Recursive Tree Node component
    const renderTreeNode = (node, depth = 0) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = !!expandedNodes[node.name];
        const isSelected = selectedNodeName === node.name;
        const isMatchingSearch = treeSearchTerm.trim() &&
            node.item_group_name.toLowerCase().includes(treeSearchTerm.toLowerCase());

        if (treeSearchTerm.trim() && !isMatchingSearch && !node.children.some(c => c.item_group_name.toLowerCase().includes(treeSearchTerm.toLowerCase()))) {
            return null;
        }

        return (
            <div key={node.name} className="flex flex-col">
                <div
                    onClick={() => selectNode(node.name)}
                    className={`flex items-center justify-between py-2 px-3 rounded-xl cursor-pointer transition-all duration-150 group ${
                        isSelected
                            ? 'bg-emerald-50 text-emerald-900 font-extrabold shadow-xs border border-emerald-200'
                            : 'hover:bg-slate-100/80 text-slate-700 font-semibold'
                    }`}
                    style={{ paddingLeft: `${depth * 1.25 + 0.75}rem` }}
                >
                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                        {hasChildren ? (
                            <button
                                type="button"
                                onClick={(e) => toggleExpand(node.name, e)}
                                className="p-0.5 rounded hover:bg-slate-200/60 text-slate-500 hover:text-slate-800 transition-colors"
                            >
                                {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </button>
                        ) : (
                            <span className="w-4 h-4 inline-block shrink-0" />
                        )}

                        {node.is_group ? (
                            isExpanded ? (
                                <FolderOpen size={16} className={isSelected ? 'text-emerald-600' : 'text-amber-500'} />
                            ) : (
                                <Folder size={16} className={isSelected ? 'text-emerald-600' : 'text-amber-500'} />
                            )
                        ) : (
                            <Tag size={15} className={isSelected ? 'text-emerald-600' : 'text-slate-400'} />
                        )}

                        <span className="text-xs truncate tracking-tight">
                            {node.item_group_name}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {groupStats[node.name]?.childrenCount > 0 && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-200/70 text-slate-600">
                                {groupStats[node.name].childrenCount} subs
                            </span>
                        )}
                        {node.is_group ? (
                            <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                Folder
                            </span>
                        ) : (
                            <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase bg-slate-100 text-slate-500 border border-slate-200">
                                Leaf
                            </span>
                        )}
                    </div>
                </div>

                {/* Render child nodes if expanded */}
                {(isExpanded || treeSearchTerm.trim()) && hasChildren && (
                    <div className="flex flex-col mt-0.5">
                        {node.children.map(child => renderTreeNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="erp-page so-page min-h-screen bg-slate-50/50">
            {/* 1. Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                        <Layers size={22} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                            Item Group Hierarchy & Node Explorer
                        </h1>
                        <p className="text-xs font-semibold text-slate-500">
                            {groups.length} Item Groups configured in hierarchy
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setItTheme(isGreen ? 'blue' : 'green')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all uppercase"
                    >
                        <Palette size={14} style={{ color: themeColor }} />
                        <span>Theme: {itTheme}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => fetchGroups()}
                        className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-all"
                        title="Reload Groups"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>

                    <button
                        type="button"
                        onClick={() => openCreateModal('All Item Groups')}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
                    >
                        <Plus size={16} />
                        <span>NEW ITEM GROUP</span>
                    </button>
                </div>
            </div>

            {/* 2. Main 2-Column Split Explorer */}
            <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                    {/* LEFT COLUMN: HIERARCHY TREE EXPLORER (4 cols) */}
                    <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col gap-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <FolderOpen size={17} className="text-emerald-600" />
                                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                    Node Tree Hierarchy
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={expandAll}
                                    className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                >
                                    Expand All
                                </button>
                                <button
                                    type="button"
                                    onClick={collapseAll}
                                    className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                >
                                    Collapse
                                </button>
                            </div>
                        </div>

                        {/* Search Tree Input */}
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                            <input
                                type="text"
                                placeholder="Search tree nodes..."
                                value={treeSearchTerm}
                                onChange={e => setTreeSearchTerm(e.target.value)}
                                style={{ paddingLeft: '2.5rem', paddingRight: '2rem' }}
                                className="w-full py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                            />
                            {treeSearchTerm && (
                                <button
                                    onClick={() => setTreeSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {/* Tree List Container */}
                        <div className="max-h-[650px] overflow-y-auto pr-1 flex flex-col gap-0.5">
                            {loading ? (
                                <div className="py-12 text-center text-slate-400">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500 mb-2" />
                                    <span className="text-xs font-bold">Building Node Tree...</span>
                                </div>
                            ) : treeNodes.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 font-bold text-xs">
                                    No Item Groups found.
                                </div>
                            ) : (
                                treeNodes.map(node => renderTreeNode(node, 0))
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: SELECTED NODE DETAILS & ATTACHED ITEMS (8 cols) */}
                    <div className="lg:col-span-8 flex flex-col gap-6">

                        {/* NODE OVERVIEW HEADER CARD */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
                            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                                        {selectedNodeDetails?.is_group ? <FolderOpen size={24} /> : <Tag size={24} />}
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-base font-black text-slate-900 tracking-tight">
                                                {selectedNodeDetails?.item_group_name || selectedNodeName}
                                            </h2>
                                            {selectedNodeDetails?.is_group ? (
                                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
                                                    Folder Node (Category)
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                                                    Leaf Node (Item Group)
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs font-semibold text-slate-400 mt-0.5">
                                            Parent Node: <strong className="text-slate-700">{selectedNodeDetails?.parent_item_group || 'None (Root Node)'}</strong>
                                        </span>
                                    </div>
                                </div>

                                {/* Node Action Buttons */}
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => openCreateModal(selectedNodeName)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-black transition-all cursor-pointer"
                                    >
                                        <Plus size={14} />
                                        <span>ADD SUBGROUP</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => openEditModal(selectedNodeDetails)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-black transition-all cursor-pointer"
                                    >
                                        <Edit2 size={14} />
                                        <span>EDIT NODE</span>
                                    </button>

                                    {selectedNodeName !== 'All Item Groups' && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteGroup(selectedNodeName)}
                                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg transition-all cursor-pointer"
                                            title="Delete Group"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Stat Counters */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col">
                                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Direct Subgroups</span>
                                    <span className="text-lg font-black text-slate-800 mt-0.5">
                                        {groups.filter(g => g.parent_item_group === selectedNodeName).length}
                                    </span>
                                </div>

                                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200/60 flex flex-col">
                                    <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider">Direct Attached Items</span>
                                    <span className="text-lg font-black text-emerald-800 mt-0.5">
                                        {attachedItems.length}
                                    </span>
                                </div>

                                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-200/60 flex flex-col col-span-2 sm:col-span-1">
                                    <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">ERPNext DocType</span>
                                    <span className="text-xs font-black text-indigo-800 mt-1 truncate">
                                        Item Group
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ATTACHED ITEMS PANEL */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <Package size={18} className="text-emerald-600" />
                                    <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                                        Products in "{selectedNodeName}"
                                    </h3>
                                </div>

                                {/* Filter Items Input */}
                                <div className="relative w-64">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                                    <input
                                        type="text"
                                        placeholder="Filter products..."
                                        value={itemSearchTerm}
                                        onChange={e => setItemSearchTerm(e.target.value)}
                                        style={{ paddingLeft: '2.5rem', paddingRight: '2rem' }}
                                        className="w-full py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                    />
                                    {itemSearchTerm && (
                                        <button
                                            onClick={() => setItemSearchTerm('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 z-10"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Attached Items Grid/Table */}
                            {loadingItems ? (
                                <div className="py-12 text-center text-slate-400">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500 mb-2" />
                                    <span className="text-xs font-bold">Loading Attached Products...</span>
                                </div>
                            ) : filteredAttachedItems.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                                    <Package className="w-8 h-8 opacity-30" />
                                    <span className="text-xs font-bold">
                                        {attachedItems.length === 0 ? `No direct items attached to "${selectedNodeName}".` : 'No matching items found.'}
                                    </span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[450px] overflow-y-auto pr-1">
                                    {filteredAttachedItems.map(item => (
                                        <div
                                            key={item.name}
                                            className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 flex flex-col justify-between gap-2 transition-all"
                                        >
                                            <div className="flex flex-col text-left">
                                                <span className="text-xs font-black text-slate-900 line-clamp-1">
                                                    {item.item_name || item.item_code}
                                                </span>
                                                <span className="text-[10px] font-mono font-bold text-emerald-600 mt-0.5">
                                                    {item.item_code}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">
                                                    {item.stock_uom || 'Nos'}
                                                </span>
                                                <span className="text-xs font-black text-slate-800 flex items-center gap-0.5">
                                                    <DirhamIcon size={12} /> {(parseFloat(item.standard_rate) || 0).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {/* 3. CREATE / EDIT ITEM GROUP MODAL */}
            {showModal && (
                <div className="erp-overlay so-modal-overlay" style={{ zIndex: 10000 }}>
                    <div className="so-modal" style={{ maxWidth: '540px', borderRadius: '1rem', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
                        {/* Modal Header */}
                        <div className="erp-dialog-edge so-modal-header" style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                <FolderOpen size={18} style={{ color: themeColor, shrink: 0 }} />
                                <h3 className="so-modal-title" style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.03em', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {isEditMode ? `Edit Group: ${selectedNodeName}` : 'New Item Group Node'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="so-modal-close"
                                style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Close Modal"
                            >
                                <X size={18} color="#64748b" />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSaveGroup} style={{ margin: 0, padding: 0 }}>
                            <div className="erp-dialog-body so-modal-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div className="so-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'left' }}>
                                    <label className="so-label" style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: '#475569' }}>
                                        Item Group Name <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={form.item_group_name}
                                        onChange={e => setForm({ ...form, item_group_name: e.target.value })}
                                        placeholder="e.g. Beverages, Electronics..."
                                        className="so-input"
                                    />
                                </div>

                                <div className="so-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'left' }}>
                                    <label className="so-label" style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: '#475569' }}>
                                        Parent Group Node
                                    </label>
                                    <select
                                        value={form.parent_item_group}
                                        onChange={e => setForm({ ...form, parent_item_group: e.target.value })}
                                        className="so-input"
                                    >
                                        <option value="">No Parent (Root Group)</option>
                                        {groups.filter(g => g.is_group).map(g => (
                                            <option key={g.name} value={g.name}>{g.item_group_name || g.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="so-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'left' }}>
                                    <label className="so-label" style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: '#475569' }}>
                                        Node Category Type
                                    </label>
                                    <select
                                        value={form.is_group}
                                        onChange={e => setForm({ ...form, is_group: parseInt(e.target.value) })}
                                        className="so-input"
                                    >
                                        <option value={1}>Folder Node (Contains Subgroups)</option>
                                        <option value={0}>Leaf Node (Contains Items Directly)</option>
                                    </select>
                                </div>

                                <div className="so-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'left' }}>
                                    <label className="so-label" style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: '#475569' }}>
                                        Description / Internal Notes
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                        placeholder="Optional notes or category details..."
                                        className="so-input"
                                    />
                                </div>
                            </div>

                            {/* Modal Dedicated Footer */}
                            <div className="erp-dialog-edge so-modal-footer" style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderRadius: '0 0 1rem 1rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="erp-button erp-button-secondary so-btn-secondary"
                                    style={{ padding: '0.5rem 1.25rem', borderRadius: '0.625rem', fontWeight: 800, fontSize: '0.8rem' }}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="erp-button erp-button-primary so-btn-primary"
                                    style={{ padding: '0.5rem 1.5rem', borderRadius: '0.625rem', fontWeight: 800, fontSize: '0.8rem', background: themeColor, borderColor: themeColor }}
                                >
                                    {saving ? <Loader2 size={14} className="so-spinner" /> : (isEditMode ? 'Update Node' : 'Create Node')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
