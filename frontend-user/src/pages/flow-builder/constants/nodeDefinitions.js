import {
  Zap, Webhook, Calendar, MessageCircle,
  MessageSquare, Image, Video, Music, FileText, MousePointer, List, Send,
  GitBranch, Shuffle, Clock, CornerDownRight,
  Tag, Tags, Hash, UserCheck, UserCog, Globe,
  Bot, Brain, BookOpen,
  Users, Bell, XCircle,
} from 'lucide-react';

export const NODE_CATEGORIES = [
  {
    id: 'triggers',
    label: 'Triggers',
    color: 'amber',
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    nodes: [
      { type: 'keywordTriggerNode', label: 'Keyword Trigger', icon: Zap, description: 'Start flow on keyword match', defaultData: { keyword: '', matchType: 'contains' } },
      { type: 'webhookTriggerNode', label: 'Webhook Trigger', icon: Webhook, description: 'Start flow from external webhook', defaultData: { path: '/webhook', secret: '' } },
      { type: 'scheduleTriggerNode', label: 'Schedule Trigger', icon: Calendar, description: 'Run flow on a schedule', defaultData: { cron: '0 9 * * *', timezone: 'Asia/Kolkata' } },
      { type: 'newMessageTriggerNode', label: 'New Message', icon: MessageCircle, description: 'Trigger on any new message', defaultData: { matchAll: true } },
    ],
  },
  {
    id: 'messages',
    label: 'Messages',
    color: 'blue',
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/30',
    nodes: [
      { type: 'sendTextNode', label: 'Send Text', icon: MessageSquare, description: 'Send a text message', defaultData: { message: '', variables: [] } },
      { type: 'sendImageNode', label: 'Send Image', icon: Image, description: 'Send an image with caption', defaultData: { imageUrl: '', caption: '' } },
      { type: 'sendVideoNode', label: 'Send Video', icon: Video, description: 'Send a video with caption', defaultData: { videoUrl: '', caption: '' } },
      { type: 'sendAudioNode', label: 'Send Audio', icon: Music, description: 'Send a voice or audio file', defaultData: { audioUrl: '' } },
      { type: 'sendDocumentNode', label: 'Send Document', icon: FileText, description: 'Send a PDF or file', defaultData: { documentUrl: '', filename: '' } },
      { type: 'sendButtonsNode', label: 'Send Buttons', icon: MousePointer, description: 'Send interactive buttons', defaultData: { body: '', buttons: [{ id: 'btn1', title: 'Option 1' }, { id: 'btn2', title: 'Option 2' }] } },
      { type: 'sendListNode', label: 'Send List', icon: List, description: 'Send a list message', defaultData: { header: '', body: '', buttonText: 'Choose', sections: [{ title: 'Section 1', rows: [{ id: 'row1', title: 'Item 1', description: '' }] }] } },
      { type: 'sendTemplateNode', label: 'Send Template', icon: Send, description: 'Send an approved template', defaultData: { templateName: '', language: 'en', components: [] } },
    ],
  },
  {
    id: 'logic',
    label: 'Logic',
    color: 'purple',
    colorClass: 'text-purple-400',
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/30',
    nodes: [
      { type: 'conditionNode', label: 'If / Else', icon: GitBranch, description: 'Branch based on conditions', defaultData: { conditions: [{ field: 'message', operator: 'contains', value: '' }], logicType: 'AND' } },
      { type: 'switchNode', label: 'Switch', icon: Shuffle, description: 'Multi-branch switch', defaultData: { field: 'message', cases: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] } },
      { type: 'delayNode', label: 'Delay', icon: Clock, description: 'Wait before continuing', defaultData: { amount: 5, unit: 'seconds' } },
      { type: 'randomSplitNode', label: 'Random Split', icon: Shuffle, description: 'A/B test your flow', defaultData: { splits: [{ label: 'A', percentage: 50 }, { label: 'B', percentage: 50 }] } },
      { type: 'goToFlowNode', label: 'Go To Flow', icon: CornerDownRight, description: 'Jump to another flow', defaultData: { targetFlowId: '', targetFlowName: '' } },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    color: 'emerald',
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    nodes: [
      { type: 'addTagNode', label: 'Add Tag', icon: Tag, description: 'Add tag to contact', defaultData: { tags: [] } },
      { type: 'removeTagNode', label: 'Remove Tag', icon: Tags, description: 'Remove tag from contact', defaultData: { tags: [] } },
      { type: 'saveVariableNode', label: 'Save Variable', icon: Hash, description: 'Store value in variable', defaultData: { variableName: '', value: '', source: 'lastMessage' } },
      { type: 'updateContactNode', label: 'Update Contact', icon: UserCheck, description: 'Update contact fields', defaultData: { fields: [{ key: 'name', value: '' }] } },
      { type: 'assignAgentNode', label: 'Assign Agent', icon: UserCog, description: 'Assign conversation to agent', defaultData: { agentId: '', teamId: '' } },
      { type: 'apiRequestNode', label: 'API Request', icon: Globe, description: 'Make an HTTP request', defaultData: { method: 'POST', url: '', headers: [], body: '', saveResponse: true, responseVariable: 'apiResponse' } },
    ],
  },
];

// Flat map of all node types
export const NODE_TYPE_MAP = Object.fromEntries(
  NODE_CATEGORIES.flatMap((cat) =>
    cat.nodes.map((n) => [n.type, { ...n, category: cat.id, categoryLabel: cat.label, colorClass: cat.colorClass, bgClass: cat.bgClass, borderClass: cat.borderClass, color: cat.color }])
  )
);

// Category colors for node headers
export const CATEGORY_COLORS = {
  triggers: { border: '#f59e0b', bg: 'rgba(245,158,11,0.08)', text: '#fbbf24', handle: '#f59e0b' },
  messages: { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)', text: '#60a5fa', handle: '#3b82f6' },
  logic: { border: '#a855f7', bg: 'rgba(168,85,247,0.08)', text: '#c084fc', handle: '#a855f7' },
  actions: { border: '#10b981', bg: 'rgba(16,185,129,0.08)', text: '#34d399', handle: '#10b981' },
};
