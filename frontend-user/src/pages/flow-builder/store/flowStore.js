import { create } from 'zustand';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';

const MAX_HISTORY = 50;

const useFlowStore = create((set, get) => ({
  // Flow metadata
  flowId: null,
  flowName: 'Untitled Flow',
  flowTrigger: 'ALL_MESSAGES',
  isPublished: false,
  isDirty: false,
  isSaving: false,

  // Canvas state
  nodes: [],
  edges: [],
  selectedNode: null,
  selectedEdge: null,

  // UI state
  theme: 'light',
  sidebarOpen: true,
  configPanelOpen: false,
  simulatorOpen: false,
  validationErrors: [],
  isValidating: false,

  // History for undo/redo
  history: [],
  historyIndex: -1,
  clipboard: null,

  // Zoom state
  zoom: 1,
  viewport: { x: 0, y: 0, zoom: 1 },

  // ─── Flow Meta ───────────────────────────────────────────────
  setFlowId: (id) => set({ flowId: id }),
  setFlowName: (name) => set({ flowName: name, isDirty: true }),
  setFlowTrigger: (trigger) => set({ flowTrigger: trigger, isDirty: true }),
  setIsSaving: (v) => set({ isSaving: v }),
  setIsPublished: (v) => set({ isPublished: v }),
  markClean: () => set({ isDirty: false }),

  // ─── Load / Init ─────────────────────────────────────────────
  initFlow: ({ nodes, edges, name, trigger, id, isPublished }) => {
    const mappedEdges = (edges || []).map(e => ({ ...e, type: 'customWithButton' }));
    set({
      nodes: nodes || [],
      edges: mappedEdges,
      flowName: name || 'Untitled Flow',
      flowTrigger: trigger || 'ALL_MESSAGES',
      flowId: id || null,
      isPublished: isPublished || false,
      isDirty: false,
      history: [{ nodes: nodes || [], edges: mappedEdges }],
      historyIndex: 0,
    });
  },

  // ─── Node / Edge changes ─────────────────────────────────────
  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      isDirty: true,
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      isDirty: true,
    }));
  },

  onConnect: (connection) => {
    const edge = {
      ...connection,
      id: `edge-${Date.now()}`,
      type: 'customWithButton',
      animated: true,
      style: { strokeWidth: 2 },
      data: { label: '' },
    };
    set((state) => {
      const newEdges = addEdge(edge, state.edges);
      return { edges: newEdges, isDirty: true };
    });
    get().pushHistory();
  },

  addNode: (node) => {
    set((state) => ({ nodes: [...state.nodes, node], isDirty: true }));
    get().pushHistory();
  },

  updateNodeData: (nodeId, data) => {
    set((state) => {
      const updatedNodes = state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      );
      const updatedSelectedNode = state.selectedNode?.id === nodeId 
        ? updatedNodes.find(n => n.id === nodeId) 
        : state.selectedNode;
      return {
        nodes: updatedNodes,
        selectedNode: updatedSelectedNode,
        isDirty: true,
      };
    });
  },

  deleteNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNode: state.selectedNode?.id === nodeId ? null : state.selectedNode,
      configPanelOpen: state.selectedNode?.id === nodeId ? false : state.configPanelOpen,
      isDirty: true,
    }));
    get().pushHistory();
  },

  deleteEdge: (edgeId) => {
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
      isDirty: true,
    }));
  },

  duplicateNode: (nodeId) => {
    const state = get();
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const newNode = {
      ...node,
      id: `node-${Date.now()}`,
      position: { x: node.position.x + 50, y: node.position.y + 50 },
      data: { ...node.data },
    };
    set((s) => ({ nodes: [...s.nodes, newNode], isDirty: true }));
  },

  // ─── Selection ───────────────────────────────────────────────
  setSelectedNode: (node) => set({ selectedNode: node, configPanelOpen: !!node }),
  setSelectedEdge: (edge) => set({ selectedEdge: edge }),
  clearSelection: () => set({ selectedNode: null, selectedEdge: null }),

  // ─── Clipboard ───────────────────────────────────────────────
  copyNode: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (node) set({ clipboard: node });
  },

  pasteNode: () => {
    const { clipboard } = get();
    if (!clipboard) return;
    const newNode = {
      ...clipboard,
      id: `node-${Date.now()}`,
      position: { x: clipboard.position.x + 80, y: clipboard.position.y + 80 },
      data: { ...clipboard.data },
    };
    set((s) => ({ nodes: [...s.nodes, newNode], isDirty: true }));
  },

  // ─── History ─────────────────────────────────────────────────
  pushHistory: () => {
    const { nodes, edges, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: [...nodes], edges: [...edges] });
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    set({ nodes: prev.nodes, edges: prev.edges, historyIndex: historyIndex - 1 });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    set({ nodes: next.nodes, edges: next.edges, historyIndex: historyIndex + 1 });
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  // ─── UI Toggles ──────────────────────────────────────────────
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleSimulator: () => set((s) => ({ simulatorOpen: !s.simulatorOpen })),
  setConfigPanelOpen: (v) => set({ configPanelOpen: v }),
  setViewport: (vp) => set({ viewport: vp }),

  // ─── Validation ──────────────────────────────────────────────
  validate: () => {
    const { nodes, edges } = get();
    const errors = [];

    const triggers = nodes.filter((n) => n.type?.toLowerCase().includes('trigger'));
    if (triggers.length === 0) {
      errors.push({ type: 'error', message: 'Flow must have at least one Trigger node', nodeId: null });
    }
    if (triggers.length > 1) {
      errors.push({ type: 'warning', message: 'Multiple trigger nodes detected', nodeId: null });
    }

    nodes.forEach((node) => {
      if (!node.type?.toLowerCase().includes('trigger')) {
        const hasIncoming = edges.some((e) => e.target === node.id);
        if (!hasIncoming) {
          errors.push({ type: 'warning', message: `Node "${node.data?.label || node.type}" is disconnected`, nodeId: node.id });
        }
      }

      if (node.type === 'sendTextNode' && !node.data?.message?.trim()) {
        errors.push({ type: 'error', message: `Send Text node has empty message`, nodeId: node.id });
      }

      if (node.type === 'apiRequestNode' && !node.data?.url?.trim()) {
        errors.push({ type: 'error', message: `API Request node has no URL`, nodeId: node.id });
      }
    });

    set({ validationErrors: errors });
    return errors;
  },

  // ─── Export / Import ─────────────────────────────────────────
  exportFlow: () => {
    const { nodes, edges, flowName, flowTrigger } = get();
    return JSON.stringify({ version: 1, metadata: { name: flowName, trigger: flowTrigger, exportedAt: new Date().toISOString() }, nodes, edges }, null, 2);
  },

  importFlow: (jsonStr) => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.nodes && data.edges) {
        get().initFlow({ nodes: data.nodes, edges: data.edges, name: data.metadata?.name, trigger: data.metadata?.trigger });
        return true;
      }
    } catch (e) {
      console.error('Import failed', e);
    }
    return false;
  },
}));

export default useFlowStore;
