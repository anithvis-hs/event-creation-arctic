(function () {
  'use strict';

  const STORAGE_KEY = 'arctic-ai-event-admin-draft-v4-stacked';
  const CANVAS_NODE_WIDTH = 220;
  const CANVAS_NODE_HEIGHT = 56;
  const CANVAS_TERMINAL_WIDTH = 132;
  const CANVAS_TERMINAL_HEIGHT = 36;
  const CANVAS_ROW_GAP = 48;
  const CANVAS_COL_GAP = 48;
  // Deeper than a normal row so the fan-out bus and its branch labels have room.
  const CANVAS_BRANCH_GAP = 84;
  const CANVAS_BRANCH_BUS_OFFSET = 26;
  const CANVAS_PADDING = 48;
  const CANVAS_CORNER = 10;
  // The stacked spine is much taller than it is wide, so "Fit graph" needs to be
  // able to zoom out further than the old free-form canvas did.
  const CANVAS_MIN_ZOOM = 0.25;
  const CANVAS_MAX_ZOOM = 1.6;
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

  // Drives the stacked spine: node order on the canvas is derived from this list,
  // never from stored coordinates.
  const CANONICAL_ROOT_ORDER = [
    NODE_TYPES.BASICS,
    NODE_TYPES.REGISTRATION,
    NODE_TYPES.BANNER,
    NODE_TYPES.INSTRUCTORS,
    NODE_TYPES.SESSIONS
  ];

  const NODE_VISUALS = {};
  NODE_VISUALS[NODE_TYPES.BASICS] = { kind: 'Event details', glyph: 'Ev', tone: 'blue' };
  NODE_VISUALS[NODE_TYPES.REGISTRATION] = { kind: 'Registration', glyph: 'Rg', tone: 'blue' };
  NODE_VISUALS[NODE_TYPES.BANNER] = { kind: 'Media', glyph: 'Bn', tone: 'slate' };
  NODE_VISUALS[NODE_TYPES.INSTRUCTORS] = { kind: 'People', glyph: 'In', tone: 'slate' };
  NODE_VISUALS[NODE_TYPES.SESSIONS] = { kind: 'Branch point', glyph: 'Sc', tone: 'accent' };
  NODE_VISUALS[NODE_TYPES.SESSION] = { kind: 'Session branch', glyph: 'Se', tone: 'accent' };
  NODE_VISUALS[NODE_TYPES.SESSION_BASICS] = { kind: 'Session detail', glyph: 'Ba', tone: 'slate' };
  NODE_VISUALS[NODE_TYPES.SESSION_SCHEDULE] = { kind: 'Session detail', glyph: 'Sh', tone: 'slate' };
  NODE_VISUALS[NODE_TYPES.SESSION_VENUE] = { kind: 'Session detail', glyph: 'Vn', tone: 'slate' };
  NODE_VISUALS[NODE_TYPES.SESSION_CAPACITY] = { kind: 'Session detail', glyph: 'Cp', tone: 'slate' };
  NODE_VISUALS[NODE_TYPES.SESSION_INSTRUCTORS] = { kind: 'Session detail', glyph: 'In', tone: 'slate' };
  NODE_VISUALS[NODE_TYPES.SESSION_MATERIALS] = { kind: 'Session detail', glyph: 'Mt', tone: 'slate' };
  NODE_VISUALS[NODE_TYPES.SESSION_REG_RULES] = { kind: 'Session detail', glyph: 'Rr', tone: 'slate' };
  NODE_VISUALS[NODE_TYPES.SESSION_PUBLISH_CHECKS] = { kind: 'Readiness', glyph: 'Pc', tone: 'green' };

  function getNodeVisual(type) {
    return NODE_VISUALS[type] || { kind: 'Node', glyph: '??', tone: 'slate' };
  }

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
    workspaceReviewButton: document.getElementById('workspace-review-button'),
    workspacePublishButton: document.getElementById('workspace-publish-button'),
    closeButton: document.getElementById('event-admin-close-button'),
    saveButton: document.getElementById('event-admin-save-button'),
    reviewButton: document.getElementById('event-admin-review-button'),
    publishButton: document.getElementById('event-admin-publish-button'),
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
    fitGraphButton: document.getElementById('event-canvas-fit-graph'),
    publishReviewModal: document.getElementById('event-publish-review-modal'),
    publishBlockersList: document.getElementById('event-publish-blockers-list'),
    publishWarningsList: document.getElementById('event-publish-warnings-list'),
    publishBlockersEmpty: document.getElementById('event-publish-blockers-empty'),
    publishWarningsEmpty: document.getElementById('event-publish-warnings-empty'),
    publishAckWrap: document.getElementById('event-publish-ack-wrap'),
    publishAckCheckbox: document.getElementById('event-publish-ack-checkbox'),
    publishAckNoteWrap: document.getElementById('event-publish-ack-note-wrap'),
    publishAckNote: document.getElementById('event-publish-ack-note'),
    publishSubmitButton: document.getElementById('event-publish-submit'),
    publishSuccessChip: document.getElementById('event-publish-success-chip')
  };

  if (!DOM.palette || !DOM.canvas || !DOM.form) return;

  const isEmbeddedWorkspace = Boolean(document.getElementById('workspace-event-view'));

  const state = {
    draft: null,
    selectedNodeId: null,
    attemptedNodeIds: {},
    isInitialized: false,
    canvasView: { scale: 1, panX: 0, panY: 0 },
    panDrag: null,
    spacePanActive: false,
    layout: null,
    openInsertKey: null
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
        templateChosen: false,
        validationAttempted: false,
        publishedAt: null,
        publishStatus: 'draft',
        warningsAcknowledged: false,
        warningsAckNote: ''
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
    syncGraphStructure(draft);
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
    syncGraphStructure(draft);
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
    syncGraphStructure(draft);
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

  // Coordinates are derived from the graph at render time, so they never persist.
  function omitDerivedCoords(key, value) {
    if (key === 'x' || key === 'y') return undefined;
    return value;
  }

  function saveDraft(manual) {
    if (!state.draft) return;
    state.draft.meta.lastSavedAt = Date.now();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.draft, omitDerivedCoords));
    if (manual) state.draft.meta.isDirty = false;
  }

  function getNodeById(nodeId) {
    return state.draft.nodes.find(function (node) { return node.id === nodeId; });
  }

  function selectCanvasNode(nodeId) {
    state.selectedNodeId = nodeId;
    state.openInsertKey = null;
    clearAlert();
    renderAll();
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
  }

  function finishPanDrag() {
    state.panDrag = null;
  }

  function markDirty() {
    if (!state.draft) return;
    const wasPublished = state.draft.meta.publishStatus === 'published';
    state.draft.meta.isDirty = true;
    state.draft.meta.publishStatus = 'draft';
    state.draft.meta.publishedAt = null;
    state.draft.meta.warningsAcknowledged = false;
    state.draft.meta.warningsAckNote = '';
    saveDraft(false);
    renderSummary();
    updateHeaderButtons();
    if (wasPublished) showToast('Changes require a new review before publishing.', 4000);
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

  function syncGraphStructure(draft) {
    syncSessionIndex(draft);
  }

  function getSpineRootNodes(draft) {
    const byType = {};
    draft.nodes.forEach(function (node) {
      if (CANONICAL_ROOT_ORDER.indexOf(node.type) > -1 && !byType[node.type]) byType[node.type] = node;
    });
    return CANONICAL_ROOT_ORDER
      .map(function (type) { return byType[type]; })
      .filter(Boolean);
  }

  function getInsertTypesForGap(draft, prevType, nextType) {
    const prevIndex = prevType ? CANONICAL_ROOT_ORDER.indexOf(prevType) : -1;
    const nextIndex = nextType ? CANONICAL_ROOT_ORDER.indexOf(nextType) : CANONICAL_ROOT_ORDER.length;
    return CANONICAL_ROOT_ORDER.filter(function (type, index) {
      if (index <= prevIndex || index >= nextIndex) return false;
      return !findSingletonNodeId(draft, type);
    });
  }

  function makeLayoutEntry(node, x, y) {
    return {
      id: node.id,
      node: node,
      isTerminal: false,
      x: x,
      y: y,
      width: CANVAS_NODE_WIDTH,
      height: CANVAS_NODE_HEIGHT
    };
  }

  function makeTerminalEntry(id, label, x, y) {
    return {
      id: id,
      node: null,
      isTerminal: true,
      label: label,
      x: x,
      y: y,
      width: CANVAS_TERMINAL_WIDTH,
      height: CANVAS_TERMINAL_HEIGHT
    };
  }

  function entryBottom(entry) {
    return entry.y + entry.height;
  }

  function entryCenterX(entry) {
    return entry.x + (entry.width / 2);
  }

  // Vertical -> horizontal -> vertical elbow with rounded corners. Collapses to a
  // straight line when the two endpoints already share a column.
  function buildElbowPath(x1, y1, x2, y2, busY) {
    if (Math.abs(x2 - x1) < 0.5) return `M ${x1} ${y1} L ${x1} ${y2}`;
    const direction = x2 > x1 ? 1 : -1;
    const radius = Math.max(0, Math.min(
      CANVAS_CORNER,
      Math.abs(x2 - x1) / 2,
      Math.abs(busY - y1),
      Math.abs(y2 - busY)
    ));
    return [
      `M ${x1} ${y1}`,
      `L ${x1} ${busY - radius}`,
      `Q ${x1} ${busY} ${x1 + (radius * direction)} ${busY}`,
      `L ${x2 - (radius * direction)} ${busY}`,
      `Q ${x2} ${busY} ${x2} ${busY + radius}`,
      `L ${x2} ${y2}`
    ].join(' ');
  }

  /**
   * Positions every node from the graph hierarchy alone. Nothing here reads or
   * writes node.x / node.y — the canvas is a pure function of the draft.
   */
  function buildLayoutTree(draft) {
    syncGraphStructure(draft);

    const entries = [];
    const connectors = [];
    const inserts = [];
    const branchLabels = [];

    const spineNodes = getSpineRootNodes(draft);
    const sessionsContainer = spineNodes.find(function (node) { return node.type === NODE_TYPES.SESSIONS; }) || null;
    const sessionIds = sessionsContainer ? draft.sessions.slice() : [];
    const columnCount = sessionIds.length;

    const branchWidth = columnCount
      ? (columnCount * CANVAS_NODE_WIDTH) + ((columnCount - 1) * CANVAS_COL_GAP)
      : 0;
    const contentWidth = Math.max(CANVAS_NODE_WIDTH, branchWidth);
    const centerX = CANVAS_PADDING + (contentWidth / 2);

    function pushSpineInsert(fromEntry, toEntryY, prevType, nextType, extraTypes) {
      const types = getInsertTypesForGap(draft, prevType, nextType).concat(extraTypes || []);
      if (!types.length) return;
      inserts.push({
        key: `slot-${prevType || 'start'}-${nextType || 'end'}`,
        x: centerX,
        y: (entryBottom(fromEntry) + toEntryY) / 2,
        types: types
      });
    }

    let cursorY = CANVAS_PADDING;
    const startEntry = makeTerminalEntry('__start', 'Start', centerX - (CANVAS_TERMINAL_WIDTH / 2), cursorY);
    entries.push(startEntry);
    cursorY = entryBottom(startEntry) + CANVAS_ROW_GAP;

    let previousEntry = startEntry;
    let previousType = null;

    spineNodes.forEach(function (node) {
      const entry = makeLayoutEntry(node, centerX - (CANVAS_NODE_WIDTH / 2), cursorY);
      entries.push(entry);
      connectors.push({
        kind: 'spine',
        d: `M ${centerX} ${entryBottom(previousEntry)} L ${centerX} ${entry.y}`
      });
      pushSpineInsert(previousEntry, entry.y, previousType, node.type);
      previousEntry = entry;
      previousType = node.type;
      cursorY = entryBottom(entry) + CANVAS_ROW_GAP;
    });

    let mergeSources = [];

    if (columnCount) {
      const branchTop = entryBottom(previousEntry) + CANVAS_BRANCH_GAP;
      const fanBusY = entryBottom(previousEntry) + CANVAS_BRANCH_BUS_OFFSET;
      const branchStartX = centerX - (branchWidth / 2);
      let branchBottom = branchTop;

      sessionIds.forEach(function (sessionId, columnIndex) {
        const sessionNode = draft.nodes.find(function (item) { return item.id === sessionId; });
        if (!sessionNode) return;

        const columnX = branchStartX + (columnIndex * (CANVAS_NODE_WIDTH + CANVAS_COL_GAP));
        const columnCenterX = columnX + (CANVAS_NODE_WIDTH / 2);
        const headEntry = makeLayoutEntry(sessionNode, columnX, branchTop);
        entries.push(headEntry);

        connectors.push({
          kind: 'branch',
          d: buildElbowPath(centerX, entryBottom(previousEntry), columnCenterX, headEntry.y, fanBusY)
        });

        const payload = draft.payloadByNodeId[sessionId] || {};
        branchLabels.push({
          x: columnCenterX,
          y: (fanBusY + branchTop) / 2,
          text: cleanText(payload.title) || cleanText(sessionNode.label) || `Session ${columnIndex + 1}`
        });

        let columnTail = headEntry;
        getSessionChildNodes(draft, sessionId).forEach(function (child) {
          const childEntry = makeLayoutEntry(child, columnX, entryBottom(columnTail) + CANVAS_ROW_GAP);
          entries.push(childEntry);
          connectors.push({
            kind: 'spine',
            d: `M ${columnCenterX} ${entryBottom(columnTail)} L ${columnCenterX} ${childEntry.y}`
          });
          columnTail = childEntry;
        });

        mergeSources.push(columnTail);
        branchBottom = Math.max(branchBottom, entryBottom(columnTail));
      });

      // Stub extending the fan-out bus so the add-branch button reads as part of it.
      const addSessionX = branchStartX + branchWidth + CANVAS_COL_GAP;
      connectors.push({
        kind: 'stub',
        d: `M ${branchStartX + branchWidth - (CANVAS_NODE_WIDTH / 2)} ${fanBusY} L ${addSessionX - 14} ${fanBusY}`
      });
      inserts.push({
        key: 'branch-add-session',
        x: addSessionX,
        y: fanBusY,
        types: [NODE_TYPES.SESSION]
      });

      cursorY = branchBottom + CANVAS_ROW_GAP;
    } else {
      mergeSources = [previousEntry];
    }

    const endEntry = makeTerminalEntry('__end', 'End', centerX - (CANVAS_TERMINAL_WIDTH / 2), cursorY);
    entries.push(endEntry);

    if (columnCount) {
      const mergeBusY = endEntry.y - (CANVAS_ROW_GAP / 2);
      mergeSources.forEach(function (source) {
        connectors.push({
          kind: 'branch',
          d: buildElbowPath(entryCenterX(source), entryBottom(source), centerX, endEntry.y, mergeBusY)
        });
      });
    } else {
      connectors.push({
        kind: 'spine',
        d: `M ${centerX} ${entryBottom(previousEntry)} L ${centerX} ${endEntry.y}`
      });
      pushSpineInsert(
        previousEntry,
        endEntry.y,
        previousType,
        null,
        sessionsContainer ? [NODE_TYPES.SESSION] : []
      );
    }

    const rightEdge = entries.reduce(function (max, entry) {
      return Math.max(max, entry.x + entry.width);
    }, centerX + (contentWidth / 2));
    const insertEdge = inserts.reduce(function (max, insert) {
      return Math.max(max, insert.x + 16);
    }, 0);

    return {
      entries: entries,
      connectors: connectors,
      inserts: inserts,
      branchLabels: branchLabels,
      width: Math.max(rightEdge, insertEdge) + CANVAS_PADDING,
      height: entryBottom(endEntry) + CANVAS_PADDING
    };
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
      addEdgeIfMissing(draft, sessionId, childId);
    });

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
    if (!draft.meta) draft.meta = {};
    if (typeof draft.meta.validationAttempted !== 'boolean') draft.meta.validationAttempted = false;
    if (typeof draft.meta.publishedAt !== 'number') draft.meta.publishedAt = null;
    if (!draft.meta.publishStatus) draft.meta.publishStatus = 'draft';
    if (typeof draft.meta.warningsAcknowledged !== 'boolean') draft.meta.warningsAcknowledged = false;
    if (typeof draft.meta.warningsAckNote !== 'string') draft.meta.warningsAckNote = '';

    // Positions are derived at render time now; drop any coordinates left by
    // older free-form drafts.
    draft.nodes.forEach(function (node) {
      delete node.x;
      delete node.y;
    });

    draft.nodes
      .filter(function (node) { return node.type === NODE_TYPES.SESSION; })
      .forEach(function (sessionNode) { ensureSessionBranch(draft, sessionNode.id); });

    syncGraphStructure(draft);
    syncDefaultEdges(draft);
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
    const newScale = Math.max(CANVAS_MIN_ZOOM, Math.min(CANVAS_MAX_ZOOM, oldScale + deltaScale));
    if (newScale === oldScale) return;
    const ratio = newScale / oldScale;
    state.canvasView.panX = point.x - (point.x - state.canvasView.panX) * ratio;
    state.canvasView.panY = point.y - (point.y - state.canvasView.panY) * ratio;
    state.canvasView.scale = newScale;
  }

  function setCanvasZoom(nextScale) {
    state.canvasView.scale = Math.max(CANVAS_MIN_ZOOM, Math.min(CANVAS_MAX_ZOOM, nextScale));
    applyCanvasTransform();
  }

  function resetCanvasView() {
    state.canvasView = { scale: 1, panX: 0, panY: 0 };
    applyCanvasTransform();
  }

  function fitCanvasToGraph() {
    if (!state.draft || !state.layout) return;
    const padding = 32;
    const graphWidth = state.layout.width;
    const graphHeight = state.layout.height;
    const viewWidth = Math.max(1, DOM.canvas.clientWidth);
    const viewHeight = Math.max(1, DOM.canvas.clientHeight);
    const scaleX = (viewWidth - (padding * 2)) / graphWidth;
    const scaleY = (viewHeight - (padding * 2)) / graphHeight;
    const scale = Math.max(CANVAS_MIN_ZOOM, Math.min(CANVAS_MAX_ZOOM, Math.min(scaleX, scaleY, 1)));
    state.canvasView.scale = scale;
    state.canvasView.panX = Math.max(0, (viewWidth - (graphWidth * scale)) / 2);
    state.canvasView.panY = 0;
    applyCanvasTransform();
  }

  function setSpacePanActive(isActive) {
    state.spacePanActive = isActive;
    DOM.canvas.classList.toggle('is-space-pan', isActive);
  }

  function createNodePayload(type, nodeId, draft) {
    if (type === NODE_TYPES.BASICS) return { title: '', description: '', spot: '' };
    if (type === NODE_TYPES.REGISTRATION) return { modes: [] };
    if (type === NODE_TYPES.BANNER) return { fileName: '', fileType: '', fileSize: 0 };
    if (type === NODE_TYPES.INSTRUCTORS) return { entries: [] };
    if (type === NODE_TYPES.SESSIONS) return { sessionIds: [] };
    if (type === NODE_TYPES.SESSION) return { title: `Session ${countNodesOfType(draft, NODE_TYPES.SESSION)}` };
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

  function addEdgeIfMissing(draft, from, to) {
    const existing = draft.edges.find(function (edge) { return edge.from === from && edge.to === to; });
    if (existing) return;
    draft.edges.push({ from: from, to: to });
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
      if (!from || !to) return;
      addEdgeIfMissing(draft, from, to);
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
      if (targetDraft === state.draft) setAlert('Add a Sessions Container node before adding Session nodes.', true);
      return null;
    }

    const definition = getNodeDefinition(type);
    const nodeId = makeNodeId(type);
    const newNode = {
      id: nodeId,
      type: type,
      label: definition ? cleanText(definition.label) : cleanText(type),
      helper: definition ? cleanText(definition.helper) : '',
      required: definition ? definition.required : false,
      order: draft.nodes.length + 1
    };

    draft.nodes.push(newNode);
    draft.payloadByNodeId[nodeId] = createNodePayload(type, nodeId, draft);

    if (type === NODE_TYPES.SESSION) {
      ensureSessionBranch(draft, nodeId);
      draft.meta.templateChosen = true;
    }

    syncDefaultEdges(draft);
    syncGraphStructure(draft);

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
    syncGraphStructure(state.draft);
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

    syncGraphStructure(state.draft);
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
    syncGraphStructure(state.draft);
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
        const sessionId = titles[title][0];
        const basicsNode = getSessionChildNodes(draft, sessionId).find(function (node) {
          return node.type === NODE_TYPES.SESSION_BASICS;
        });
        conflicts.push({
          type: 'warning',
          message: `Duplicate session title "${title}" appears ${titles[title].length} times.`,
          nodeId: basicsNode ? basicsNode.id : null,
          sessionId: sessionId
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
          const venueNode = getSessionChildNodes(draft, leftId).find(function (node) {
            return node.type === NODE_TYPES.SESSION_VENUE;
          });
          conflicts.push({
            type: 'error',
            message: `Venue collision: "${leftVenue.location}" is double-booked.`,
            nodeId: venueNode ? venueNode.id : null,
            sessionId: leftId
          });
        }

        leftInstructors.forEach(function (leftEntry) {
          if (rightInstructors.indexOf(leftEntry) > -1) {
            const instructorNode = getSessionChildNodes(draft, leftId).find(function (node) {
              return node.type === NODE_TYPES.SESSION_INSTRUCTORS;
            });
            conflicts.push({
              type: 'error',
              message: `Instructor "${leftEntry}" is double-booked across overlapping sessions.`,
              nodeId: instructorNode ? instructorNode.id : null,
              sessionId: leftId
            });
          }
        });
      }
    }

    draft.conflicts = conflicts;
    return conflicts;
  }

  function makeChecklistItem(severity, message, nodeId, sessionId) {
    return {
      severity: severity,
      message: message,
      nodeId: nodeId || null,
      sessionId: sessionId || null
    };
  }

  function normalizeChecklistItem(item, severity) {
    if (item && typeof item === 'object' && item.message) {
      return {
        severity: item.severity || severity,
        message: item.message,
        nodeId: item.nodeId || null,
        sessionId: item.sessionId || null
      };
    }
    return makeChecklistItem(severity, String(item || ''), null, null);
  }

  function computePublishChecklist(draft) {
    const blockers = [];
    const warnings = [];

    draft.nodes.filter(function (node) { return node.required && !isSessionChildType(node.type); }).forEach(function (node) {
      validateNode(node).errors.forEach(function (error) {
        blockers.push(makeChecklistItem('blocker', `${node.label}: ${error}`, node.id, null));
      });
    });

    (draft.sessions || []).forEach(function (sessionId) {
      const sessionNode = draft.nodes.find(function (node) { return node.id === sessionId; });
      getSessionChildNodes(draft, sessionId).forEach(function (child) {
        if (!child.required) return;
        validateNode(child).errors.forEach(function (error) {
          blockers.push(makeChecklistItem(
            'blocker',
            `${sessionNode ? sessionNode.label : 'Session'} / ${child.label}: ${error}`,
            child.id,
            sessionId
          ));
        });
      });
    });

    computeConflicts(draft).forEach(function (conflict) {
      const item = makeChecklistItem(
        conflict.type === 'error' ? 'blocker' : 'warning',
        conflict.message,
        conflict.nodeId,
        conflict.sessionId
      );
      if (conflict.type === 'error') blockers.push(item);
      else warnings.push(item);
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
      const isUsed = SINGLETON_TYPES.indexOf(item.type) > -1 && Boolean(findSingletonNodeId(state.draft, item.type));
      const visual = getNodeVisual(item.type);
      return `<button type="button" class="event-palette-item${isUsed ? ' is-used' : ''}" data-node-type="${item.type}"${isUsed ? ' disabled' : ''}>`
        + `<span class="event-palette-tile event-canvas-tone-${visual.tone}" aria-hidden="true">${escapeHtml(visual.glyph)}</span>`
        + '<span class="event-palette-copy">'
        + `<span class="event-palette-title">${escapeHtml(item.label)}</span>`
        + `<span class="event-palette-helper">${escapeHtml(isUsed ? 'Already on the canvas' : item.helper)}</span>`
        + '</span>'
        + '</button>';
    }).join('');
  }

  function nodeShowCanvasError(node) {
    const validation = validateNode(node);
    if (!validation.errors.length) return false;
    return Boolean(state.attemptedNodeIds[node.id]) || Boolean(state.draft.meta.validationAttempted);
  }

  function renderCanvasNode(entry) {
    const node = entry.node;
    const status = nodeStatus(node);
    const isActive = state.selectedNodeId === node.id;
    const nodeLabel = cleanText(node.label);
    const visual = getNodeVisual(node.type);
    const isChild = isSessionChildType(node.type);
    const showError = nodeShowCanvasError(node);

    const removeButton = (node.type === NODE_TYPES.SESSION || isChild)
      ? ''
      : `<button type="button" class="event-canvas-node-remove" data-action="remove-node" data-node-id="${node.id}" aria-label="Remove ${escapeHtml(nodeLabel)}">\u00d7</button>`;

    const classNames = ['event-canvas-node'];
    if (node.type === NODE_TYPES.SESSION) classNames.push('event-canvas-node-session');
    if (isChild) classNames.push('event-canvas-node-child');
    if (showError) classNames.push('event-canvas-node-has-error');
    if (isActive) classNames.push('is-active');

    const errorBadge = showError
      ? '<span class="event-canvas-node-error-badge" aria-label="Needs attention">!</span>'
      : '';

    return `<div class="${classNames.join(' ')}" data-node-id="${node.id}" role="button" tabindex="0" aria-pressed="${isActive}" style="left:${entry.x}px;top:${entry.y}px;width:${entry.width}px;height:${entry.height}px">`
      + removeButton
      + errorBadge
      + `<span class="event-canvas-node-tile event-canvas-tone-${visual.tone}" aria-hidden="true">${escapeHtml(visual.glyph)}</span>`
      + '<span class="event-canvas-node-copy">'
      + `<span class="event-canvas-node-title">${escapeHtml(nodeLabel)}</span>`
      + '<span class="event-canvas-node-meta">'
      + `<span class="event-canvas-node-kind">${escapeHtml(visual.kind)}</span>`
      + `<span class="event-status ${statusClass(status)}">${escapeHtml(status)}</span>`
      + '</span>'
      + '</span>'
      + '</div>';
  }

  function renderCanvasTerminal(entry) {
    return `<div class="event-canvas-terminal" style="left:${entry.x}px;top:${entry.y}px;width:${entry.width}px;height:${entry.height}px">${escapeHtml(entry.label)}</div>`;
  }

  function renderCanvasConnectors(layout) {
    const defs = '<defs><marker id="event-canvas-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" fill="rgba(51, 78, 92, 0.38)"></path></marker></defs>';
    const paths = layout.connectors.map(function (connector) {
      const marker = connector.kind === 'stub' ? '' : ' marker-end="url(#event-canvas-arrow)"';
      return `<path class="event-canvas-edge-path is-${connector.kind}" d="${connector.d}"${marker}></path>`;
    }).join('');

    return `<svg class="event-canvas-edges" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">${defs}${paths}</svg>`;
  }

  function renderBranchLabels(layout) {
    return layout.branchLabels.map(function (label) {
      return `<span class="event-canvas-branch-label" style="left:${label.x}px;top:${label.y}px" aria-hidden="true">${escapeHtml(label.text)}</span>`;
    }).join('');
  }

  function renderInsertMenu(insert) {
    const options = insert.types.map(function (type) {
      const definition = getNodeDefinition(type) || { label: type, helper: '' };
      return `<button type="button" class="event-canvas-insert-option" data-insert-type="${type}" data-insert-key="${insert.key}">`
        + `<span class="event-canvas-insert-option-title">${escapeHtml(definition.label)}</span>`
        + `<span class="event-canvas-insert-option-helper">${escapeHtml(definition.helper)}</span>`
        + '</button>';
    }).join('');
    return `<div class="event-canvas-insert-menu" role="menu">${options}</div>`;
  }

  function renderCanvasInserts(layout) {
    return layout.inserts.map(function (insert) {
      const isOpen = state.openInsertKey === insert.key;
      const singleType = insert.types.length === 1 ? getNodeDefinition(insert.types[0]) : null;
      const description = singleType ? `Add ${cleanText(singleType.label)}` : 'Add a node here';
      return `<div class="event-canvas-insert${isOpen ? ' is-open' : ''}" style="left:${insert.x}px;top:${insert.y}px">`
        + `<button type="button" class="event-canvas-insert-button" data-insert-toggle="${insert.key}" aria-label="${escapeHtml(description)}" title="${escapeHtml(description)}" aria-expanded="${isOpen}">+</button>`
        + (isOpen ? renderInsertMenu(insert) : '')
        + '</div>';
    }).join('');
  }

  function renderCanvas() {
    if (!state.draft) return;

    const layout = buildLayoutTree(state.draft);
    state.layout = layout;
    state.draft.meta.graphWidth = layout.width;
    state.draft.meta.graphHeight = layout.height;

    const nodesMarkup = layout.entries.map(function (entry) {
      return entry.isTerminal ? renderCanvasTerminal(entry) : renderCanvasNode(entry);
    }).join('');

    DOM.canvas.innerHTML = '<div class="event-canvas-viewport" id="event-canvas-viewport">'
      + `<div class="event-canvas-graph" id="event-canvas-graph" style="width:${layout.width}px;height:${layout.height}px">`
      + renderCanvasConnectors(layout)
      + renderBranchLabels(layout)
      + `<div class="event-canvas-node-layer">${nodesMarkup}</div>`
      + `<div class="event-canvas-insert-layer">${renderCanvasInserts(layout)}</div>`
      + '</div></div>';

    applyCanvasTransform();
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
    let statusLabel = `Draft saved at ${syncedAt}`;
    if (state.draft.meta.publishStatus === 'published' && state.draft.meta.publishedAt) {
      const publishedAt = new Date(state.draft.meta.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      statusLabel = `Published at ${publishedAt}`;
    } else if (state.draft.meta.validationAttempted) {
      const checklist = state.draft.publishChecklist || { blockers: [], warnings: [] };
      statusLabel = `${checklist.blockers.length} blocker(s) · ${checklist.warnings.length} warning(s)`;
    } else if (state.draft.meta.isDirty) {
      statusLabel = 'Unsaved changes';
    }
    DOM.meta.textContent = `${templateLabel} · ${statusLabel}.`;
    updateHeaderButtons();
    updatePublishSuccessChip();
  }

  function updateHeaderButtons() {
    const isPublished = state.draft && state.draft.meta.publishStatus === 'published';
    [DOM.workspacePublishButton, DOM.publishButton].forEach(function (button) {
      if (!button) return;
      button.disabled = isPublished;
      button.setAttribute('aria-disabled', isPublished ? 'true' : 'false');
    });
  }

  function updatePublishSuccessChip() {
    if (!DOM.publishSuccessChip || !state.draft) return;
    const isPublished = state.draft.meta.publishStatus === 'published';
    DOM.publishSuccessChip.classList.toggle('is-hidden', !isPublished);
    if (isPublished && state.draft.meta.publishedAt) {
      const publishedAt = new Date(state.draft.meta.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      DOM.publishSuccessChip.textContent = `Published at ${publishedAt}`;
    }
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

  function jumpToChecklistItem(nodeId) {
    if (!nodeId) return;
    state.selectedNodeId = nodeId;
    state.attemptedNodeIds[nodeId] = true;
    hidePublishReviewModal();
    clearAlert();
    renderAll();
  }

  function showPublishReviewModal() {
    if (!DOM.publishReviewModal) return;
    DOM.publishReviewModal.classList.remove('is-hidden');
  }

  function hidePublishReviewModal() {
    if (!DOM.publishReviewModal) return;
    DOM.publishReviewModal.classList.add('is-hidden');
  }

  function renderPublishReviewModal(checklist) {
    if (!DOM.publishReviewModal || !checklist) return;

    const blockers = (checklist.blockers || []).map(function (item) {
      return normalizeChecklistItem(item, 'blocker');
    });
    const warnings = (checklist.warnings || []).map(function (item) {
      return normalizeChecklistItem(item, 'warning');
    });

    if (DOM.publishBlockersList) {
      DOM.publishBlockersList.innerHTML = blockers.length
        ? blockers.map(function (item, index) {
          const fixButton = item.nodeId
            ? `<button type="button" class="event-link-button" data-action="fix-checklist-item" data-node-id="${escapeHtml(item.nodeId)}">Fix</button>`
            : '';
          return `<li class="event-publish-review-item is-blocker"><span>${escapeHtml(item.message)}</span>${fixButton}</li>`;
        }).join('')
        : '';
    }
    if (DOM.publishBlockersEmpty) {
      DOM.publishBlockersEmpty.classList.toggle('is-hidden', blockers.length > 0);
    }

    if (DOM.publishWarningsList) {
      DOM.publishWarningsList.innerHTML = warnings.length
        ? warnings.map(function (item) {
          const fixButton = item.nodeId
            ? `<button type="button" class="event-link-button" data-action="fix-checklist-item" data-node-id="${escapeHtml(item.nodeId)}">Fix</button>`
            : '';
          return `<li class="event-publish-review-item is-warning"><span>${escapeHtml(item.message)}</span>${fixButton}</li>`;
        }).join('')
        : '';
    }
    if (DOM.publishWarningsEmpty) {
      DOM.publishWarningsEmpty.classList.toggle('is-hidden', warnings.length > 0);
    }

    const showAck = warnings.length > 0;
    if (DOM.publishAckWrap) DOM.publishAckWrap.classList.toggle('is-hidden', !showAck);
    if (DOM.publishAckNoteWrap) DOM.publishAckNoteWrap.classList.toggle('is-hidden', !showAck);
    if (DOM.publishAckCheckbox) {
      DOM.publishAckCheckbox.checked = Boolean(state.draft.meta.warningsAcknowledged);
    }
    if (DOM.publishAckNote) {
      DOM.publishAckNote.value = state.draft.meta.warningsAckNote || '';
    }

    const canPublish = blockers.length === 0 && (!warnings.length || state.draft.meta.warningsAcknowledged);
    if (DOM.publishSubmitButton) {
      DOM.publishSubmitButton.disabled = !canPublish;
    }
  }

  function syncPublishAckFromModal() {
    if (!state.draft) return;
    if (DOM.publishAckCheckbox) {
      state.draft.meta.warningsAcknowledged = DOM.publishAckCheckbox.checked;
    }
    if (DOM.publishAckNote) {
      state.draft.meta.warningsAckNote = DOM.publishAckNote.value.trim();
    }
  }

  function runEventValidation() {
    if (!state.draft) return { brokenNode: null, checklist: null, noRequiredNodes: true };

    state.draft.meta.validationAttempted = true;

    const requiredNodes = state.draft.nodes.filter(function (node) {
      return node.required && !isSessionChildType(node.type);
    });

    if (!requiredNodes.length) {
      return { brokenNode: null, checklist: computePublishChecklist(state.draft), noRequiredNodes: true };
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
    if (!brokenNode && checklist.blockers.length) {
      const firstBlocker = normalizeChecklistItem(checklist.blockers[0], 'blocker');
      if (firstBlocker.nodeId) {
        brokenNode = getNodeById(firstBlocker.nodeId);
      }
    }

    return { brokenNode: brokenNode, checklist: checklist, noRequiredNodes: false };
  }

  function saveDraftLocal() {
    if (!state.isInitialized || !state.draft) return;
    if (!state.draft.nodes.length) {
      setAlert('Add nodes to the canvas before saving.', true);
      return;
    }

    state.draft.meta.isDirty = false;
    saveDraft(false);
    renderSummary();
    clearAlert();
    showToast('Draft saved locally.', 4000);
  }

  function openPublishReview() {
    if (!state.isInitialized || !state.draft) return;

    const result = runEventValidation();
    if (result.noRequiredNodes) {
      setAlert('Add required nodes to canvas first (Basics, Registration, Sessions Container).', true);
      return;
    }

    state.draft.meta.publishStatus = 'reviewed';
    renderAll();
    renderPublishReviewModal(result.checklist);
    showPublishReviewModal();
    clearAlert();

    if (result.brokenNode) {
      setAlert(`Review found issues in ${result.brokenNode.label}. Fix blockers before publishing.`, true);
    }
  }

  function rerunPublishReview() {
    syncPublishAckFromModal();
    const result = runEventValidation();
    renderAll();
    renderPublishReviewModal(result.checklist);
    showPublishReviewModal();
  }

  function publishEvent() {
    if (!state.isInitialized || !state.draft) return;
    if (state.draft.meta.publishStatus === 'published') return;

    syncPublishAckFromModal();
    const result = runEventValidation();
    const checklist = result.checklist;
    renderPublishReviewModal(checklist);

    if (checklist.blockers.length) {
      showPublishReviewModal();
      setAlert(`Publish blocked: ${normalizeChecklistItem(checklist.blockers[0], 'blocker').message}`, true);
      renderAll();
      return;
    }

    if (checklist.warnings.length && !state.draft.meta.warningsAcknowledged) {
      showPublishReviewModal();
      setAlert('Acknowledge warnings before publishing.', true);
      renderAll();
      return;
    }

    state.draft.meta.publishStatus = 'published';
    state.draft.meta.publishedAt = Date.now();
    state.draft.meta.isDirty = false;
    saveDraft(false);
    hidePublishReviewModal();
    renderAll();
    clearAlert();
    showToast('Event published.', 5000);
    showPublishSuccessSummary();
  }

  function publishShortcut() {
    if (!state.isInitialized || !state.draft) return;
    if (state.draft.meta.publishStatus === 'published') return;

    const modalOpen = DOM.publishReviewModal && !DOM.publishReviewModal.classList.contains('is-hidden');
    if (modalOpen) {
      publishEvent();
      return;
    }

    syncPublishAckFromModal();
    const result = runEventValidation();
    const checklist = result.checklist;

    if (result.noRequiredNodes) {
      setAlert('Add required nodes to canvas first (Basics, Registration, Sessions Container).', true);
      return;
    }

    if (!checklist.blockers.length && (!checklist.warnings.length || state.draft.meta.warningsAcknowledged)) {
      publishEvent();
      return;
    }

    openPublishReview();
  }

  function showPublishSuccessSummary() {
    const basicsNode = state.draft.nodes.find(function (node) { return node.type === NODE_TYPES.BASICS; });
    const basicsPayload = basicsNode ? (state.draft.payloadByNodeId[basicsNode.id] || {}) : {};
    const publishedAt = state.draft.meta.publishedAt
      ? new Date(state.draft.meta.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    const warningNote = state.draft.meta.warningsAckNote
      ? `<li>Warnings acknowledged: ${escapeHtml(state.draft.meta.warningsAckNote)}</li>`
      : '';

    if (isEmbeddedWorkspace) {
      const summaryHost = document.getElementById('workspace-event-saved-summary');
      if (!summaryHost) return;

      summaryHost.innerHTML = `
        <h2>Event published</h2>
        <p class="event-helper">${escapeHtml(basicsPayload.title || 'Untitled event')} · ${state.draft.sessions.length} session branch(es) · Live in prototype.</p>
        <ul>
          <li>Template: ${escapeHtml(state.draft.meta.templateId || 'Blank canvas')}</li>
          <li>Published at ${publishedAt}</li>
          ${warningNote}
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
      return;
    }

    const summaryHost = document.getElementById('event-publish-success-summary');
    if (!summaryHost) return;

    summaryHost.innerHTML = `
      <h2>Event published</h2>
      <p class="event-helper">${escapeHtml(basicsPayload.title || 'Untitled event')} · ${state.draft.sessions.length} session branch(es) · Prototype publish complete.</p>
      <ul>
        <li>Published at ${publishedAt}</li>
        ${warningNote}
      </ul>
    `;
    summaryHost.classList.remove('is-hidden');
  }

  function validateAndSave() {
    saveDraftLocal();
  }

  function loadDraft(draft) {
    migrateDraft(draft);
    draft.nodes.forEach(function (node) {
      node.label = cleanText(node.label);
      node.helper = cleanText(node.helper);
      node.type = cleanText(node.type);
    });
    state.draft = draft;
    state.openInsertKey = null;
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
    hidePublishReviewModal();
    const publishSummary = document.getElementById('event-publish-success-summary');
    if (publishSummary) publishSummary.classList.add('is-hidden');
    const workspaceSummary = document.getElementById('workspace-event-saved-summary');
    if (workspaceSummary) workspaceSummary.classList.add('is-hidden');
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
  DOM.saveButton && DOM.saveButton.addEventListener('click', saveDraftLocal);
  DOM.workspaceSaveButton && DOM.workspaceSaveButton.addEventListener('click', saveDraftLocal);
  DOM.reviewButton && DOM.reviewButton.addEventListener('click', openPublishReview);
  DOM.workspaceReviewButton && DOM.workspaceReviewButton.addEventListener('click', openPublishReview);
  DOM.publishButton && DOM.publishButton.addEventListener('click', publishShortcut);
  DOM.workspacePublishButton && DOM.workspacePublishButton.addEventListener('click', publishShortcut);

  if (DOM.publishReviewModal) {
    DOM.publishReviewModal.addEventListener('click', function (event) {
      const action = event.target.closest('[data-action]');
      if (!action) return;
      if (action.dataset.action === 'close-publish-review') {
        hidePublishReviewModal();
        return;
      }
      if (action.dataset.action === 'rerun-publish-review') {
        rerunPublishReview();
        return;
      }
      if (action.dataset.action === 'publish-event') {
        publishEvent();
        return;
      }
      if (action.dataset.action === 'fix-checklist-item') {
        jumpToChecklistItem(action.dataset.nodeId);
      }
    });
  }

  if (DOM.publishAckCheckbox) {
    DOM.publishAckCheckbox.addEventListener('change', function () {
      syncPublishAckFromModal();
      const checklist = computePublishChecklist(state.draft);
      renderPublishReviewModal(checklist);
    });
  }

  if (DOM.publishAckNote) {
    DOM.publishAckNote.addEventListener('input', function () {
      syncPublishAckFromModal();
    });
  }

  DOM.startBlankButton && DOM.startBlankButton.addEventListener('click', startBlankFromGallery);

  DOM.templateCards && DOM.templateCards.addEventListener('click', function (event) {
    const card = event.target.closest('[data-template-id]');
    if (!card) return;
    loadTemplateDraft(card.dataset.templateId);
    DOM.canvas.focus();
  });

  DOM.palette.addEventListener('click', function (event) {
    const item = event.target.closest('[data-node-type]');
    if (!item || !state.draft) return;
    const created = addNodeByType(state.draft, item.dataset.nodeType, true);
    if (!created) {
      renderAll();
      return;
    }
    markDirty();
    updateTemplateGalleryVisibility();
    renderAll();
  });

  DOM.canvas.addEventListener('mousedown', function (event) {
    if (event.button !== 0) return;
    if (event.target.closest('.event-canvas-insert')) return;

    const overEmptyGraph = event.target.classList.contains('event-canvas-graph')
      || event.target.classList.contains('event-canvas-viewport')
      || event.target === DOM.canvas;

    if (state.spacePanActive || event.altKey || overEmptyGraph) {
      event.preventDefault();
      startPanDrag(event);
    }
  });

  function handleCanvasMouseUp() {
    if (state.panDrag) finishPanDrag();
  }

  DOM.canvas.addEventListener('mouseup', handleCanvasMouseUp);
  document.addEventListener('mouseup', function (event) {
    if (!state.panDrag) return;
    if (DOM.canvas.contains(event.target)) return;
    handleCanvasMouseUp();
  });

  DOM.canvas.addEventListener('mousemove', function (event) {
    if (state.panDrag) movePanDrag(event);
  });

  document.addEventListener('mousemove', function (event) {
    if (!state.panDrag) return;
    if (DOM.canvas.contains(event.target)) return;
    movePanDrag(event);
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
  }, { passive: false });

  function insertNodeOfType(type) {
    state.openInsertKey = null;
    const created = addNodeByType(state.draft, type, true);
    if (!created) {
      renderAll();
      return;
    }
    markDirty();
    updateTemplateGalleryVisibility();
    renderAll();
  }

  DOM.canvas.addEventListener('click', function (event) {
    const option = event.target.closest('[data-insert-type]');
    if (option) {
      insertNodeOfType(option.dataset.insertType);
      return;
    }

    const toggle = event.target.closest('[data-insert-toggle]');
    if (toggle) {
      const key = toggle.dataset.insertToggle;
      const insert = state.layout
        ? state.layout.inserts.find(function (item) { return item.key === key; })
        : null;

      // A slot with a single eligible type has nothing to disambiguate.
      if (insert && insert.types.length === 1) {
        insertNodeOfType(insert.types[0]);
        return;
      }

      state.openInsertKey = state.openInsertKey === key ? null : key;
      renderCanvas();
      return;
    }

    const action = event.target.closest('[data-action]');
    if (action && action.dataset.action === 'remove-node') {
      state.openInsertKey = null;
      removeNode(action.dataset.nodeId);
      return;
    }

    const node = event.target.closest('.event-canvas-node[data-node-id]');
    if (node) {
      selectCanvasNode(node.dataset.nodeId);
      return;
    }

    if (state.openInsertKey) {
      state.openInsertKey = null;
      renderCanvas();
    }
  });

  DOM.canvas.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const node = event.target.closest('.event-canvas-node[data-node-id]');
    if (!node) return;
    event.preventDefault();
    selectCanvasNode(node.dataset.nodeId);
  });

  // Capture phase: the canvas click handler re-renders and detaches event.target,
  // which would make a bubble-phase containment check report a false "outside".
  document.addEventListener('click', function (event) {
    if (!state.openInsertKey) return;
    if (DOM.canvas.contains(event.target)) return;
    state.openInsertKey = null;
    renderCanvas();
  }, true);

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

    if (event.key === 'Escape' && state.openInsertKey) {
      state.openInsertKey = null;
      renderCanvas();
      return;
    }

    if (event.key === 'Delete' && state.isInitialized && state.selectedNodeId) {
      const selected = getNodeById(state.selectedNodeId);
      if (selected && !isSessionChildType(selected.type)) removeNode(state.selectedNodeId);
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


  window.ArcticEventAdmin = {
    openWorkspace: openWorkspace,
    saveDraftLocal: saveDraftLocal,
    openPublishReview: openPublishReview,
    publishEvent: publishEvent,
    validateAndSave: validateAndSave,
    loadTemplateDraft: loadTemplateDraft
  };

  initializeEditor();
}());
