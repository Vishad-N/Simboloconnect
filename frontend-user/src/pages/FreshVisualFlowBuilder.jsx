import React, { useCallback, useRef, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactFlow, {
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  MarkerType,
  ConnectionLineType,
  Panel,
  getBezierPath,
  BaseEdge,
  EdgeLabelRenderer,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

import useFlowStore from './flow-builder/store/flowStore';
import { customNodeTypes } from './flow-builder/components/CustomNodes';
import NodeSidebar from './flow-builder/components/NodeSidebar';
import ConfigPanel from './flow-builder/components/ConfigPanel';
import TopToolbar from './flow-builder/components/TopToolbar';
import { NODE_TYPE_MAP } from './flow-builder/constants/nodeDefinitions';

// ─── Custom Edge: ButtonEdge (with ✂️ cut button) ────────────────────────────
const ButtonEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected }) => {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const { deleteEdge } = useFlowStore.getState();
  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          strokeWidth: 2,
          stroke: selected ? '#f43f5e' : '#94a3b8',
          strokeDasharray: selected ? '6 3' : 'none',
          transition: 'stroke 0.2s',
        }}
        markerEnd={`url(#arrowClosed)`}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            onClick={(e) => { e.stopPropagation(); deleteEdge(id); }}
            title="Disconnect"
            style={{
              width: 24, height: 24, borderRadius: '50%',
              background: '#1e293b', border: '1.5px solid #475569',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 12, color: '#f43f5e',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              transition: 'background 0.15s, transform 0.15s',
              opacity: 0.85,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f43f5e22'; e.currentTarget.style.opacity = 1; e.currentTarget.style.transform = 'scale(1.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.opacity = 0.85; e.currentTarget.style.transform = 'scale(1)'; }}
          >
            ✂
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const edgeTypes = { customWithButton: ButtonEdge };

// Custom edge default options
const defaultEdgeOptions = {
  type: 'customWithButton',
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
};

// ─── Context Menu ──────────────────────────────────────────────────────────
const ContextMenu = ({ x, y, onClose, onDuplicate, onDelete, isDark, edgeId, onDeleteEdge }) => {
  const bg = isDark ? '#0d1526' : '#fff';
  const border = isDark ? 'rgba(51,65,85,0.7)' : '#e2e8f0';
  const menuItems = edgeId ? [
    { label: '✂️ Disconnect Line', action: onDeleteEdge, danger: true }
  ] : [
    { label: '📋 Duplicate', action: onDuplicate },
    { label: '🗑️ Delete', action: onDelete, danger: true },
  ];
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      style={{ position: 'fixed', top: y, left: x, zIndex: 1000, background: bg, border: `1px solid ${border}`, borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'hidden', minWidth: 160 }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, i) => (
        <button key={i} onClick={() => { item.action(); onClose(); }}
          style={{ display: 'block', width: '100%', padding: '9px 14px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: item.danger ? '#f43f5e' : isDark ? '#e2e8f0' : '#0f172a' }}
          className={item.danger ? 'hover:bg-red-500/10' : 'hover:bg-surface-700/30'}
        >
          {item.label}
        </button>
      ))}
    </motion.div>
  );
};

