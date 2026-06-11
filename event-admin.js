(function () {
  'use strict';

  const STORAGE_KEY = 'arctic-ai-event-admin-draft-v3-canvas';
  const CANVAS_NODE_WIDTH = 220;
  const CANVAS_NODE_HEIGHT = 72;
  const CANVAS_CHILD_WIDTH = 196;
  const CANVAS_CHILD_HEIGHT = 58;
  const PORT_SIDES = ['top', 'right', 'bottom', 'left'];
  const DEFAULT_FROM_PORT = 'bottom';
  const DEFAULT_TO_PORT = 'top';
  const PORT_SNAP_RADIUS = 20;
  const STATUS = {
    NOT_STARTED: 'Not started',
    IN_PROGRESS: 'In progress',
    COMPLETE: 'Complete',
    NEEDS_ATTENTION: 'Needs attention'
  };

  const NODE_TYPES = {
    BASICS: 'BasicsNode',
    REGISTRATION: 'RegistrationAttendanceNode',
    BANNER: 'BannerNode',
    INSTRUCTORS: 'InstructorsNode',
    SESSIONS: 'SessionsContainerNode',
    SESSION: 'SessionNode',
    SESSION_BASICS: 'SessionBasicsNode',
    SESSION_SCHEDULE: 'SessionScheduleNode',
    SESSION_VENUE: 'SessionVenueNode',
    SESSION_CAPACITY: 'SessionCapacityNode',
    SESSION_INSTRUCTORS: 'SessionInstructorsNode',
    SESSION_MATERIALS: 'SessionMaterialsNode',
    SESSION_REG_RULES: 'SessionRegistrationRulesNode',
    SESSION_PUBLISH_CHECKS: 'SessionPublishChecksNode'
  };

  const SESSION_CHILD_DEFS = [
    { type: NODE_TYPES.SESSION_BASICS, label: 'Basics', required: true },
    { type: NODE_TYPES.SESSION_SCHEDULE, label: 'Schedule', required: true },
    { type: NODE_TYPES.SESSION_VENUE, label: 'Venue', required: true },
    { type: NODE_TYPES.SESSION_CAPACITY, label: 'Capacity', required: true },
    { type: NODE_TYPES.SESSION_INSTRUCTORS, label: 'Instructors', required: true },
    { type: NODE_TYPES.SESSION_MATERIALS, label: 'Materials', required: false },
    { type: NODE_TYPES.SESSION_REG_RULES, label: 'Registration rules', required: false },
    { type: NODE_TYPES.SESSION_PUBLISH_CHECKS, label: 'Publish checks', required: true }
  ];

  const SESSION_CHILD_TYPES = SESSION_CHILD_DEFS.map(function (item) { return item.type; });
  const CANVAS_ONLY_TYPES = SESSION_CHILD_TYPES.concat([NODE_TYPES.SESSION]);

  const MAX_BANNER_BYTES = 5 * 1024 * 1024;
  const SINGLETON_TYPES = [NODE_TYPES.BASICS, NODE_TYPES.REGISTRATION, NODE_TYPES.BANNER, NODE_TYPES.INSTRUCTORS, NODE_TYPES.SESSIONS];

  const paletteItems = [
    { type: NODE_TYPES.BASICS, label: 'Basics', helper: 'Title, description, spot', required: true },
    { type: NODE_TYPES.REGISTRATION, label: 'Registration', helper: 'Enrollment path', required: true },
    { type: NODE_TYPES.BANNER, label: 'Banner', helper: 'Optional media', required: false },
    { type: NODE_TYPES.INSTRUCTORS, label: 'Instructors', helper: 'Names and emails', required: false },
    { type: NODE_TYPES.SESSIONS, label: 'Sessions Container', helper: 'Required for session branches', required: true },
    { type: NODE_TYPES.SESSION, label: 'Session Node', helper: 'Repeatable child under sessions', required: false }
  ];

  const DOM = {
    openButton: document.getElementById('new-event-button'),
    sampleButton: document.getElementById('load-sample-event-button'),
    workspaceSaveButton: document.getElementById('workspace-save-button'),
    closeButton: document.getElementById('event-admin-close-button'),
    saveButton: document.getElementById('event-admin-save-button'),
    startBlankButton: document.getElementById('event-start-blank-button'),
    templateGallery: document.getElementById('event-template-gallery'),
    templateCards: document.getElementById('event-template-cards'),
    palette: document.getElementById('event-node-palette'),
    canvas: document.getElementById('event-node-canvas'),
    form: document.getElementById('event-node-form'),
    title: document.getElementById('event-node-title'),
    statusChip: document.getElementById('event-node-status-chip'),
    progressChip: document.getElementById('event-admin-progress-chip'),
    meta: document.getElementById('event-admin-meta'),
    alert: document.getElementById('event-admin-alert'),
    zoomInButton: document.getElementById('event-canvas-zoom-in'),
    zoomOutButton: document.getElementById('event-canvas-zoom-out'),
    zoomResetButton: document.getElementById('event-canvas-zoom-reset'),
    zoomLabel: document.getElementById('event-canvas-zoom-label'),
    fitGraphButton: document.getElementById('event-canvas-fit-graph')
  };

  if (!DOM.palette || !DOM.canvas || !DOM.form) return;

  const isEmbeddedWorkspace = Boolean(document.getElementById('workspace-event-view'));

  const state = {
    draft: null,
    selectedNodeId: null,
    attemptedNodeIds: {},
    isInitialized: false,
    canvasView: { scale: 1, panX: 0, panY: 0 },
    nodeDrag: null,
    edgeDrag: null,
    panDrag: null,
    selectedEdgeKey: null,
    spacePanActive: false,
    removedAutoEdges: {}
  };

  let toastTimeoutId = null;
  let toastDismissTimeoutId = null;

  function safeParse(raw) {
    try { return JSON.parse(raw); } catch (error) { return null; }
  }

  function getNodeDefinition(type) {
    const paletteMatch = paletteItems.find(function (item) { return item.type === type; });
    if (paletteMatch) return paletteMatch;
    return SESSION_CHILD_DEFS.find(function (item) { return item.type === type; }) || null;
  }

  function isSessionChildType(type) {
    return SESSION_CHILD_TYPES.indexOf(type) > -1;
  }

  function isCanvasNode(node) {
    return node && CANVAS_ONLY_TYPES.indexOf(node.type) === -1 || node.type === NODE_TYPES.SESSION;
  }

  function getRootCanvasNodes(draft) {
    return draft.nodes.filter(function (node) {
      return !node.parentSessionId && node.type !== NODE_TYPES.SESSION || node.type === NODE_TYPES.SESSION;
    }).filter(function (node) {
      return !isSessionChildType(node.type);
    });
  }

  function getSessionChildNodes(draft, sessionId) {
    return draft.nodes.filter(function (node) { return node.parentSessionId === sessionId; });
  }

  function createDraft(options) {
    const opts = options || {};
    const now = Date.now();
    return {
      id: opts.id || `event-${now}`,
      nodes: [],
      edges: [],
      payloadByNodeId: {},
      sessions: [],
      sessionMap: {},
      conflicts: [],
      publishChecklist: { blockers: [], warnings: [] },
      meta: {
        lastSavedAt: now,
        isDirty: false,
        templateChosen: false
      }
    };
  }

  function createSalesKickoffDraft() {
    const draft = createDraft({ id: 'event-template-sales-kickoff' });
    const basicsId = addNodeByType(draft, NODE_TYPES.BASICS, false);
    const regId = addNodeByType(draft, NODE_TYPES.REGISTRATION, false);
    const instructorId = addNodeByType(draft, NODE_TYPES.INSTRUCTORS, false);
    const sessionsId = addNodeByType(draft, NODE_TYPES.SESSIONS, false);
    const sessionA = addNodeByType(draft, NODE_TYPES.SESSION, false);
    const sessionB = addNodeByType(draft, NODE_TYPES.SESSION, false);
    draft.payloadByNodeId[basicsId] = {
      title: 'Revenue Kickoff 2026',
      description: 'Multi-track kickoff for enterprise planning and launch alignment.',
      spot: 'Northwest Spot'
    };
    draft.payloadByNodeId[regId] = { modes: ['open-registration', 'attendance-tracked'] };
    draft.payloadByNodeId[instructorId] = { entries: ['Maya Lin', 'maya@example.com'] };
    draft.payloadByNodeId[sessionsId] = { sessionIds: [sessionA, sessionB] };
    draft.payloadByNodeId[sessionA] = { title: 'Opening Keynote' };
    draft.payloadByNodeId[sessionB] = { title: 'Breakout: Expansion Plan' };
    seedSessionBranchData(draft, sessionA, {
      title: 'Opening Keynote',
      summary: 'Kickoff keynote for revenue teams.',
      track: 'Keynote',
      date: '2026-03-12',
      startTime: '09:00',
      endTime: '10:00',
      timezone: 'America/Los_Angeles',
      venueMode: 'physical',
      location: 'Northwest Spot — Main Hall',
      capacity: '250',
      waitlist: 'enabled',
      instructors: ['Maya Lin', 'maya@example.com']
    });
    seedSessionBranchData(draft, sessionB, {
      title: 'Breakout: Expansion Plan',
      summary: 'Regional expansion planning breakout.',
      track: 'Breakout',
      date: '2026-03-12',
      startTime: '10:30',
      endTime: '11:30',
      timezone: 'America/Los_Angeles',
      venueMode: 'physical',
      location: 'Northwest Spot — Room B',
      capacity: '40',
      waitlist: 'disabled',
      instructors: ['Jordan Lee', 'jordan@example.com']
    });
    layoutAllNodes(draft);
    return draft;
  }

  function createCompanyTrainingDraft() {
    const draft = createDraft({ id: 'event-template-company-training' });
    const basicsId = addNodeByType(draft, NODE_TYPES.BASICS, false);
    const regId = addNodeByType(draft, NODE_TYPES.REGISTRATION, false);
    const sessionsId = addNodeByType(draft, NODE_TYPES.SESSIONS, false);
    const sessionA = addNodeByType(draft, NODE_TYPES.SESSION, false);
    const sessionB = addNodeByType(draft, NODE_TYPES.SESSION, false);
    draft.payloadByNodeId[basicsId] = {
      title: 'Company Onboarding Program',
      description: 'Role-based onboarding tracks for new hires across regions.',
      spot: 'Enterprise Hub'
    };
    draft.payloadByNodeId[regId] = { modes: ['approval-required', 'attendance-tracked'] };
    draft.payloadByNodeId[sessionsId] = { sessionIds: [sessionA, sessionB] };
    draft.payloadByNodeId[sessionA] = { title: 'Culture and Values' };
    draft.payloadByNodeId[sessionB] = { title: 'Tools and Security Basics' };
    seedSessionBranchData(draft, sessionA, {
      title: 'Culture and Values',
      date: '2026-04-02',
      startTime: '10:00',
      endTime: '11:00',
      timezone: 'America/New_York',
      venueMode: 'virtual',
      virtualLink: 'https://meet.example.com/onboarding-culture',
      capacity: '100',
      instructors: ['Alex Kim']
    });
    seedSessionBranchData(draft, sessionB, {
      title: 'Tools and Security Basics',
      date: '2026-04-02',
      startTime: '11:15',
      endTime: '12:15',
      timezone: 'America/New_York',
      venueMode: 'virtual',
      virtualLink: 'https://meet.example.com/onboarding-security',
      capacity: '100',
      instructors: ['Sam Patel', 'sam@example.com']
    });
    layoutAllNodes(draft);
    return draft;
  }

  function createProductTrainingDraft() {
    const draft = createDraft({ id: 'event-template-product-training' });
    const basicsId = addNodeByType(draft, NODE_TYPES.BASICS, false);
    const regId = addNodeByType(draft, NODE_TYPES.REGISTRATION, false);
    const instructorId = addNodeByType(draft, NODE_TYPES.INSTRUCTORS, false);
    const sessionsId = addNodeByType(draft, NODE_TYPES.SESSIONS, false);
    const sessionA = addNodeByType(draft, NODE_TYPES.SESSION, false);
    draft.payloadByNodeId[basicsId] = {
      title: 'Product Enablement Lab',
      description: 'Hands-on product training for customer-facing teams.',
      spot: 'Growth Lab'
    };
    draft.payloadByNodeId[regId] = { modes: ['open-registration'] };
    draft.payloadByNodeId[instructorId] = { entries: ['Jordan Lee', 'jordan@example.com'] };
    draft.payloadByNodeId[sessionsId] = { sessionIds: [sessionA] };
    draft.payloadByNodeId[sessionA] = { title: 'Demo Workflow Deep Dive' };
    seedSessionBranchData(draft, sessionA, {
      title: 'Demo Workflow Deep Dive',
      date: '2026-05-08',
      startTime: '13:00',
      endTime: '15:00',
      timezone: 'America/Chicago',
      venueMode: 'physical',
      location: 'Growth Lab — Studio 2',
      capacity: '24',
      instructors: ['Jordan Lee', 'jordan@example.com']
    });
    layoutAllNodes(draft);
    return draft;
  }

  const EVENT_TEMPLATES = [
    {
      id: 'sales-kickoff',
      label: 'Sales kickoff',
      description: 'Multi-track launch event with sessions and instructors.',
      createDraft: createSalesKickoffDraft
    },
    {
      id: 'company-training',
      label: 'Company training',
      description: 'Onboarding program with registration and session branches.',
      createDraft: createCompanyTrainingDraft
    },
    {
      id: 'product-training',
      label: 'Product training',
      description: 'Instructor-led enablement with focused session flow.',
      createDraft: createProductTrainingDraft
    }
  ];

  function getTemplateById(templateId) {
    return EVENT_TEMPLATES.find(function (template) { return template.id === templateId; }) || null;
  }

  function createTemplateDraft(templateId) {
    const template = getTemplateById(templateId);
    if (!template) return null;
    const draft = template.createDraft();
    draft.meta.templateId = templateId;
    draft.meta.templateChosen = true;
    return draft;
  }

  function createSampleDraft() {
    return createTemplateDraft('sales-kickoff');
  }

  function readStoredDraft() {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = safeParse(raw);
    if (!parsed || !parsed.nodes || !parsed.payloadByNodeId || !parsed.meta) return null;
    return parsed;
  }

  function setAlert(text, isError) {
    DOM.alert.textContent = text;
    DOM.alert.classList.remove('is-hidden');
    DOM.alert.style.borderColor = isError ? 'rgba(227, 137, 26, 0.65)' : 'rgba(51, 78, 92, 0.24)';
    DOM.alert.style.background = isError ? 'rgba(255, 227, 182, 0.35)' : 'rgba(230, 235, 240, 0.58)';
    DOM.alert.style.color = isError ? '#8b5208' : '#334E5C';
  }

  function clearAlert() {
    DOM.alert.classList.add('is-hidden');
    DOM.alert.textContent = '';
  }

  function clearToast() {
    if (toastTimeoutId) {
      window.clearTimeout(toastTimeoutId);
      toastTimeoutId = null;
    }

    if (toastDismissTimeoutId) {
      window.clearTimeout(toastDismissTimeoutId);
      toastDismissTimeoutId = null;
    }

    const host = document.querySelector('.event-admin-toast-host');
    if (host) host.remove();
  }

  function getToastHost() {
    let host = document.querySelector('.event-admin-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'event-admin-toast-host';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }

    return host;
  }

  function dismissToastElement(toast, host) {
    if (!toast || toast.classList.contains('is-dismissed')) return;

    if (toastTimeoutId) {
      window.clearTimeout(toastTimeoutId);
      toastTimeoutId = null;
    }

    if (toastDismissTimeoutId) {
      window.clearTimeout(toastDismissTimeoutId);
      toastDismissTimeoutId = null;
    }

    toast.classList.add('is-dismissed');
    toastDismissTimeoutId = window.setTimeout(function () {
      toast.remove();
      if (host && !host.childElementCount) host.remove();
      toastDismissTimeoutId = null;
    }, 280);
  }

  function showToast(text, durationMs) {
    const duration = typeof durationMs === 'number' ? durationMs : 5000;
    clearToast();

    const host = getToastHost();
    const toast = document.createElement('article');
    toast.className = 'home-insight-card event-admin-toast';
    toast.setAttribute('role', 'status');

    const message = document.createElement('p');
    message.textContent = text;

    const dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.className = 'event-admin-toast-dismiss';
    dismissButton.setAttribute('aria-label', 'Dismiss notification');
    dismissButton.textContent = '×';

    toast.appendChild(message);
    toast.appendChild(dismissButton);
    host.appendChild(toast);

    dismissButton.addEventListener('click', function () {
      dismissToastElement(toast, host);
    });

    toastTimeoutId = window.setTimeout(function () {
      dismissToastElement(toast, host);
    }, duration);
  }

  function saveDraft(manual) {
    if (!state.draft) return;
    state.draft.meta.lastSavedAt = Date.now();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.draft));
    if (manual) state.draft.meta.isDirty = false;
  }

  function getNodeById(nodeId) {
    return state.draft.nodes.find(function (node) { return node.id === nodeId; });
  }

  function startNodeDrag(nodeId, event) {
    const node = getNodeById(nodeId);
    if (!node) return;
    const point = getCanvasPointFromEvent(event);
    const origin = getGraphOrigin(state.draft);
    const display = toDisplayCoord(node.x, node.y, state.draft);
    state.nodeDrag = {
      nodeId: nodeId,
      offsetX: point.x - display.x,
      offsetY: point.y - display.y,
      originX: origin.x,
      originY: origin.y
    };
  }

  function moveNodeDrag(event) {
    if (!state.nodeDrag) return;
    const node = getNodeById(state.nodeDrag.nodeId);
    if (!node) return;
    const point = getCanvasPointFromEvent(event);
    node.x = point.x - state.nodeDrag.offsetX + state.nodeDrag.originX;
    node.y = point.y - state.nodeDrag.offsetY + state.nodeDrag.originY;
    if (node.type === NODE_TYPES.SESSION) layoutSessionGroup(state.draft, node.id);
    const display = toDisplayCoord(node.x, node.y, state.draft);
    const nodeEl = DOM.canvas.querySelector(`[data-node-id="${node.id}"]`);
    if (nodeEl) {
      nodeEl.style.left = `${display.x}px`;
      nodeEl.style.top = `${display.y}px`;
    }
    if (node.type === NODE_TYPES.SESSION || node.parentSessionId) renderCanvas();
    drawCanvasEdges();
  }

  function finishNodeDrag() {
    if (!state.nodeDrag) return;
    state.nodeDrag = null;
    updateGraphBounds(state.draft);
    refreshEdgePorts(state.draft);
    renderCanvas();
    markDirty();
  }

  function startEdgeDrag(fromNodeId, fromPort, event) {
    const point = getCanvasPointFromEvent(event);
    state.edgeDrag = {
      fromNodeId: fromNodeId,
      fromPort: fromPort || DEFAULT_FROM_PORT,
      currentX: point.x,
      currentY: point.y
    };
    drawCanvasEdges();
  }

  function moveEdgeDrag(event) {
    if (!state.edgeDrag) return;
    const point = getCanvasPointFromEvent(event);
    state.edgeDrag.currentX = point.x;
    state.edgeDrag.currentY = point.y;
    drawCanvasEdges();
  }

  function finishEdgeDrag(targetNodeId, toPort, event) {
    if (!state.edgeDrag) return;
    const fromId = state.edgeDrag.fromNodeId;
    const fromPort = state.edgeDrag.fromPort;
    state.edgeDrag = null;

    let targetId = targetNodeId;
    let targetPortSide = toPort;

    if ((!targetId || !targetPortSide) && event) {
      const point = getCanvasPointFromEvent(event);
      const snap = findSnapPortAtPoint(point.x, point.y, fromId);
      if (snap) {
        targetId = snap.nodeId;
        targetPortSide = snap.portSide;
      }
    }

    if (!targetId || targetId === fromId || !targetPortSide) {
      drawCanvasEdges();
      showToast('Release on another node handle to connect.', 4000);
      return;
    }

    addManualEdge(state.draft, fromId, targetId, fromPort, targetPortSide);
    state.selectedEdgeKey = `${fromId}->${targetId}`;
    state.selectedNodeId = null;
    markDirty();
    renderAll();
    showToast(`Connected ${getNodeLabelById(state.draft, fromId)} → ${getNodeLabelById(state.draft, targetId)}.`, 4000);
  }

  function startPanDrag(event) {
    state.panDrag = {
      startX: event.clientX,
      startY: event.clientY,
      originX: state.canvasView.panX,
      originY: state.canvasView.panY
    };
  }

  function movePanDrag(event) {
    if (!state.panDrag) return;
    state.canvasView.panX = state.panDrag.originX + (event.clientX - state.panDrag.startX);
    state.canvasView.panY = state.panDrag.originY + (event.clientY - state.panDrag.startY);
    applyCanvasTransform();
    drawCanvasEdges();
  }

  function finishPanDrag() {
    state.panDrag = null;
  }

  function markDirty() {
    if (!state.draft) return;
    state.draft.meta.isDirty = true;
    if (state.draft.meta) {
      state.draft.meta.removedAutoEdges = state.removedAutoEdges;
    }
    saveDraft(false);
    renderSummary();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cleanText(value) {
    return String(value || '').replace(/^[\s\u200B-\u200D\uFEFF]+|[\s\u200B-\u200D\uFEFF]+$/g, '');
  }

  function makeNodeId(type) {
    return `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  function createSessionChildPayload(type) {
    if (type === NODE_TYPES.SESSION_BASICS) return { title: '', summary: '', track: '' };
    if (type === NODE_TYPES.SESSION_SCHEDULE) return { date: '', startTime: '', endTime: '', timezone: '' };
    if (type === NODE_TYPES.SESSION_VENUE) return { venueMode: '', location: '', virtualLink: '' };
    if (type === NODE_TYPES.SESSION_CAPACITY) return { capacity: '', waitlist: 'disabled' };
    if (type === NODE_TYPES.SESSION_INSTRUCTORS) return { entries: [] };
    if (type === NODE_TYPES.SESSION_MATERIALS) return { resources: [] };
    if (type === NODE_TYPES.SESSION_REG_RULES) return { overrideMode: '', notes: '' };
    if (type === NODE_TYPES.SESSION_PUBLISH_CHECKS) return { status: 'pending', notes: '' };
    return {};
  }

  function syncSessionIndex(draft) {
    const sessionsContainerId = findSingletonNodeId(draft, NODE_TYPES.SESSIONS);
    const sessionIds = draft.nodes
      .filter(function (node) { return node.type === NODE_TYPES.SESSION; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
      .map(function (node) { return node.id; });

    draft.sessions = sessionIds.slice();
    draft.sessionMap = {};
    sessionIds.forEach(function (sessionId, index) {
      draft.sessionMap[sessionId] = { order: index + 1, childIds: getSessionChildNodes(draft, sessionId).map(function (node) { return node.id; }) };
    });

    if (sessionsContainerId) {
      const payload = draft.payloadByNodeId[sessionsContainerId] || { sessionIds: [] };
      payload.sessionIds = sessionIds;
      draft.payloadByNodeId[sessionsContainerId] = payload;
    }
  }

  function layoutRootNodes(draft) {
    const rootNodes = draft.nodes.filter(function (node) {
      return !node.parentSessionId && !isSessionChildType(node.type);
    });
    rootNodes.forEach(function (node, index) {
      if (typeof node.x !== 'number') node.x = 48;
      if (typeof node.y !== 'number') node.y = 48 + (index * 112);
    });
  }

  function layoutSessionGroup(draft, sessionId) {
    const sessionNode = draft.nodes.find(function (node) { return node.id === sessionId; });
    if (!sessionNode) return;

    const sessionIndex = draft.sessions.indexOf(sessionId);
    const baseX = 320;
    const baseY = 48 + (Math.max(sessionIndex, 0) * 420);

    if (typeof sessionNode.x !== 'number') sessionNode.x = baseX;
    if (typeof sessionNode.y !== 'number') sessionNode.y = baseY;

    const childNodes = getSessionChildNodes(draft, sessionId);
    childNodes.forEach(function (child, childIndex) {
      if (typeof child.x !== 'number') child.x = baseX + 248;
      if (typeof child.y !== 'number') child.y = baseY + (childIndex * 72);
    });
  }

  function layoutAllNodes(draft) {
    syncSessionIndex(draft);
    layoutRootNodes(draft);
    draft.sessions.forEach(function (sessionId) { layoutSessionGroup(draft, sessionId); });
    updateGraphBounds(draft);
  }

  function getGraphOrigin(draft) {
    const target = draft || state.draft;
    if (!target || !target.meta) return { x: 0, y: 0 };
    return {
      x: typeof target.meta.graphOriginX === 'number' ? target.meta.graphOriginX : 0,
      y: typeof target.meta.graphOriginY === 'number' ? target.meta.graphOriginY : 0
    };
  }

  function toDisplayCoord(x, y, draft) {
    const origin = getGraphOrigin(draft);
    return {
      x: (x || 0) - origin.x,
      y: (y || 0) - origin.y
    };
  }

  function updateGraphBounds(draft) {
    let minX = 0;
    let minY = 0;
    let maxX = 640;
    let maxY = 480;
    const padding = 48;
    draft.nodes.forEach(function (node) {
      const width = isSessionChildType(node.type) ? CANVAS_CHILD_WIDTH : CANVAS_NODE_WIDTH;
      const height = isSessionChildType(node.type) ? CANVAS_CHILD_HEIGHT : CANVAS_NODE_HEIGHT;
      const x = node.x || 0;
      const y = node.y || 0;
      minX = Math.min(minX, x - padding);
      minY = Math.min(minY, y - padding);
      maxX = Math.max(maxX, x + width + padding);
      maxY = Math.max(maxY, y + height + padding);
    });
    draft.meta.graphOriginX = minX;
    draft.meta.graphOriginY = minY;
    draft.meta.graphWidth = maxX - minX;
    draft.meta.graphHeight = maxY - minY;
  }

  function ensureSessionBranch(draft, sessionId) {
    const existingChildren = getSessionChildNodes(draft, sessionId);
    if (existingChildren.length >= SESSION_CHILD_DEFS.length) return;

    SESSION_CHILD_DEFS.forEach(function (def, index) {
      const already = existingChildren.find(function (node) { return node.type === def.type; });
      if (already) return;

      const childId = makeNodeId(def.type);
      draft.nodes.push({
        id: childId,
        type: def.type,
        label: cleanText(def.label),
        helper: '',
        required: def.required,
        parentSessionId: sessionId,
        order: index + 1
      });
      draft.payloadByNodeId[childId] = createSessionChildPayload(def.type);
      addEdgeIfMissing(draft, sessionId, childId, true);
    });

    layoutSessionGroup(draft, sessionId);
    syncSessionIndex(draft);
  }

  function seedSessionBranchData(draft, sessionId, data) {
    ensureSessionBranch(draft, sessionId);
    getSessionChildNodes(draft, sessionId).forEach(function (child) {
      const payload = draft.payloadByNodeId[child.id] || {};
      if (child.type === NODE_TYPES.SESSION_BASICS) {
        payload.title = data.title || payload.title;
        payload.summary = data.summary || payload.summary;
        payload.track = data.track || payload.track;
      }
      if (child.type === NODE_TYPES.SESSION_SCHEDULE) {
        payload.date = data.date || payload.date;
        payload.startTime = data.startTime || payload.startTime;
        payload.endTime = data.endTime || payload.endTime;
        payload.timezone = data.timezone || payload.timezone;
      }
      if (child.type === NODE_TYPES.SESSION_VENUE) {
        payload.venueMode = data.venueMode || payload.venueMode;
        payload.location = data.location || payload.location;
        payload.virtualLink = data.virtualLink || payload.virtualLink;
      }
      if (child.type === NODE_TYPES.SESSION_CAPACITY) {
        payload.capacity = data.capacity || payload.capacity;
        payload.waitlist = data.waitlist || payload.waitlist;
      }
      if (child.type === NODE_TYPES.SESSION_INSTRUCTORS && data.instructors) {
        payload.entries = data.instructors.slice();
      }
      draft.payloadByNodeId[child.id] = payload;
    });

    const publishChild = getSessionChildNodes(draft, sessionId).find(function (node) {
      return node.type === NODE_TYPES.SESSION_PUBLISH_CHECKS;
    });
    if (publishChild) {
      draft.payloadByNodeId[publishChild.id] = { status: 'ready', notes: 'Template seed complete.' };
    }
  }

  function migrateDraft(draft) {
    if (!draft.sessions) draft.sessions = [];
    if (!draft.sessionMap) draft.sessionMap = {};
    if (!draft.conflicts) draft.conflicts = [];
    if (!draft.publishChecklist) draft.publishChecklist = { blockers: [], warnings: [] };

    draft.nodes.forEach(function (node) {
      if (typeof node.x !== 'number' || typeof node.y !== 'number') {
        node.x = undefined;
        node.y = undefined;
      }
    });

    draft.nodes
      .filter(function (node) { return node.type === NODE_TYPES.SESSION; })
      .forEach(function (sessionNode) { ensureSessionBranch(draft, sessionNode.id); });

    layoutAllNodes(draft);
    syncDefaultEdges(draft);
    refreshEdgePorts(draft);
  }

  function updateTemplateGalleryVisibility() {
    if (!DOM.templateGallery || !state.draft) return;
    if (state.draft.nodes.length > 0 || state.draft.meta.templateChosen) hideTemplateGallery();
    else showTemplateGallery();
  }

  function updateCanvasZoomLabel() {
    if (!DOM.zoomLabel) return;
    DOM.zoomLabel.textContent = `${Math.round(state.canvasView.scale * 100)}%`;
  }

  function applyCanvasTransform() {
    const viewport = DOM.canvas.querySelector('#event-canvas-viewport');
    if (!viewport) return;
    viewport.style.transform = `translate(${state.canvasView.panX}px, ${state.canvasView.panY}px) scale(${state.canvasView.scale})`;
    updateCanvasZoomLabel();
  }

  function getCanvasContainerPoint(clientX, clientY) {
    const rect = DOM.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function panCanvasBy(deltaX, deltaY) {
    state.canvasView.panX += deltaX;
    state.canvasView.panY += deltaY;
  }

  function zoomCanvasAt(clientX, clientY, deltaScale) {
    const point = getCanvasContainerPoint(clientX, clientY);
    const oldScale = state.canvasView.scale;
    const newScale = Math.max(0.5, Math.min(1.6, oldScale + deltaScale));
    if (newScale === oldScale) return;
    const ratio = newScale / oldScale;
    state.canvasView.panX = point.x - (point.x - state.canvasView.panX) * ratio;
    state.canvasView.panY = point.y - (point.y - state.canvasView.panY) * ratio;
    state.canvasView.scale = newScale;
  }

  function setCanvasZoom(nextScale) {
    state.canvasView.scale = Math.max(0.5, Math.min(1.6, nextScale));
    applyCanvasTransform();
    drawCanvasEdges();
  }

  function resetCanvasView() {
    state.canvasView = { scale: 1, panX: 0, panY: 0 };
    applyCanvasTransform();
    drawCanvasEdges();
  }

  function fitCanvasToGraph() {
    if (!state.draft || !state.draft.nodes.length) return;
    layoutAllNodes(state.draft);
    const padding = 32;
    const graphWidth = state.draft.meta.graphWidth || 960;
    const graphHeight = state.draft.meta.graphHeight || 720;
    const viewWidth = Math.max(1, DOM.canvas.clientWidth);
    const viewHeight = Math.max(1, DOM.canvas.clientHeight);
    const scaleX = (viewWidth - (padding * 2)) / graphWidth;
    const scaleY = (viewHeight - (padding * 2)) / graphHeight;
    const scale = Math.max(0.5, Math.min(1.6, Math.min(scaleX, scaleY, 1)));
    state.canvasView.scale = scale;
    state.canvasView.panX = Math.max(padding, (viewWidth - (graphWidth * scale)) / 2);
    state.canvasView.panY = padding;
    applyCanvasTransform();
    drawCanvasEdges();
  }

  function setSpacePanActive(isActive) {
    state.spacePanActive = isActive;
    DOM.canvas.classList.toggle('is-space-pan', isActive);
  }

  function getCanvasPointFromEvent(event) {
    const graph = DOM.canvas.querySelector('#event-canvas-graph');
    if (!graph) return { x: 0, y: 0 };
    const rect = graph.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / state.canvasView.scale,
      y: (event.clientY - rect.top) / state.canvasView.scale
    };
  }

  function createNodePayload(type, nodeId, draft) {
    if (type === NODE_TYPES.BASICS) return { title: '', description: '', spot: '' };
    if (type === NODE_TYPES.REGISTRATION) return { modes: [] };
    if (type === NODE_TYPES.BANNER) return { fileName: '', fileType: '', fileSize: 0 };
    if (type === NODE_TYPES.INSTRUCTORS) return { entries: [] };
    if (type === NODE_TYPES.SESSIONS) return { sessionIds: [] };
    if (type === NODE_TYPES.SESSION) return { title: `Session ${countNodesOfType(draft, NODE_TYPES.SESSION) + 1}` };
    if (isSessionChildType(type)) return createSessionChildPayload(type);
    return {};
  }

  function countNodesOfType(draft, type) {
    return draft.nodes.filter(function (node) { return node.type === type; }).length;
  }

  function findSingletonNodeId(draft, type) {
    const found = draft.nodes.find(function (node) { return node.type === type; });
    return found ? found.id : null;
  }

  function getNodeDimensions(node) {
    const isChild = isSessionChildType(node.type);
    return {
      width: isChild ? CANVAS_CHILD_WIDTH : CANVAS_NODE_WIDTH,
      height: isChild ? CANVAS_CHILD_HEIGHT : CANVAS_NODE_HEIGHT
    };
  }

  function normalizePortSide(side) {
    return PORT_SIDES.indexOf(side) > -1 ? side : null;
  }

  function getNodeCenter(node) {
    const dims = getNodeDimensions(node);
    return {
      x: (node.x || 0) + (dims.width / 2),
      y: (node.y || 0) + (dims.height / 2)
    };
  }

  function getNodePortPoint(node, side) {
    const dims = getNodeDimensions(node);
    const display = toDisplayCoord(node.x, node.y);
    const x = display.x;
    const y = display.y;
    const port = normalizePortSide(side) || DEFAULT_FROM_PORT;

    if (port === 'top') return { x: x + (dims.width / 2), y: y, side: port };
    if (port === 'bottom') return { x: x + (dims.width / 2), y: y + dims.height, side: port };
    if (port === 'left') return { x: x, y: y + (dims.height / 2), side: port };
    return { x: x + dims.width, y: y + (dims.height / 2), side: 'right' };
  }

  function getBestEdgePorts(fromNode, toNode) {
    const fromCenter = getNodeCenter(fromNode);
    const toCenter = getNodeCenter(toNode);
    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx > absDy + 4) {
      if (dx >= 0) return { fromPort: 'right', toPort: 'left' };
      return { fromPort: 'left', toPort: 'right' };
    }

    if (dy >= 0) return { fromPort: 'bottom', toPort: 'top' };
    return { fromPort: 'top', toPort: 'bottom' };
  }

  function resolveEdgePorts(edge, fromNode, toNode) {
    if (edge.manual && edge.fromPort && edge.toPort) {
      return {
        fromPort: normalizePortSide(edge.fromPort) || DEFAULT_FROM_PORT,
        toPort: normalizePortSide(edge.toPort) || DEFAULT_TO_PORT
      };
    }
    return getBestEdgePorts(fromNode, toNode);
  }

  function refreshEdgePorts(draft, singleEdge) {
    if (!draft || !draft.edges) return;

    draft.edges.forEach(function (edge) {
      if (singleEdge && edge !== singleEdge) return;
      if (edge.manual) return;

      const fromNode = draft.nodes.find(function (node) { return node.id === edge.from; });
      const toNode = draft.nodes.find(function (node) { return node.id === edge.to; });

      if (!fromNode || !toNode) {
        edge.fromPort = edge.fromPort || DEFAULT_FROM_PORT;
        edge.toPort = edge.toPort || DEFAULT_TO_PORT;
        return;
      }

      const best = getBestEdgePorts(fromNode, toNode);
      edge.fromPort = best.fromPort;
      edge.toPort = best.toPort;
    });
  }

  function getEdgeKey(edge) {
    return `${edge.from}->${edge.to}`;
  }

  function findEdgeByKey(draft, edgeKey) {
    return draft.edges.find(function (edge) { return getEdgeKey(edge) === edgeKey; }) || null;
  }

  function getNodeLabelById(draft, nodeId) {
    const node = draft.nodes.find(function (item) { return item.id === nodeId; });
    return node ? cleanText(node.label) : 'Node';
  }

  function findSnapPortAtPoint(x, y, excludeNodeId) {
    if (!state.draft) return null;
    let match = null;
    let bestDistance = PORT_SNAP_RADIUS;

    state.draft.nodes.forEach(function (node) {
      if (node.id === excludeNodeId) return;
      PORT_SIDES.forEach(function (side) {
        const portPoint = getNodePortPoint(node, side);
        const distance = Math.hypot(portPoint.x - x, portPoint.y - y);
        if (distance < bestDistance) {
          bestDistance = distance;
          match = { nodeId: node.id, portSide: side };
        }
      });
    });

    return match;
  }

  function removeEdgeByKey(edgeKey) {
    const edge = findEdgeByKey(state.draft, edgeKey);
    if (!edge) return false;

    if (!edge.manual) {
      state.removedAutoEdges[edgeKey] = true;
    }

    state.draft.edges = state.draft.edges.filter(function (item) {
      return getEdgeKey(item) !== edgeKey;
    });
    state.selectedEdgeKey = null;
    markDirty();
    renderAll();
    showToast('Connection removed.', 4000);
    return true;
  }

  function isAutoEdgeSuppressed(from, to) {
    return Boolean(state.removedAutoEdges[`${from}->${to}`]);
  }

  function buildEdgePath(x1, y1, fromPort, x2, y2, toPort) {
    const offset = Math.max(28, Math.abs(x2 - x1) * 0.25, Math.abs(y2 - y1) * 0.25);
    let c1x = x1;
    let c1y = y1;
    let c2x = x2;
    let c2y = y2;

    if (fromPort === 'top') c1y -= offset;
    else if (fromPort === 'bottom') c1y += offset;
    else if (fromPort === 'left') c1x -= offset;
    else if (fromPort === 'right') c1x += offset;

    if (toPort === 'top') c2y -= offset;
    else if (toPort === 'bottom') c2y += offset;
    else if (toPort === 'left') c2x -= offset;
    else if (toPort === 'right') c2x += offset;

    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
  }

  function backfillEdgePorts(draft, edge) {
    refreshEdgePorts(draft, edge || null);
  }

  function addEdgeIfMissing(draft, from, to, manual, portOptions) {
    const opts = portOptions || {};
    const existing = draft.edges.find(function (edge) { return edge.from === from && edge.to === to; });

    if (existing) {
      if (!existing.manual) refreshEdgePorts(draft, existing);
      return;
    }

    const fromNode = draft.nodes.find(function (node) { return node.id === from; });
    const toNode = draft.nodes.find(function (node) { return node.id === to; });
    let fromPort = normalizePortSide(opts.fromPort);
    let toPort = normalizePortSide(opts.toPort);

    if (!fromPort || !toPort) {
      const best = fromNode && toNode ? getBestEdgePorts(fromNode, toNode) : { fromPort: DEFAULT_FROM_PORT, toPort: DEFAULT_TO_PORT };
      fromPort = fromPort || best.fromPort;
      toPort = toPort || best.toPort;
    }

    draft.edges.push({
      from: from,
      to: to,
      manual: Boolean(manual),
      fromPort: fromPort,
      toPort: toPort
    });
  }

  function addManualEdge(draft, from, to, fromPort, toPort) {
    const edgeKey = `${from}->${to}`;
    const existing = draft.edges.find(function (edge) { return edge.from === from && edge.to === to; });

    if (existing) {
      existing.manual = true;
      existing.fromPort = normalizePortSide(fromPort) || existing.fromPort || DEFAULT_FROM_PORT;
      existing.toPort = normalizePortSide(toPort) || existing.toPort || DEFAULT_TO_PORT;
      delete state.removedAutoEdges[edgeKey];
      return;
    }

    delete state.removedAutoEdges[edgeKey];
    draft.edges.push({
      from: from,
      to: to,
      manual: true,
      fromPort: normalizePortSide(fromPort) || DEFAULT_FROM_PORT,
      toPort: normalizePortSide(toPort) || DEFAULT_TO_PORT
    });
  }

  function syncDefaultEdges(targetDraft) {
    const draft = targetDraft || state.draft;
    if (!draft) return;
    const basics = findSingletonNodeId(draft, NODE_TYPES.BASICS);
    const reg = findSingletonNodeId(draft, NODE_TYPES.REGISTRATION);
    const banner = findSingletonNodeId(draft, NODE_TYPES.BANNER);
    const instructors = findSingletonNodeId(draft, NODE_TYPES.INSTRUCTORS);
    const sessions = findSingletonNodeId(draft, NODE_TYPES.SESSIONS);

    function addAutoEdge(from, to) {
      if (!from || !to || isAutoEdgeSuppressed(from, to)) return;
      addEdgeIfMissing(draft, from, to, false);
    }

    addAutoEdge(basics, reg);
    addAutoEdge(reg, banner);
    addAutoEdge(banner, instructors);
    addAutoEdge(instructors, sessions);

    if (sessions) {
      syncSessionIndex(draft);
      draft.sessions.forEach(function (sessionId) {
        addAutoEdge(sessions, sessionId);
        getSessionChildNodes(draft, sessionId).forEach(function (child) {
          addAutoEdge(sessionId, child.id);
        });
      });
    }
  }

  function addNodeByType(targetDraft, type, shouldSelect) {
    const draft = targetDraft || state.draft;
    if (SINGLETON_TYPES.indexOf(type) > -1) {
      const existing = findSingletonNodeId(draft, type);
      if (existing) {
        if (shouldSelect !== false) state.selectedNodeId = existing;
        return existing;
      }
    }

    if (type === NODE_TYPES.SESSION && !findSingletonNodeId(draft, NODE_TYPES.SESSIONS)) {
      if (targetDraft === state.draft) setAlert('Drop a Sessions Container node before adding Session nodes.', true);
      return null;
    }

    const definition = getNodeDefinition(type);
    const nodeId = makeNodeId(type);
    const dropPoint = state.pendingDropPoint;
    const newNode = {
      id: nodeId,
      type: type,
      label: definition ? cleanText(definition.label) : cleanText(type),
      helper: definition ? cleanText(definition.helper) : '',
      required: definition ? definition.required : false,
      order: draft.nodes.length + 1
    };

    if (dropPoint && !isSessionChildType(type)) {
      const origin = getGraphOrigin(draft);
      newNode.x = dropPoint.x - (CANVAS_NODE_WIDTH / 2) + origin.x;
      newNode.y = dropPoint.y - 24 + origin.y;
    }

    draft.nodes.push(newNode);
    draft.payloadByNodeId[nodeId] = createNodePayload(type, nodeId, draft);

    if (type === NODE_TYPES.SESSION) {
      ensureSessionBranch(draft, nodeId);
      draft.meta.templateChosen = true;
    }

    syncDefaultEdges(draft);
    layoutAllNodes(draft);
    state.pendingDropPoint = null;

    if (shouldSelect !== false) state.selectedNodeId = nodeId;
    return nodeId;
  }

  function removeSessionBranch(sessionId) {
    const childIds = getSessionChildNodes(state.draft, sessionId).map(function (node) { return node.id; });
    state.draft.nodes = state.draft.nodes.filter(function (item) {
      return item.id !== sessionId && childIds.indexOf(item.id) === -1;
    });
    state.draft.edges = state.draft.edges.filter(function (edge) {
      return edge.from !== sessionId && edge.to !== sessionId && childIds.indexOf(edge.from) === -1 && childIds.indexOf(edge.to) === -1;
    });
    childIds.concat([sessionId]).forEach(function (id) { delete state.draft.payloadByNodeId[id]; });
  }

  function removeNode(nodeId) {
    const node = state.draft.nodes.find(function (item) { return item.id === nodeId; });
    if (!node) return;
    if (isSessionChildType(node.type)) {
      setAlert('Session child nodes stay attached to their session branch.', true);
      return;
    }
    if (node.type === NODE_TYPES.SESSIONS && countNodesOfType(state.draft, NODE_TYPES.SESSION) > 0) {
      setAlert('Remove Session nodes before removing the Sessions Container.', true);
      return;
    }
    if (node.type === NODE_TYPES.SESSION) {
      removeSessionBranch(nodeId);
    } else {
      state.draft.nodes = state.draft.nodes.filter(function (item) { return item.id !== nodeId; });
      state.draft.edges = state.draft.edges.filter(function (edge) { return edge.from !== nodeId && edge.to !== nodeId; });
      delete state.draft.payloadByNodeId[nodeId];
    }
    if (state.selectedNodeId === nodeId) state.selectedNodeId = null;
    syncDefaultEdges();
    layoutAllNodes(state.draft);
    markDirty();
    updateTemplateGalleryVisibility();
    renderAll();
  }

  function duplicateSession(sessionId) {
    const sourceNode = state.draft.nodes.find(function (node) { return node.id === sessionId; });
    if (!sourceNode) return;
    const newSessionId = addNodeByType(state.draft, NODE_TYPES.SESSION, false);
    const sourcePayload = state.draft.payloadByNodeId[sessionId] || {};
    state.draft.payloadByNodeId[newSessionId] = {
      title: `${sourcePayload.title || 'Session'} (Copy)`
    };

    getSessionChildNodes(state.draft, sessionId).forEach(function (child) {
      const targetChild = getSessionChildNodes(state.draft, newSessionId).find(function (node) { return node.type === child.type; });
      if (!targetChild) return;
      state.draft.payloadByNodeId[targetChild.id] = JSON.parse(JSON.stringify(state.draft.payloadByNodeId[child.id] || {}));
      if (targetChild.type === NODE_TYPES.SESSION_BASICS) {
        state.draft.payloadByNodeId[targetChild.id].title = `${state.draft.payloadByNodeId[targetChild.id].title || 'Session'} (Copy)`;
      }
    });

    layoutAllNodes(state.draft);
    state.selectedNodeId = newSessionId;
    markDirty();
    renderAll();
  }

  function reorderSession(sessionId, direction) {
    const index = state.draft.sessions.indexOf(sessionId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= state.draft.sessions.length) return;
    const next = state.draft.sessions.slice();
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    state.draft.sessions = next;
    syncSessionIndex(state.draft);
    layoutAllNodes(state.draft);
    markDirty();
    renderAll();
  }

  function jumpToIncompleteSession() {
    const incomplete = state.draft.sessions
      .map(function (sessionId) {
        return state.draft.nodes.find(function (node) { return node.id === sessionId; });
      })
      .find(function (sessionNode) {
        return getSessionChildNodes(state.draft, sessionNode.id).some(function (child) {
          return validateNode(child).errors.length;
        });
      });

    if (!incomplete) {
      showToast('All session branches pass required checks.', 4000);
      return;
    }

    const firstBroken = getSessionChildNodes(state.draft, incomplete.id).find(function (child) {
      return validateNode(child).errors.length;
    });
    state.selectedNodeId = firstBroken ? firstBroken.id : incomplete.id;
    state.attemptedNodeIds[state.selectedNodeId] = true;
    renderAll();
  }

  function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validateNode(node) {
    const payload = state.draft.payloadByNodeId[node.id] || {};
    const errors = [];
    const warnings = [];
    let hasContent = false;

    if (node.type === NODE_TYPES.BASICS) {
      hasContent = hasText(payload.title) || hasText(payload.description) || hasText(payload.spot);
      if (!hasText(payload.title)) errors.push('Title is required.');
      if (!hasText(payload.spot)) errors.push('Spot is required.');
      if ((payload.description || '').length > 280) warnings.push('Description is longer than recommended.');
    }

    if (node.type === NODE_TYPES.REGISTRATION) {
      hasContent = Boolean(payload.modes && payload.modes.length);
      if (!hasContent) errors.push('Choose at least one mode.');
    }

    if (node.type === NODE_TYPES.BANNER) {
      hasContent = hasText(payload.fileName);
      if (payload.fileSize > MAX_BANNER_BYTES) errors.push('Banner must be <= 5MB.');
      if (!hasContent) warnings.push('Banner is optional but recommended.');
    }

    if (node.type === NODE_TYPES.INSTRUCTORS) {
      const entries = payload.entries || [];
      hasContent = entries.length > 0;
      entries.forEach(function (entry) {
        if (entry.indexOf('@') > -1 && !isEmail(entry)) errors.push(`Invalid email: ${entry}`);
      });
    }

    if (node.type === NODE_TYPES.SESSIONS) {
      const sessions = payload.sessionIds || [];
      hasContent = sessions.length > 0;
      if (!sessions.length) errors.push('At least one Session node is required.');
    }

    if (node.type === NODE_TYPES.SESSION) {
      hasContent = hasText(payload.title);
      if (!hasContent) warnings.push('Session title is recommended for handoff.');
      const childErrors = getSessionChildNodes(state.draft, node.id).some(function (child) {
        return validateNode(child).errors.length;
      });
      if (childErrors) warnings.push('One or more session child nodes need attention.');
    }

    if (node.type === NODE_TYPES.SESSION_BASICS) {
      hasContent = hasText(payload.title);
      if (!hasText(payload.title)) errors.push('Session title is required.');
    }

    if (node.type === NODE_TYPES.SESSION_SCHEDULE) {
      hasContent = hasText(payload.date) || hasText(payload.startTime) || hasText(payload.endTime) || hasText(payload.timezone);
      if (!hasText(payload.date)) errors.push('Session date is required.');
      if (!hasText(payload.startTime) || !hasText(payload.endTime)) errors.push('Start and end times are required.');
      if (!hasText(payload.timezone)) errors.push('Timezone is required.');
      if (hasText(payload.startTime) && hasText(payload.endTime) && payload.endTime <= payload.startTime) {
        errors.push('End time must be after start time.');
      }
    }

    if (node.type === NODE_TYPES.SESSION_VENUE) {
      hasContent = hasText(payload.venueMode);
      if (!hasText(payload.venueMode)) errors.push('Choose a venue mode.');
      if (payload.venueMode === 'physical' && !hasText(payload.location)) errors.push('Physical location is required.');
      if (payload.venueMode === 'virtual' && !hasText(payload.virtualLink)) errors.push('Virtual link is required.');
    }

    if (node.type === NODE_TYPES.SESSION_CAPACITY) {
      hasContent = hasText(payload.capacity);
      if (!hasText(payload.capacity)) errors.push('Seat limit is required.');
    }

    if (node.type === NODE_TYPES.SESSION_INSTRUCTORS) {
      const entries = payload.entries || [];
      hasContent = entries.length > 0;
      if (!entries.length) errors.push('At least one instructor is required.');
      entries.forEach(function (entry) {
        if (entry.indexOf('@') > -1 && !isEmail(entry)) errors.push(`Invalid email: ${entry}`);
      });
    }

    if (node.type === NODE_TYPES.SESSION_PUBLISH_CHECKS) {
      hasContent = payload.status === 'ready';
      const childNodes = node.parentSessionId ? getSessionChildNodes(state.draft, node.parentSessionId) : [];
      const blockers = childNodes.filter(function (child) {
        return child.type !== NODE_TYPES.SESSION_PUBLISH_CHECKS && validateNode(child).errors.length;
      });
      if (blockers.length) errors.push('Resolve session blockers before publish checks pass.');
      else hasContent = true;
    }

    return { errors: errors, warnings: warnings, hasContent: hasContent };
  }

  function getSessionChildPayload(draft, sessionId, type) {
    const child = draft.nodes.find(function (node) {
      return node.parentSessionId === sessionId && node.type === type;
    });
    if (!child) {
      if (type === NODE_TYPES.SESSION_INSTRUCTORS) return { entries: [] };
      return {};
    }
    return draft.payloadByNodeId[child.id] || (type === NODE_TYPES.SESSION_INSTRUCTORS ? { entries: [] } : {});
  }

  function getSessionSchedulePayload(sessionId, draft) {
    return getSessionChildPayload(draft || state.draft, sessionId, NODE_TYPES.SESSION_SCHEDULE);
  }

  function getSessionVenuePayload(sessionId, draft) {
    return getSessionChildPayload(draft || state.draft, sessionId, NODE_TYPES.SESSION_VENUE);
  }

  function getSessionInstructorsPayload(sessionId, draft) {
    return getSessionChildPayload(draft || state.draft, sessionId, NODE_TYPES.SESSION_INSTRUCTORS);
  }

  function getSessionBasicsPayload(sessionId, draft) {
    return getSessionChildPayload(draft || state.draft, sessionId, NODE_TYPES.SESSION_BASICS);
  }

  function schedulesOverlap(a, b) {
    if (!a.date || !b.date || a.date !== b.date) return false;
    if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) return false;
    return a.startTime < b.endTime && b.startTime < a.endTime;
  }

  function computeConflicts(draft) {
    const conflicts = [];
    const sessions = draft.sessions || [];
    const titles = {};

    sessions.forEach(function (sessionId) {
      const basics = getSessionBasicsPayload(sessionId, draft);
      const normalizedTitle = (basics.title || '').trim().toLowerCase();
      if (normalizedTitle) {
        titles[normalizedTitle] = titles[normalizedTitle] || [];
        titles[normalizedTitle].push(sessionId);
      }
    });

    Object.keys(titles).forEach(function (title) {
      if (titles[title].length > 1) {
        conflicts.push({
          type: 'warning',
          message: `Duplicate session title "${title}" appears ${titles[title].length} times.`
        });
      }
    });

    for (let i = 0; i < sessions.length; i += 1) {
      for (let j = i + 1; j < sessions.length; j += 1) {
        const leftId = sessions[i];
        const rightId = sessions[j];
        const leftSchedule = getSessionSchedulePayload(leftId, draft);
        const rightSchedule = getSessionSchedulePayload(rightId, draft);
        if (!schedulesOverlap(leftSchedule, rightSchedule)) continue;

        const leftVenue = getSessionVenuePayload(leftId, draft);
        const rightVenue = getSessionVenuePayload(rightId, draft);
        const leftInstructors = getSessionInstructorsPayload(leftId, draft).entries || [];
        const rightInstructors = getSessionInstructorsPayload(rightId, draft).entries || [];

        if (leftVenue.venueMode === 'physical' && rightVenue.venueMode === 'physical' &&
            hasText(leftVenue.location) && leftVenue.location === rightVenue.location) {
          conflicts.push({
            type: 'error',
            message: `Venue collision: "${leftVenue.location}" is double-booked.`
          });
        }

        leftInstructors.forEach(function (leftEntry) {
          if (rightInstructors.indexOf(leftEntry) > -1) {
            conflicts.push({
              type: 'error',
              message: `Instructor "${leftEntry}" is double-booked across overlapping sessions.`
            });
          }
        });
      }
    }

    draft.conflicts = conflicts;
    return conflicts;
  }

  function computePublishChecklist(draft) {
    const blockers = [];
    const warnings = [];

    draft.nodes.filter(function (node) { return node.required && !isSessionChildType(node.type); }).forEach(function (node) {
      validateNode(node).errors.forEach(function (error) {
        blockers.push(`${node.label}: ${error}`);
      });
    });

    (draft.sessions || []).forEach(function (sessionId) {
      const sessionNode = draft.nodes.find(function (node) { return node.id === sessionId; });
      getSessionChildNodes(draft, sessionId).forEach(function (child) {
        if (!child.required) return;
        validateNode(child).errors.forEach(function (error) {
          blockers.push(`${sessionNode.label} / ${child.label}: ${error}`);
        });
      });
    });

    computeConflicts(draft).forEach(function (conflict) {
      if (conflict.type === 'error') blockers.push(conflict.message);
      else warnings.push(conflict.message);
    });

    draft.publishChecklist = { blockers: blockers, warnings: warnings };
    return draft.publishChecklist;
  }

  function nodeStatus(node) {
    const validation = validateNode(node);
    const attempted = Boolean(state.attemptedNodeIds[node.id]);
    if (validation.errors.length && attempted) return STATUS.NEEDS_ATTENTION;
    if (node.required && !validation.errors.length && validation.hasContent) return STATUS.COMPLETE;
    if (node.required && validation.hasContent) return STATUS.IN_PROGRESS;
    if (node.required) return STATUS.NOT_STARTED;
    if (validation.hasContent && !validation.errors.length) return STATUS.COMPLETE;
    return STATUS.NOT_STARTED;
  }

  function statusClass(status) {
    if (status === STATUS.COMPLETE) return 'complete';
    if (status === STATUS.IN_PROGRESS) return 'in-progress';
    if (status === STATUS.NEEDS_ATTENTION) return 'needs-attention';
    return 'not-started';
  }

  function renderPalette() {
    DOM.palette.innerHTML = paletteItems.map(function (item) {
      return `
        <div class="event-palette-item" draggable="true" data-node-type="${item.type}">
          <span class="event-palette-title">${escapeHtml(item.label)}</span>
          <span class="event-palette-helper">${escapeHtml(item.helper)}</span>
        </div>
      `;
    }).join('');
  }

  function nodeShowCanvasError(node) {
    const validation = validateNode(node);
    if (!validation.errors.length) return false;
    return Boolean(state.attemptedNodeIds[node.id]) || Boolean(state.draft.meta.validationAttempted);
  }

  function renderCanvasPorts(nodeId) {
    return PORT_SIDES.map(function (side) {
      return `<span class="event-canvas-port event-canvas-port-${side}" data-port-side="${side}" data-node-id="${nodeId}" aria-hidden="true"></span>`;
    }).join('');
  }

  function renderCanvasNode(node) {
    const status = nodeStatus(node);
    const isActive = state.selectedNodeId === node.id;
    const nodeLabel = cleanText(node.label);
    const isChild = isSessionChildType(node.type);
    const width = isChild ? CANVAS_CHILD_WIDTH : CANVAS_NODE_WIDTH;
    const height = isChild ? CANVAS_CHILD_HEIGHT : CANVAS_NODE_HEIGHT;
    const removeButton = (node.type === NODE_TYPES.SESSION || isChild)
      ? ''
      : `<button type="button" class="event-canvas-node-remove" data-action="remove-node" data-node-id="${node.id}" aria-label="Remove ${escapeHtml(nodeLabel)}">×</button>`;

    const groupClass = node.type === NODE_TYPES.SESSION
      ? ' event-canvas-node-session'
      : (isChild ? ' event-canvas-node-child' : '');
    const errorClass = nodeShowCanvasError(node) ? ' event-canvas-node-has-error' : '';
    const errorBadge = nodeShowCanvasError(node) ? '<span class="event-canvas-node-error-badge" aria-label="Needs attention">!</span>' : '';

    const display = toDisplayCoord(node.x, node.y);
    return `<div class="event-canvas-node${groupClass}${errorClass}${isActive ? ' is-active' : ''}" data-node-id="${node.id}" role="button" tabindex="0" style="left:${display.x}px;top:${display.y}px;width:${width}px;min-height:${height}px">${renderCanvasPorts(node.id)}${removeButton}${errorBadge}<span class="event-canvas-node-copy"><span class="event-canvas-node-head"><span class="event-canvas-node-title">${escapeHtml(nodeLabel)}</span><span class="event-status ${statusClass(status)}">${escapeHtml(status)}</span></span></span></div>`;
  }

  function renderSessionGroupsMarkup() {
    return state.draft.sessions.map(function (sessionId) {
      const sessionNode = state.draft.nodes.find(function (node) { return node.id === sessionId; });
      if (!sessionNode) return '';
      const childNodes = getSessionChildNodes(state.draft, sessionId);
      const origin = getGraphOrigin(state.draft);
      const xs = [sessionNode.x || 0].concat(childNodes.map(function (node) { return node.x || 0; }));
      const ys = [sessionNode.y || 0].concat(childNodes.map(function (node) { return node.y || 0; }));
      const minX = Math.min.apply(null, xs) - 16 - origin.x;
      const minY = Math.min.apply(null, ys) - 16 - origin.y;
      const maxX = Math.max.apply(null, xs) + CANVAS_NODE_WIDTH + 16 - origin.x;
      const maxY = Math.max.apply(null, ys) + (childNodes.length * 72) + 16 - origin.y;
      return `<div class="event-canvas-session-group" style="left:${minX}px;top:${minY}px;width:${maxX - minX}px;height:${maxY - minY}px" aria-hidden="true"></div>`;
    }).join('');
  }

  function getCanvasEmptyMessage() {
    if (DOM.templateGallery && !DOM.templateGallery.classList.contains('is-hidden')) {
      return 'Choose a template above or drop nodes here to begin.';
    }
    return 'Drop nodes from the palette to begin building your event.';
  }

  function renderCanvas() {
    if (!state.draft.nodes.length) {
      DOM.canvas.innerHTML = `<p class="event-admin-canvas-empty">${getCanvasEmptyMessage()}</p>`;
      return;
    }

    layoutAllNodes(state.draft);
    const graphWidth = state.draft.meta.graphWidth || 960;
    const graphHeight = state.draft.meta.graphHeight || 720;
    const nodesMarkup = state.draft.nodes.map(renderCanvasNode).join('');

    DOM.canvas.innerHTML = `<div class="event-canvas-viewport" id="event-canvas-viewport"><div class="event-canvas-graph" id="event-canvas-graph" style="width:${graphWidth}px;height:${graphHeight}px"><svg class="event-canvas-edges" id="event-canvas-edges" aria-hidden="true"></svg>${renderSessionGroupsMarkup()}<div class="event-canvas-node-layer">${nodesMarkup}</div></div></div>`;

    applyCanvasTransform();
    window.requestAnimationFrame(drawCanvasEdges);
  }

  function drawCanvasEdges() {
    const graph = DOM.canvas.querySelector('#event-canvas-graph');
    const svg = DOM.canvas.querySelector('#event-canvas-edges');
    if (!graph || !svg || !state.draft) return;

    const width = Math.max(1, graph.clientWidth);
    const height = Math.max(1, graph.clientHeight);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));

    let defs = '<defs><marker id="event-canvas-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" fill="rgba(51, 78, 92, 0.4)"></path></marker></defs>';
    let paths = '';

    state.draft.edges.forEach(function (edge) {
      const fromNode = state.draft.nodes.find(function (node) { return node.id === edge.from; });
      const toNode = state.draft.nodes.find(function (node) { return node.id === edge.to; });
      if (!fromNode || !toNode) return;

      const ports = resolveEdgePorts(edge, fromNode, toNode);
      const start = getNodePortPoint(fromNode, ports.fromPort);
      const end = getNodePortPoint(toNode, ports.toPort);
      const edgeKey = getEdgeKey(edge);
      const isSelected = state.selectedEdgeKey === edgeKey;
      const edgeClass = `${edge.manual ? 'event-canvas-edge-path is-manual' : 'event-canvas-edge-path'}${isSelected ? ' is-selected' : ''}`;
      const d = buildEdgePath(start.x, start.y, ports.fromPort, end.x, end.y, ports.toPort);
      paths += `<path class="${edgeClass}" data-edge-from="${edge.from}" data-edge-to="${edge.to}" d="${d}" marker-end="url(#event-canvas-arrow)"></path>`;
    });

    if (state.edgeDrag) {
      const fromNode = state.draft.nodes.find(function (node) { return node.id === state.edgeDrag.fromNodeId; });
      if (fromNode) {
        const start = getNodePortPoint(fromNode, state.edgeDrag.fromPort);
        paths += `<path class="event-canvas-edge-path is-preview" d="M ${start.x} ${start.y} L ${state.edgeDrag.currentX} ${state.edgeDrag.currentY}"></path>`;
      }
    }

    svg.innerHTML = defs + paths;
  }

  function renderSummary() {
    const requiredNodes = state.draft.nodes.filter(function (node) {
      return node.required && !isSessionChildType(node.type);
    });
    const completeCount = requiredNodes.filter(function (node) { return nodeStatus(node) === STATUS.COMPLETE; }).length;
    DOM.progressChip.textContent = `${completeCount} / ${requiredNodes.length} complete`;

    const selected = state.draft.nodes.find(function (node) { return node.id === state.selectedNodeId; });
    const savedAt = new Date(state.draft.meta.lastSavedAt);

    DOM.title.textContent = selected ? `${selected.label} parameters` : 'Node properties';
    if (selected) {
      const status = nodeStatus(selected);
      DOM.statusChip.className = `event-status ${statusClass(status)}`;
      DOM.statusChip.textContent = status;
    } else {
      DOM.statusChip.className = 'event-status not-started';
      DOM.statusChip.textContent = STATUS.NOT_STARTED;
    }

    const template = state.draft.meta.templateId ? getTemplateById(state.draft.meta.templateId) : null;
    const templateLabel = template ? `${template.label} template` : 'Blank canvas';
    const syncedAt = savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const validationLabel = state.draft.meta.isDirty ? 'Not validated yet' : 'Validated and publish-ready';
    DOM.meta.textContent = `${templateLabel} · Synced locally at ${syncedAt} · ${validationLabel}.`;
  }

  function showTemplateGallery() {
    if (!DOM.templateGallery) return;
    DOM.templateGallery.classList.remove('is-hidden');
  }

  function hideTemplateGallery() {
    if (!DOM.templateGallery) return;
    DOM.templateGallery.classList.add('is-hidden');
  }

  function renderTemplateGallery() {
    if (!DOM.templateCards) return;

    DOM.templateCards.innerHTML = EVENT_TEMPLATES.map(function (template) {
      return `
        <button type="button" class="event-template-card" data-template-id="${template.id}">
          <span class="event-template-card-title">${escapeHtml(template.label)}</span>
          <span class="event-template-card-description">${escapeHtml(template.description)}</span>
        </button>
      `;
    }).join('');
  }

  function confirmReplaceDraft(message) {
    if (!state.draft || !state.draft.meta.isDirty) return true;
    return window.confirm(message);
  }

  function loadTemplateDraft(templateId, options) {
    const opts = options || {};
    const template = getTemplateById(templateId);

    if (!template) {
      setAlert('Unknown template. Starting with a blank draft.', true);
      loadDraft(createDraft());
      showTemplateGallery();
      return false;
    }

    if (!opts.skipConfirm && !confirmReplaceDraft('You have unvalidated changes. Load this template anyway?')) {
      return false;
    }

    const draft = createTemplateDraft(templateId);
    loadDraft(draft);
    saveDraft(false);
    hideTemplateGallery();
    showToast(`${template.label} template loaded.`, 4000);
    return true;
  }

  function startBlankFromGallery() {
    if (!confirmReplaceDraft('You have unvalidated changes. Start a blank canvas anyway?')) return;
    const draft = createDraft();
    draft.meta.templateChosen = true;
    loadDraft(draft);
    saveDraft(false);
    hideTemplateGallery();
    showToast('Blank canvas ready. Drag nodes from the palette to begin.', 4000);
  }

  function createScratchDraftWithBasics(title) {
    const draft = createDraft();
    const basicsId = addNodeByType(draft, NODE_TYPES.BASICS, false);
    draft.payloadByNodeId[basicsId] = {
      title: title,
      description: '',
      spot: ''
    };
    draft.meta.templateChosen = true;
    return draft;
  }

  function openScratchWithBasics(basicsTitle, options) {
    const opts = options || {};
    const normalizedTitle = typeof basicsTitle === 'string' ? basicsTitle.trim() : '';

    if (!normalizedTitle) return false;

    if (!opts.skipConfirm && !confirmReplaceDraft('You have unvalidated changes. Start this event from scratch anyway?')) {
      return false;
    }

    loadDraft(createScratchDraftWithBasics(normalizedTitle));
    saveDraft(false);
    hideTemplateGallery();
    showToast(`Event created: "${normalizedTitle}"`, 5000);
    return true;
  }

  function openWorkspace(options) {
    const opts = options || {};

    if (opts.template) {
      loadTemplateDraft(opts.template, { skipConfirm: Boolean(opts.skipConfirm) });
    } else if (opts.basicsTitle) {
      openScratchWithBasics(opts.basicsTitle, { skipConfirm: opts.skipConfirm });
    } else if (state.isInitialized && state.draft && !state.draft.meta.templateChosen && !state.draft.nodes.length) {
      showTemplateGallery();
    }

    window.requestAnimationFrame(function () {
      if (state.isInitialized) drawCanvasEdges();
    });
  }

  function renderBasicsForm(node, validation) {
    const payload = state.draft.payloadByNodeId[node.id] || {};
    const showErrors = state.attemptedNodeIds[node.id];
    return `
      <div class="event-field">
        <label for="event-basics-title">Title</label>
        <input id="event-basics-title" name="title" value="${escapeHtml(payload.title)}" />
        ${showErrors && validation.errors.indexOf('Title is required.') > -1 ? '<p class="event-error">Title is required.</p>' : ''}
      </div>
      <div class="event-field">
        <label for="event-basics-description">Description</label>
        <textarea id="event-basics-description" name="description">${escapeHtml(payload.description)}</textarea>
        <p class="event-helper">Optional. Recommended max length 280 (${(payload.description || '').length}).</p>
      </div>
      <div class="event-field">
        <label for="event-basics-spot">Spot</label>
        <select id="event-basics-spot" name="spot">
          <option value="">Select spot</option>
          <option value="Northwest Spot" ${payload.spot === 'Northwest Spot' ? 'selected' : ''}>Northwest Spot</option>
          <option value="Enterprise Hub" ${payload.spot === 'Enterprise Hub' ? 'selected' : ''}>Enterprise Hub</option>
          <option value="Growth Lab" ${payload.spot === 'Growth Lab' ? 'selected' : ''}>Growth Lab</option>
        </select>
      </div>
    `;
  }

  function renderRegistrationForm(node, validation) {
    const payload = state.draft.payloadByNodeId[node.id] || { modes: [] };
    const modes = payload.modes || [];
    const options = [
      { id: 'open-registration', label: 'Open registration' },
      { id: 'approval-required', label: 'Enrollment approval required' },
      { id: 'attendance-tracked', label: 'Attendance tracking enabled' }
    ];
    return `
      <div class="event-field">
        <span class="event-inline-label">Registration/attendance modes</span>
        <div class="event-checkbox-list">
          ${options.map(function (option) {
            return `<label class="event-checkbox-row"><input type="checkbox" name="registration-mode" value="${option.id}" ${modes.indexOf(option.id) > -1 ? 'checked' : ''} /><span>${option.label}</span></label>`;
          }).join('')}
        </div>
        ${state.attemptedNodeIds[node.id] && validation.errors.length ? '<p class="event-error">Pick at least one mode.</p>' : ''}
      </div>
    `;
  }

  function renderBannerForm(node, validation) {
    const payload = state.draft.payloadByNodeId[node.id] || {};
    return `
      <div class="event-field">
        <label for="event-banner-file">Banner file</label>
        <input id="event-banner-file" type="file" name="banner-file" accept="image/*" />
        <p class="event-helper">Optional image under 5MB.</p>
        ${payload.fileName ? `<p class="event-helper">Selected: ${escapeHtml(payload.fileName)}</p>` : ''}
        ${state.attemptedNodeIds[node.id] && validation.errors.length ? `<p class="event-error">${escapeHtml(validation.errors[0])}</p>` : ''}
      </div>
    `;
  }

  function renderInstructorsForm(node, validation) {
    const payload = state.draft.payloadByNodeId[node.id] || { entries: [] };
    const entries = payload.entries || [];
    return `
      <div class="event-field">
        <label for="event-instructor-input">Add instructor (name/email)</label>
        <div class="event-inline-actions">
          <input id="event-instructor-input" class="event-instructor-input" />
          <button type="button" class="event-mini-button" data-action="add-instructor">Add</button>
        </div>
      </div>
      <div class="event-instructors-list">
        ${entries.length ? entries.map(function (entry, index) {
          return `<div class="event-instructor-item"><span class="event-instructor-value">${escapeHtml(entry)}</span><button type="button" class="event-mini-button" data-action="remove-instructor" data-index="${index}">Remove</button></div>`;
        }).join('') : '<p class="event-helper">No instructors yet.</p>'}
      </div>
      ${state.attemptedNodeIds[node.id] && validation.errors.length ? `<p class="event-error">${escapeHtml(validation.errors[0])}</p>` : ''}
    `;
  }

  function renderSessionsForm(node, validation) {
    const payload = state.draft.payloadByNodeId[node.id] || { sessionIds: [] };
    const conflicts = computeConflicts(state.draft);
    return `
      <div class="event-field">
        <span class="event-inline-label">Session rail</span>
        <p class="event-helper">Add sessions from the palette, then duplicate, reorder, or remove branches here.</p>
        <div class="event-inline-actions">
          <button type="button" class="event-mini-button" data-action="jump-incomplete-session">Jump to incomplete</button>
        </div>
      </div>
      <div class="event-sessions-list">
        ${(payload.sessionIds || []).map(function (sessionId, index) {
          const sessionPayload = state.draft.payloadByNodeId[sessionId] || {};
          const schedule = getSessionSchedulePayload(sessionId);
          const venue = getSessionVenuePayload(sessionId);
          const metaParts = [
            schedule.date || 'Date TBD',
            schedule.startTime && schedule.endTime ? `${schedule.startTime}-${schedule.endTime}` : 'Time TBD',
            venue.venueMode || 'Venue TBD'
          ];
          return `<div class="event-session-item"><input class="event-session-title-input" data-session-id="${sessionId}" data-action="update-session-title" value="${escapeHtml(sessionPayload.title || '')}" /><span class="event-helper">${escapeHtml(metaParts.join(' · '))}</span><button type="button" class="event-mini-button" data-action="focus-session" data-session-id="${sessionId}">Open</button><button type="button" class="event-mini-button" data-action="duplicate-session" data-session-id="${sessionId}">Duplicate</button><button type="button" class="event-mini-button" data-action="reorder-session-up" data-session-id="${sessionId}" ${index === 0 ? 'disabled' : ''}>Up</button><button type="button" class="event-mini-button" data-action="reorder-session-down" data-session-id="${sessionId}" ${index === payload.sessionIds.length - 1 ? 'disabled' : ''}>Down</button><button type="button" class="event-mini-button" data-action="remove-node" data-node-id="${sessionId}">Remove</button></div>`;
        }).join('')}
      </div>
      ${conflicts.length ? `<div class="event-field"><span class="event-inline-label">Cross-session checks</span>${conflicts.map(function (conflict) {
        return `<p class="${conflict.type === 'error' ? 'event-error' : 'event-helper'}">${escapeHtml(conflict.message)}</p>`;
      }).join('')}</div>` : ''}
      ${state.attemptedNodeIds[node.id] && validation.errors.length ? '<p class="event-error">At least one Session node is required.</p>' : ''}
    `;
  }

  function renderSessionChildForm(node, validation) {
    const payload = state.draft.payloadByNodeId[node.id] || {};
    const showErrors = state.attemptedNodeIds[node.id];

    if (node.type === NODE_TYPES.SESSION_BASICS) {
      return `
        <div class="event-field"><label for="event-session-basics-title">Session title</label><input id="event-session-basics-title" name="session-basics-title" value="${escapeHtml(payload.title || '')}" />${showErrors && validation.errors.length ? `<p class="event-error">${escapeHtml(validation.errors[0])}</p>` : ''}</div>
        <div class="event-field"><label for="event-session-basics-summary">Summary</label><textarea id="event-session-basics-summary" name="session-basics-summary">${escapeHtml(payload.summary || '')}</textarea></div>
        <div class="event-field"><label for="event-session-basics-track">Track/type</label><input id="event-session-basics-track" name="session-basics-track" value="${escapeHtml(payload.track || '')}" /></div>
      `;
    }

    if (node.type === NODE_TYPES.SESSION_SCHEDULE) {
      return `
        <div class="event-field"><label for="event-session-schedule-date">Date</label><input id="event-session-schedule-date" type="date" name="session-schedule-date" value="${escapeHtml(payload.date || '')}" /></div>
        <div class="event-inline-actions"><div class="event-field"><label for="event-session-schedule-start">Start</label><input id="event-session-schedule-start" type="time" name="session-schedule-start" value="${escapeHtml(payload.startTime || '')}" /></div><div class="event-field"><label for="event-session-schedule-end">End</label><input id="event-session-schedule-end" type="time" name="session-schedule-end" value="${escapeHtml(payload.endTime || '')}" /></div></div>
        <div class="event-field"><label for="event-session-schedule-timezone">Timezone</label><input id="event-session-schedule-timezone" name="session-schedule-timezone" value="${escapeHtml(payload.timezone || '')}" placeholder="America/Los_Angeles" /></div>
        ${showErrors && validation.errors.length ? `<p class="event-error">${escapeHtml(validation.errors[0])}</p>` : ''}
      `;
    }

    if (node.type === NODE_TYPES.SESSION_VENUE) {
      return `
        <div class="event-field"><label for="event-session-venue-mode">Venue mode</label><select id="event-session-venue-mode" name="session-venue-mode"><option value="">Select mode</option><option value="physical" ${payload.venueMode === 'physical' ? 'selected' : ''}>Physical</option><option value="virtual" ${payload.venueMode === 'virtual' ? 'selected' : ''}>Virtual</option></select></div>
        <div class="event-field"><label for="event-session-venue-location">Physical location</label><input id="event-session-venue-location" name="session-venue-location" value="${escapeHtml(payload.location || '')}" /></div>
        <div class="event-field"><label for="event-session-venue-link">Virtual link</label><input id="event-session-venue-link" name="session-venue-link" value="${escapeHtml(payload.virtualLink || '')}" /></div>
        ${showErrors && validation.errors.length ? `<p class="event-error">${escapeHtml(validation.errors[0])}</p>` : ''}
      `;
    }

    if (node.type === NODE_TYPES.SESSION_CAPACITY) {
      return `
        <div class="event-field"><label for="event-session-capacity-limit">Seat limit</label><input id="event-session-capacity-limit" name="session-capacity-limit" value="${escapeHtml(payload.capacity || '')}" /></div>
        <div class="event-field"><label for="event-session-capacity-waitlist">Waitlist</label><select id="event-session-capacity-waitlist" name="session-capacity-waitlist"><option value="disabled" ${payload.waitlist === 'disabled' ? 'selected' : ''}>Disabled</option><option value="enabled" ${payload.waitlist === 'enabled' ? 'selected' : ''}>Enabled</option></select></div>
        ${showErrors && validation.errors.length ? `<p class="event-error">${escapeHtml(validation.errors[0])}</p>` : ''}
      `;
    }

    if (node.type === NODE_TYPES.SESSION_INSTRUCTORS) {
      const entries = payload.entries || [];
      return `
        <div class="event-field"><label for="event-session-instructor-input">Add instructor</label><div class="event-inline-actions"><input id="event-session-instructor-input" class="event-instructor-input" /><button type="button" class="event-mini-button" data-action="add-session-instructor">Add</button></div></div>
        <div class="event-instructors-list">${entries.length ? entries.map(function (entry, index) {
          return `<div class="event-instructor-item"><span class="event-instructor-value">${escapeHtml(entry)}</span><button type="button" class="event-mini-button" data-action="remove-session-instructor" data-index="${index}">Remove</button></div>`;
        }).join('') : '<p class="event-helper">No instructors yet.</p>'}</div>
        ${showErrors && validation.errors.length ? `<p class="event-error">${escapeHtml(validation.errors[0])}</p>` : ''}
      `;
    }

    if (node.type === NODE_TYPES.SESSION_MATERIALS) {
      return `
        <div class="event-field"><label for="event-session-materials">Resources</label><textarea id="event-session-materials" name="session-materials" placeholder="Links, decks, or handouts">${escapeHtml((payload.resources || []).join('\n'))}</textarea><p class="event-helper">Optional. One resource per line.</p></div>
      `;
    }

    if (node.type === NODE_TYPES.SESSION_REG_RULES) {
      return `
        <div class="event-field"><label for="event-session-reg-override">Override mode</label><select id="event-session-reg-override" name="session-reg-override"><option value="">Inherit event registration</option><option value="open-registration" ${payload.overrideMode === 'open-registration' ? 'selected' : ''}>Open registration</option><option value="approval-required" ${payload.overrideMode === 'approval-required' ? 'selected' : ''}>Approval required</option></select></div>
        <div class="event-field"><label for="event-session-reg-notes">Notes</label><textarea id="event-session-reg-notes" name="session-reg-notes">${escapeHtml(payload.notes || '')}</textarea></div>
      `;
    }

    if (node.type === NODE_TYPES.SESSION_PUBLISH_CHECKS) {
      const childBlockers = node.parentSessionId ? getSessionChildNodes(state.draft, node.parentSessionId).filter(function (child) {
        return child.type !== NODE_TYPES.SESSION_PUBLISH_CHECKS && validateNode(child).errors.length;
      }) : [];
      return `
        <div class="event-field"><span class="event-inline-label">Publish readiness</span><p class="event-helper">${childBlockers.length ? `${childBlockers.length} blocking item(s) remain in this session branch.` : 'All required session child nodes pass validation.'}</p></div>
        <div class="event-field"><label for="event-session-publish-notes">Review notes</label><textarea id="event-session-publish-notes" name="session-publish-notes">${escapeHtml(payload.notes || '')}</textarea></div>
      `;
    }

    return '<p class="event-helper">No editable properties for this node.</p>';
  }

  function renderSessionNodeForm(node) {
    const payload = state.draft.payloadByNodeId[node.id] || {};
    const childSummary = getSessionChildNodes(state.draft, node.id).map(function (child) {
      const childValidation = validateNode(child);
      return `<li><button type="button" class="event-link-button" data-action="focus-session-child" data-node-id="${child.id}">${escapeHtml(child.label)}</button> — ${escapeHtml(nodeStatus(child))}${childValidation.errors.length ? ' (needs attention)' : ''}</li>`;
    }).join('');
    return `
      <div class="event-field"><label for="event-session-title">Session branch title</label><input id="event-session-title" name="session-title" value="${escapeHtml(payload.title || '')}" /><p class="event-helper">Use child nodes on the canvas for schedule, venue, capacity, and publish checks.</p></div>
      <div class="event-field"><span class="event-inline-label">Session child nodes</span><ul class="event-session-child-summary">${childSummary || '<li>No child nodes yet.</li>'}</ul></div>
    `;
  }

  function renderForm() {
    const node = state.draft.nodes.find(function (item) { return item.id === state.selectedNodeId; });
    if (!node) {
      DOM.form.innerHTML = '<p class="event-helper">Select a node in the canvas to edit parameters.</p>';
      return;
    }
    const validation = validateNode(node);
    if (node.type === NODE_TYPES.BASICS) { DOM.form.innerHTML = renderBasicsForm(node, validation); return; }
    if (node.type === NODE_TYPES.REGISTRATION) { DOM.form.innerHTML = renderRegistrationForm(node, validation); return; }
    if (node.type === NODE_TYPES.BANNER) { DOM.form.innerHTML = renderBannerForm(node, validation); return; }
    if (node.type === NODE_TYPES.INSTRUCTORS) { DOM.form.innerHTML = renderInstructorsForm(node, validation); return; }
    if (node.type === NODE_TYPES.SESSIONS) { DOM.form.innerHTML = renderSessionsForm(node, validation); return; }
    if (node.type === NODE_TYPES.SESSION) { DOM.form.innerHTML = renderSessionNodeForm(node); return; }
    if (isSessionChildType(node.type)) { DOM.form.innerHTML = renderSessionChildForm(node, validation); return; }
    DOM.form.innerHTML = '<p class="event-helper">No editable properties for this node.</p>';
  }

  function renderAll() {
    syncDefaultEdges();
    renderPalette();
    renderCanvas();
    renderSummary();
    renderForm();
    updateTemplateGalleryVisibility();
  }

  function ensureNodePayload(nodeId, type) {
    if (!state.draft.payloadByNodeId[nodeId]) {
      state.draft.payloadByNodeId[nodeId] = createNodePayload(type, nodeId, state.draft);
    }
    return state.draft.payloadByNodeId[nodeId];
  }

  function updateSelectedNode(target) {
    if (!target) return;
    const node = state.draft.nodes.find(function (item) { return item.id === state.selectedNodeId; });
    if (!node) return;
    const payload = ensureNodePayload(node.id, node.type);

    if (node.type === NODE_TYPES.BASICS) {
      if (target.name === 'title') payload.title = target.value;
      if (target.name === 'description') payload.description = target.value;
      if (target.name === 'spot') payload.spot = target.value;
      markDirty();
      return;
    }

    if (node.type === NODE_TYPES.REGISTRATION && target.name === 'registration-mode') {
      const checked = Array.prototype.slice.call(DOM.form.querySelectorAll('input[name="registration-mode"]:checked'))
        .map(function (item) { return item.value; });
      payload.modes = checked;
      markDirty();
      return;
    }

    if (node.type === NODE_TYPES.BANNER && target.name === 'banner-file') {
      const file = target.files && target.files[0];
      payload.fileName = file ? file.name : '';
      payload.fileType = file ? file.type : '';
      payload.fileSize = file ? file.size : 0;
      markDirty();
      renderAll();
      return;
    }

    if (node.type === NODE_TYPES.SESSION && target.name === 'session-title') {
      payload.title = target.value;
      markDirty();
      renderSummary();
      return;
    }

    if (node.type === NODE_TYPES.SESSION_BASICS) {
      if (target.name === 'session-basics-title') payload.title = target.value;
      if (target.name === 'session-basics-summary') payload.summary = target.value;
      if (target.name === 'session-basics-track') payload.track = target.value;
      markDirty();
      return;
    }

    if (node.type === NODE_TYPES.SESSION_SCHEDULE) {
      if (target.name === 'session-schedule-date') payload.date = target.value;
      if (target.name === 'session-schedule-start') payload.startTime = target.value;
      if (target.name === 'session-schedule-end') payload.endTime = target.value;
      if (target.name === 'session-schedule-timezone') payload.timezone = target.value;
      markDirty();
      computeConflicts(state.draft);
      return;
    }

    if (node.type === NODE_TYPES.SESSION_VENUE) {
      if (target.name === 'session-venue-mode') payload.venueMode = target.value;
      if (target.name === 'session-venue-location') payload.location = target.value;
      if (target.name === 'session-venue-link') payload.virtualLink = target.value;
      markDirty();
      computeConflicts(state.draft);
      return;
    }

    if (node.type === NODE_TYPES.SESSION_CAPACITY) {
      if (target.name === 'session-capacity-limit') payload.capacity = target.value;
      if (target.name === 'session-capacity-waitlist') payload.waitlist = target.value;
      markDirty();
      return;
    }

    if (node.type === NODE_TYPES.SESSION_MATERIALS && target.name === 'session-materials') {
      payload.resources = target.value.split('\n').map(function (line) { return line.trim(); }).filter(Boolean);
      markDirty();
      return;
    }

    if (node.type === NODE_TYPES.SESSION_REG_RULES) {
      if (target.name === 'session-reg-override') payload.overrideMode = target.value;
      if (target.name === 'session-reg-notes') payload.notes = target.value;
      markDirty();
      return;
    }

    if (node.type === NODE_TYPES.SESSION_PUBLISH_CHECKS && target.name === 'session-publish-notes') {
      payload.notes = target.value;
      markDirty();
      return;
    }

    if (target.dataset.action === 'update-session-title') {
      const sessionId = target.dataset.sessionId;
      const sessionNode = state.draft.nodes.find(function (item) { return item.id === sessionId; });
      if (!sessionNode) return;
      const sessionPayload = ensureNodePayload(sessionId, sessionNode.type);
      sessionPayload.title = target.value;
      markDirty();
      renderSummary();
    }
  }

  function addInstructor() {
    const node = state.draft.nodes.find(function (item) { return item.id === state.selectedNodeId; });
    if (!node || node.type !== NODE_TYPES.INSTRUCTORS) return;
    const input = DOM.form.querySelector('#event-instructor-input');
    if (!input) return;
    const value = input.value.trim();
    if (!value) return;
    const payload = state.draft.payloadByNodeId[node.id];
    payload.entries.push(value);
    input.value = '';
    markDirty();
    renderAll();
  }

  function removeInstructor(index) {
    const node = state.draft.nodes.find(function (item) { return item.id === state.selectedNodeId; });
    if (!node || node.type !== NODE_TYPES.INSTRUCTORS) return;
    const payload = state.draft.payloadByNodeId[node.id];
    payload.entries.splice(index, 1);
    markDirty();
    renderAll();
  }

  function addSessionInstructor() {
    const node = state.draft.nodes.find(function (item) { return item.id === state.selectedNodeId; });
    if (!node || node.type !== NODE_TYPES.SESSION_INSTRUCTORS) return;
    const input = DOM.form.querySelector('#event-session-instructor-input');
    if (!input) return;
    const value = input.value.trim();
    if (!value) return;
    const payload = state.draft.payloadByNodeId[node.id];
    payload.entries.push(value);
    input.value = '';
    markDirty();
    computeConflicts(state.draft);
    renderAll();
  }

  function removeSessionInstructor(index) {
    const node = state.draft.nodes.find(function (item) { return item.id === state.selectedNodeId; });
    if (!node || node.type !== NODE_TYPES.SESSION_INSTRUCTORS) return;
    const payload = state.draft.payloadByNodeId[node.id];
    payload.entries.splice(index, 1);
    markDirty();
    computeConflicts(state.draft);
    renderAll();
  }

  function refreshPublishChecks(sessionId) {
    const publishNode = getSessionChildNodes(state.draft, sessionId).find(function (node) {
      return node.type === NODE_TYPES.SESSION_PUBLISH_CHECKS;
    });
    if (!publishNode) return;
    const blockers = getSessionChildNodes(state.draft, sessionId).filter(function (child) {
      return child.type !== NODE_TYPES.SESSION_PUBLISH_CHECKS && validateNode(child).errors.length;
    });
    state.draft.payloadByNodeId[publishNode.id].status = blockers.length ? 'pending' : 'ready';
  }

  function showPostSaveSummary() {
    if (!isEmbeddedWorkspace) return;
    const basicsNode = state.draft.nodes.find(function (node) { return node.type === NODE_TYPES.BASICS; });
    const basicsPayload = basicsNode ? (state.draft.payloadByNodeId[basicsNode.id] || {}) : {};
    const summaryHost = document.getElementById('workspace-event-saved-summary');
    if (!summaryHost) return;

    summaryHost.innerHTML = `
      <h2>Event draft validated</h2>
      <p class="event-helper">${escapeHtml(basicsPayload.title || 'Untitled event')} · ${state.draft.sessions.length} session branch(es) · Required nodes complete.</p>
      <ul>
        <li>Template: ${escapeHtml(state.draft.meta.templateId || 'Blank canvas')}</li>
        <li>Saved at ${new Date(state.draft.meta.lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</li>
      </ul>
      <button type="button" class="home-task-action" id="workspace-return-to-event-button">Return to event editor</button>
    `;
    summaryHost.classList.remove('is-hidden');

    const returnButton = document.getElementById('workspace-return-to-event-button');
    if (returnButton) {
      returnButton.addEventListener('click', function () {
        summaryHost.classList.add('is-hidden');
        if (window.openEventWorkspace) window.openEventWorkspace({ skipConfirm: true });
      }, { once: true });
    }

    if (window.closeEventWorkspace) window.closeEventWorkspace({ preserveView: true });
  }

  function validateAndSave() {
    if (!state.isInitialized || !state.draft) return;
    state.draft.meta.validationAttempted = true;
    const requiredNodes = state.draft.nodes.filter(function (node) {
      return node.required && !isSessionChildType(node.type);
    });
    if (!requiredNodes.length) {
      setAlert('Add required nodes to canvas first (Basics, Registration, Sessions Container).', true);
      return;
    }

    let brokenNode = null;
    requiredNodes.forEach(function (node) {
      state.attemptedNodeIds[node.id] = true;
      if (!brokenNode && validateNode(node).errors.length) brokenNode = node;
    });

    state.draft.sessions.forEach(function (sessionId) {
      getSessionChildNodes(state.draft, sessionId).forEach(function (child) {
        if (child.required) state.attemptedNodeIds[child.id] = true;
        if (!brokenNode && child.required && validateNode(child).errors.length) brokenNode = child;
      });
      refreshPublishChecks(sessionId);
    });

    const checklist = computePublishChecklist(state.draft);
    renderAll();

    if (brokenNode) {
      state.selectedNodeId = brokenNode.id;
      renderAll();
      setAlert(`Save blocked: ${brokenNode.label} has required fields missing.`, true);
      return;
    }

    if (checklist.blockers.length) {
      setAlert(`Save blocked: ${checklist.blockers[0]}`, true);
      return;
    }

    state.draft.meta.isDirty = false;
    saveDraft(false);
    renderSummary();
    clearAlert();

    const warningCount = checklist.warnings.length;
    const toastMessage = warningCount
      ? `Draft validated with ${warningCount} warning${warningCount > 1 ? 's' : ''}.`
      : 'Draft validated. Event is publish-ready.';
    showToast(toastMessage, 5000);
    showPostSaveSummary();
  }

  function loadDraft(draft) {
    migrateDraft(draft);
    draft.nodes.forEach(function (node) {
      node.label = cleanText(node.label);
      node.helper = cleanText(node.helper);
      node.type = cleanText(node.type);
    });
    state.draft = draft;
    state.removedAutoEdges = draft.meta.removedAutoEdges || {};
    state.selectedEdgeKey = null;
    state.selectedNodeId = (function () {
      const preferred = draft.nodes.find(function (node) { return !isSessionChildType(node.type); });
      if (preferred) return preferred.id;
      return draft.nodes[0] ? draft.nodes[0].id : null;
    })();
    state.attemptedNodeIds = {};
    clearAlert();
    clearToast();
    state.isInitialized = true;
    computeConflicts(draft);
    renderAll();
  }

  function startNewDraft() {
    if (state.draft && state.draft.meta.isDirty) {
      const shouldReplace = window.confirm('You have unvalidated changes. Start a new draft anyway?');
      if (!shouldReplace) return;
    }
    loadDraft(createDraft());
    showTemplateGallery();
    showToast('New event draft started.', 4000);
  }

  function loadSampleDraft() {
    loadTemplateDraft('sales-kickoff');
  }

  function resetCurrentDraft() {
    const shouldReset = window.confirm('Reset current draft to a blank event? This cannot be undone.');
    if (!shouldReset) return;
    loadDraft(createDraft());
    state.removedAutoEdges = {};
    saveDraft(false);
    showTemplateGallery();
    resetCanvasView();
    showToast('Draft reset.', 4000);
  }

  function initializeEditor() {
    renderTemplateGallery();

    const params = new URLSearchParams(window.location.search);
    const templateParam = isEmbeddedWorkspace ? null : params.get('template');

    if (templateParam === 'blank') {
      const draft = createDraft();
      draft.meta.templateChosen = true;
      loadDraft(draft);
      hideTemplateGallery();
      return;
    }

    if (templateParam) {
      if (loadTemplateDraft(templateParam, { skipConfirm: false })) return;
    }

    const stored = readStoredDraft();
    if (stored) {
      loadDraft(stored);
      if (stored.meta && stored.meta.templateChosen) hideTemplateGallery();
      else showTemplateGallery();
      return;
    }

    loadDraft(createDraft());
    showTemplateGallery();
  }

  DOM.openButton && DOM.openButton.addEventListener('click', function () {
    startNewDraft();
  });

  DOM.sampleButton && DOM.sampleButton.addEventListener('click', function () {
    loadSampleDraft();
  });

  DOM.closeButton && DOM.closeButton.addEventListener('click', resetCurrentDraft);
  DOM.saveButton && DOM.saveButton.addEventListener('click', function () {
    validateAndSave();
  });
  DOM.workspaceSaveButton && DOM.workspaceSaveButton.addEventListener('click', function () {
    validateAndSave();
  });

  DOM.startBlankButton && DOM.startBlankButton.addEventListener('click', startBlankFromGallery);

  DOM.templateCards && DOM.templateCards.addEventListener('click', function (event) {
    const card = event.target.closest('[data-template-id]');
    if (!card) return;
    loadTemplateDraft(card.dataset.templateId);
    DOM.canvas.focus();
  });

  DOM.palette.addEventListener('dragstart', function (event) {
    const item = event.target.closest('[data-node-type]');
    if (!item) return;
    event.dataTransfer.setData('text/event-node-type', item.dataset.nodeType);
    event.dataTransfer.effectAllowed = 'copy';
  });

  DOM.canvas.addEventListener('dragover', function (event) {
    event.preventDefault();
    DOM.canvas.classList.add('is-drop-target');
  });

  DOM.canvas.addEventListener('dragleave', function () {
    DOM.canvas.classList.remove('is-drop-target');
  });

  DOM.canvas.addEventListener('drop', function (event) {
    event.preventDefault();
    DOM.canvas.classList.remove('is-drop-target');
    const type = event.dataTransfer.getData('text/event-node-type');
    if (!type) return;
    state.pendingDropPoint = getCanvasPointFromEvent(event);
    addNodeByType(state.draft, type, true);
    markDirty();
    updateTemplateGalleryVisibility();
    renderAll();
  });

  DOM.canvas.addEventListener('mousedown', function (event) {
    const port = event.target.closest('.event-canvas-port');
    if (port) {
      event.preventDefault();
      startEdgeDrag(port.dataset.nodeId, port.dataset.portSide, event);
      return;
    }

    if (state.spacePanActive && event.button === 0) {
      event.preventDefault();
      startPanDrag(event);
      return;
    }

    const node = event.target.closest('.event-canvas-node[data-node-id]');
    if (node && !event.target.closest('.event-canvas-node-remove') && !event.target.closest('.event-canvas-port')) {
      startNodeDrag(node.dataset.nodeId, event);
      return;
    }

    if (event.target.closest('#event-canvas-graph') && event.button === 0 && (event.altKey || event.target.classList.contains('event-canvas-graph'))) {
      startPanDrag(event);
    }
  });

  function handleCanvasMouseUp(event) {
    if (state.nodeDrag) finishNodeDrag();
    if (state.panDrag) finishPanDrag();
    if (state.edgeDrag) {
      const targetPort = event.target.closest('.event-canvas-port');
      finishEdgeDrag(
        targetPort ? targetPort.dataset.nodeId : null,
        targetPort ? targetPort.dataset.portSide : null,
        event
      );
    }
  }

  DOM.canvas.addEventListener('mouseup', handleCanvasMouseUp);
  document.addEventListener('mouseup', function (event) {
    if (!state.edgeDrag) return;
    if (DOM.canvas.contains(event.target)) return;
    handleCanvasMouseUp(event);
  });

  DOM.canvas.addEventListener('mousemove', function (event) {
    if (state.nodeDrag) moveNodeDrag(event);
    if (state.edgeDrag) moveEdgeDrag(event);
    if (state.panDrag) movePanDrag(event);
  });

  DOM.canvas.addEventListener('wheel', function (event) {
    if (!state.draft) return;
    event.preventDefault();

    const zoomIntent = event.ctrlKey || event.metaKey;
    const isTrackpadScroll = event.deltaMode === 0 && !zoomIntent;

    if (isTrackpadScroll) {
      panCanvasBy(-event.deltaX, -event.deltaY);
    } else {
      const delta = event.deltaY > 0 ? -0.08 : 0.08;
      zoomCanvasAt(event.clientX, event.clientY, delta);
    }

    applyCanvasTransform();
    drawCanvasEdges();
  }, { passive: false });

  DOM.canvas.addEventListener('click', function (event) {
    const edgePath = event.target.closest('.event-canvas-edge-path');
    if (edgePath && !edgePath.classList.contains('is-preview')) {
      state.selectedEdgeKey = `${edgePath.getAttribute('data-edge-from')}->${edgePath.getAttribute('data-edge-to')}`;
      state.selectedNodeId = null;
      clearAlert();
      renderAll();
      return;
    }

    const action = event.target.closest('[data-action]');
    if (action && action.dataset.action === 'remove-node') {
      removeNode(action.dataset.nodeId);
      return;
    }

    const node = event.target.closest('.event-canvas-node[data-node-id]');
    if (!node) {
      state.selectedEdgeKey = null;
      return;
    }

    state.selectedNodeId = node.dataset.nodeId;
    state.selectedEdgeKey = null;
    clearAlert();
    renderAll();
  });

  DOM.canvas.addEventListener('scroll', function () {
    if (!state.isInitialized) return;
    drawCanvasEdges();
  });

  DOM.form.addEventListener('submit', function (event) { event.preventDefault(); });
  DOM.form.addEventListener('change', function (event) { updateSelectedNode(event.target); });
  DOM.form.addEventListener('input', function (event) { updateSelectedNode(event.target); });

  DOM.form.addEventListener('click', function (event) {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'add-instructor') { addInstructor(); return; }
    if (action.dataset.action === 'remove-instructor') { removeInstructor(Number(action.dataset.index)); return; }
    if (action.dataset.action === 'focus-session') {
      state.selectedNodeId = action.dataset.sessionId;
      renderAll();
      return;
    }
    if (action.dataset.action === 'focus-session-child') {
      state.selectedNodeId = action.dataset.nodeId;
      renderAll();
      return;
    }
    if (action.dataset.action === 'duplicate-session') {
      duplicateSession(action.dataset.sessionId);
      return;
    }
    if (action.dataset.action === 'reorder-session-up') {
      reorderSession(action.dataset.sessionId, 'up');
      return;
    }
    if (action.dataset.action === 'reorder-session-down') {
      reorderSession(action.dataset.sessionId, 'down');
      return;
    }
    if (action.dataset.action === 'jump-incomplete-session') {
      jumpToIncompleteSession();
      return;
    }
    if (action.dataset.action === 'add-session-instructor') {
      addSessionInstructor();
      return;
    }
    if (action.dataset.action === 'remove-session-instructor') {
      removeSessionInstructor(Number(action.dataset.index));
      return;
    }
    if (action.dataset.action === 'remove-node') {
      removeNode(action.dataset.nodeId);
      return;
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.code === 'Space' && !event.repeat) {
      const tag = event.target && event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target.isContentEditable) return;
      event.preventDefault();
      setSpacePanActive(true);
      return;
    }

    if (event.key === 'Delete' && state.isInitialized) {
      if (state.selectedEdgeKey) {
        removeEdgeByKey(state.selectedEdgeKey);
        return;
      }
      if (state.selectedNodeId) {
        const selected = getNodeById(state.selectedNodeId);
        if (selected && !isSessionChildType(selected.type)) removeNode(state.selectedNodeId);
      }
    }
  });

  document.addEventListener('keyup', function (event) {
    if (event.code === 'Space') setSpacePanActive(false);
  });

  DOM.zoomInButton && DOM.zoomInButton.addEventListener('click', function () {
    setCanvasZoom(state.canvasView.scale + 0.1);
  });
  DOM.zoomOutButton && DOM.zoomOutButton.addEventListener('click', function () {
    setCanvasZoom(state.canvasView.scale - 0.1);
  });
  DOM.zoomResetButton && DOM.zoomResetButton.addEventListener('click', resetCanvasView);
  DOM.fitGraphButton && DOM.fitGraphButton.addEventListener('click', fitCanvasToGraph);

  window.addEventListener('resize', function () {
    if (!state.isInitialized) return;
    drawCanvasEdges();
  });

  window.ArcticEventAdmin = {
    openWorkspace: openWorkspace,
    validateAndSave: validateAndSave,
    loadTemplateDraft: loadTemplateDraft
  };

  initializeEditor();
}());
