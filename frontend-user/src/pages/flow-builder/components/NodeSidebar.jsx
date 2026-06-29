import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { NODE_CATEGORIES, NODE_TYPE_MAP } from '../constants/nodeDefinitions';

const NodePaletteItem = ({ node, category, isDark }) => {
  const Icon = node.icon;

  const onDragStart = (e) => {
    e.dataTransfer.setData('application/reactflow-type', node.type);
    e.dataTransfer.setData('application/reactflow-category', category.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <motion.div
      draggable
      onDragStart={onDragStart}
      whileHover={{ scale: 1.02, x: 2 }}
      whileTap={{ scale: 0.97 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 10,
        background: isDark ? 'rgba(15,23,42,0.6)' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(51,65,85,0.5)' : '#e2e8f0'}`,
        cursor: 'grab',
        transition: 'border-color 0.15s ease',
        marginBottom: 4,
        userSelect: 'none',
      }}
      className="group hover:border-brand-500/40"
    >
      <div style={{
        width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }} className={category.bgClass}>
        <Icon size={14} className={category.colorClass} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#e2e8f0' : '#0f172a', lineHeight: 1.3 }}>{node.label}</div>
        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.description}</div>
      </div>
      <GripVertical size={12} style={{ color: '#334155', flexShrink: 0 }} className="opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
};

const CategorySection = ({ category, searchQuery, isDark }) => {
  const [isOpen, setIsOpen] = useState(true);

  const filtered = category.nodes.filter(
    (n) =>
      !searchQuery ||
      n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (searchQuery && filtered.length === 0) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          padding: '6px 4px', background: 'transparent', border: 'none', cursor: 'pointer',
          borderRadius: 6,
        }}
        className="hover:bg-surface-800/50"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
          <div style={{ width: 3, height: 14, borderRadius: 2 }} className={`bg-${category.color}-500`} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }} className={category.colorClass}>
            {category.label}
          </span>
          <span style={{ fontSize: 10, color: isDark ? '#e2e8f0' : '#0f172a', background: isDark ? 'rgba(51,65,85,0.4)' : '#e2e8f0', padding: '1px 6px', borderRadius: 999 }}>
            {filtered.length}
          </span>
        </div>
        {isOpen ? <ChevronDown size={12} style={{ color: '#64748b' }} /> : <ChevronRight size={12} style={{ color: '#64748b' }} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingLeft: 0, paddingTop: 4 }}>
              {filtered.map((node) => (
                <NodePaletteItem key={node.type} node={node} category={category} isDark={isDark} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const NodeSidebar = ({ theme }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const isDark = theme === 'dark';
  const bg = isDark ? '#0d1526' : '#f8fafc';
  const border = isDark ? 'rgba(51,65,85,0.6)' : '#e2e8f0';

  return (
    <div style={{
      width: 240,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: bg,
      borderRight: `1px solid ${border}`,
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '14px 12px 10px', borderBottom: `1px solid ${border}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e2e8f0' : '#0f172a', marginBottom: 8 }}>
          🧩 Node Palette
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '7px 10px 7px 30px', fontSize: 12,
              background: isDark ? 'rgba(15,23,42,0.8)' : '#f1f5f9',
              border: `1px solid ${isDark ? 'rgba(51,65,85,0.5)' : '#e2e8f0'}`,
              borderRadius: 8, color: isDark ? '#e2e8f0' : '#0f172a',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Node list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {NODE_CATEGORIES.map((cat) => (
          <CategorySection key={cat.id} category={cat} searchQuery={searchQuery} isDark={isDark} />
        ))}
      </div>

      {/* Footer hint */}
      <div style={{ padding: '8px 12px', borderTop: `1px solid ${border}`, fontSize: 10, color: '#475569', textAlign: 'center' }}>
        Drag nodes onto the canvas
      </div>
    </div>
  );
};

export default NodeSidebar;