// ─── Flow Simulator Panel ──────────────────────────────────────────────────
const SimulatorPanel = ({ isDark, onClose }) => {
  const [input, setInput] = useState('');
  const [log, setLog] = useState([{ role: 'system', text: 'Simulator started. Type a message to test your flow.' }]);
  const { nodes, edges } = useFlowStore();

  const simulate = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setLog(l => [...l, { role: 'user', text: userMsg }]);
    setInput('');

    // Simple simulation: find trigger → walk edges
    const trigger = nodes.find(n => n.type?.toLowerCase().includes('trigger'));
    if (!trigger) { setLog(l => [...l, { role: 'system', text: '⚠️ No trigger node found.' }]); return; }

    const visited = new Set();
    let current = trigger;
    const path = [];

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.push(current);
      const nextEdge = edges.find(e => e.source === current.id);
      if (!nextEdge) break;
      current = nodes.find(n => n.id === nextEdge.target);
    }

    path.slice(1).forEach((node, i) => {
      setTimeout(() => {
        const d = node.data;
        let text = '';
        if (node.type === 'sendTextNode') text = `📩 Bot: ${d.message || '(empty message)'}`;
        else if (node.type === 'delayNode') text = `⏳ Waiting ${d.amount} ${d.unit}...`;
        else if (node.type === 'conditionNode') text = `🔀 Checking condition...`;
        else if (node.type === 'humanHandoverNode') text = `👤 Handing over to agent...`;
        else if (node.type === 'endConversationNode') text = `✅ Flow ended: ${d.message || ''}`;
        else if (node.type === 'sendButtonsNode') text = `🔘 Bot: ${d.body}\n${(d.buttons || []).map((b, j) => `  [${j + 1}] ${b.title}`).join('\n')}`;
        else text = `⚙️ ${NODE_TYPE_MAP[node.type]?.label || node.type}`;
        setLog(l => [...l, { role: 'bot', text, nodeType: node.type }]);
      }, i * 600);
    });
  };

  const bg = isDark ? '#0d1526' : '#f8fafc';
  const border = isDark ? 'rgba(51,65,85,0.6)' : '#e2e8f0';

  return (
    <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 340, background: bg, border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', zIndex: 50, boxShadow: '-8px 0 32px rgba(0,0,0,0.3)' }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#0f172a' }}>🤖 Flow Simulator</div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {log.map((msg, i) => (
          <div key={i} style={{
            maxWidth: '85%', padding: '8px 12px', borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            background: msg.role === 'user' ? 'linear-gradient(135deg,#14b8a6,#0d9488)' : msg.role === 'system' ? 'rgba(51,65,85,0.3)' : 'rgba(30,41,59,0.8)',
            border: `1px solid ${msg.role === 'system' ? 'rgba(51,65,85,0.3)' : 'transparent'}`,
            fontSize: 12, color: msg.role === 'user' ? '#fff' : isDark ? '#cbd5e1' : '#334155',
            whiteSpace: 'pre-wrap', lineHeight: 1.5,
          }}>
            {msg.text}
          </div>
        ))}
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${border}`, display: 'flex', gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && simulate()}
          placeholder="Type a test message..." style={{ flex: 1, padding: '8px 12px', background: isDark ? 'rgba(15,23,42,0.8)' : '#fff', border: `1px solid ${border}`, borderRadius: 10, color: isDark ? '#e2e8f0' : '#0f172a', fontSize: 12, outline: 'none' }} />
        <button onClick={simulate} style={{ padding: '8px 14px', background: 'linear-gradient(135deg,#14b8a6,#0d9488)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Send</button>
      </div>
    </motion.div>
  );
};

// ─── Main Canvas ───────────────────────────────────────────────────────────
const FlowCanvas = () => {
  const wrapperRef = useRef(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [rfInstance, setRfInstance] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  const {
    nodes, edges, onNodesChange, onEdgesChange, onConnect,
    setSelectedNode, clearSelection, addNode, deleteNode, duplicateNode, deleteEdge,
    pushHistory, theme, sidebarOpen, simulatorOpen, toggleSimulator,
    undo, redo, initFlow,
  } = useFlowStore();

  // Force light theme for Visual Builder
  const isDark = false;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'Escape') { clearSelection(); setContextMenu(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, clearSelection]);

  // Initialize with default trigger on first load
  useEffect(() => {
    if (nodes.length === 0) {
      initFlow({
        nodes: [{
          id: 'trigger-1', type: 'keywordTriggerNode',
          position: { x: 120, y: 200 },
          data: { label: 'Keyword Trigger', keyword: 'ALL_MESSAGES', matchType: 'contains' },
        }],
        edges: [], name: 'My Automation Flow',
      });
    }
  }, []);

  // Load flow from URL path param (/chatbot/visual-flows/flow/:flowId)
  const { flowId: urlFlowId } = useParams();
  useEffect(() => {
    if (urlFlowId) {
      const token = localStorage.getItem('userToken');
      axios.get(`${import.meta.env.VITE_API_URL}/api/visual-flows/${urlFlowId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => {
          const flow = res.data;
          initFlow({
            id: flow.id, name: flow.name, trigger: flow.trigger,
            isPublished: flow.isActive,
            nodes: typeof flow.nodes === 'string' ? JSON.parse(flow.nodes) : (flow.nodes || []),
            edges: typeof flow.edges === 'string' ? JSON.parse(flow.edges) : (flow.edges || []),
          });
        })
        .catch(err => console.error('Failed to load flow:', err));
    }
  }, [urlFlowId]);

  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow-type');
    if (!type || !wrapperRef.current) return;

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const nodeDef = NODE_TYPE_MAP[type];

    const newNode = {
      id: `node-${Date.now()}`,
      type,
      position,
      data: { label: nodeDef?.label || type, ...(nodeDef?.defaultData || {}) },
    };
    addNode(newNode);
    pushHistory();
  }, [screenToFlowPosition, addNode, pushHistory]);

  const onNodeClick = useCallback((_, node) => setSelectedNode(node), [setSelectedNode]);

  const onNodeContextMenu = useCallback((e, node) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
  }, []);

  const onPaneClick = useCallback(() => { clearSelection(); setContextMenu(null); }, [clearSelection]);

  const onEdgeContextMenu = useCallback((e, edge) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, edgeId: edge.id });
  }, []);

  const onNodeDragStop = useCallback(() => pushHistory(), [pushHistory]);

  const bgColor = '#fafafa';
  const gridColor = '#e2e8f0';
  const minimapBg = '#ffffff';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: bgColor, fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      {/* Top Toolbar */}
      <TopToolbar reactFlowInstance={rfInstance} theme={theme} />

      {/* Body: Sidebar + Canvas + Config */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Left Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div initial={{ x: -250, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -250, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} style={{ height: '100%', flexShrink: 0 }}>
              <NodeSidebar theme={theme} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas */}
        <div ref={wrapperRef} style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            onPaneClick={onPaneClick}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={customNodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{ stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '5 5' }}
            fitView
            snapToGrid
            snapGrid={[16, 16]}
            deleteKeyCode="Delete"
            multiSelectionKeyCode="Shift"
            selectionKeyCode="Shift"
            minZoom={0.2}
            maxZoom={2}
            style={{ background: bgColor }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              color={gridColor}
              gap={24}
              size={1}
              variant="dots"
            />
            <Controls
              style={{ background: '#fff', border: `1px solid #e2e8f0`, borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              showZoom showFitView showInteractive={false}
            />
            <MiniMap
              style={{ background: minimapBg, border: `1px solid #e2e8f0`, borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              nodeColor={(n) => {
                const category = NODE_TYPE_MAP[n.type]?.category;
                const colors = { triggers: '#f59e0b', messages: '#3b82f6', logic: '#a855f7', actions: '#10b981', ai: '#7c3aed', human: '#f43f5e' };
                return colors[category] || '#94a3b8';
              }}
              maskColor={'rgba(248,250,252,0.7)'}
            />

            {/* Empty state hint */}
            {nodes.length === 0 && (
              <Panel position="top-center">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  style={{ marginTop: 60, padding: '16px 24px', background: isDark ? 'rgba(13,21,38,0.9)' : 'rgba(255,255,255,0.9)', borderRadius: 16, border: `1px solid ${isDark ? 'rgba(51,65,85,0.5)' : '#e2e8f0'}`, textAlign: 'center', backdropFilter: 'blur(12px)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🧩</div>
                  <div style={{ fontWeight: 700, color: isDark ? '#e2e8f0' : '#0f172a', marginBottom: 4 }}>Start Building Your Flow</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Drag nodes from the left panel onto this canvas</div>
                </motion.div>
              </Panel>
            )}
          </ReactFlow>

          {/* Context menu */}
          <AnimatePresence>
            {contextMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setContextMenu(null)} />
                <ContextMenu x={contextMenu.x} y={contextMenu.y} isDark={isDark}
                  edgeId={contextMenu.edgeId}
                  onDuplicate={() => duplicateNode(contextMenu.nodeId)}
                  onDelete={() => deleteNode(contextMenu.nodeId)}
                  onDeleteEdge={() => deleteEdge(contextMenu.edgeId)}
                  onClose={() => setContextMenu(null)}
                />
              </>
            )}
          </AnimatePresence>

          {/* Simulator */}
          <AnimatePresence>
            {simulatorOpen && (
              <SimulatorPanel isDark={isDark} onClose={toggleSimulator} />
            )}
          </AnimatePresence>
        </div>

        {/* Right Config Panel */}
        <ConfigPanel theme={theme} />
      </div>
    </div>
  );
};

// ─── Export ────────────────────────────────────────────────────────────────
export default function VisualFlowBuilder() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
