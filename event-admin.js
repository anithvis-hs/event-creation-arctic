(function () {
  'use strict';

  const STORAGE_KEY = 'arctic-ai-event-admin-draft-v4-stacked';
  const CANVAS_NODE_WIDTH = 220;
  const CANVAS_NODE_HEIGHT = 56;
  // Session details outnumber the spine steps eight to one per branch, so they
  // sit shorter and lighter to keep the spine the dominant read.
  const CANVAS_CHILD_HEIGHT = 44;
  const CANVAS_TERMINAL_WIDTH = 132;
  const CANVAS_TERMINAL_HEIGHT = 36;
  const CANVAS_ROW_GAP = 48;
  const CANVAS_COL_GAP = 48;
  // Deeper than a normal row so the fan-out bus has room to spread sideways.
  const CANVAS_BRANCH_GAP = 64;
  const CANVAS_BRANCH_BUS_OFFSET = 26;
  const CANVAS_PADDING = 48;
  const CANVAS_CORNER = 10;
  // The stacked spine is much taller than it is wide, so "Fit graph" needs to be
  // able to zoom out further than the old free-form canvas did.
  const CANVAS_MIN_ZOOM = 0.25;
  const CANVAS_MAX_ZOOM = 1.6;
  // Below roughly this scale the node titles and summaries stop being readable,
  // so intro framing never zooms out past it.
  const CANVAS_INTRO_MIN_ZOOM = 0.7;
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
    { type: NODE_TYPES.SESSION_REG_RULES, label: 'Registration rules', required: false }
  ];

  const SESSION_CHILD_TYPES = SESSION_CHILD_DEFS.map(function (item) { return item.type; });
  const CANVAS_ONLY_TYPES = SESSION_CHILD_TYPES.concat([NODE_TYPES.SESSION]);

  // Drives the stacked spine: node order on the canvas is derived from this list,
  // never from stored coordinates.
  const CANONICAL_ROOT_ORDER = [
    NODE_TYPES.BASICS,
    NODE_TYPES.REGISTRATION,
    NODE_TYPES.BANNER,
    NODE_TYPES.SESSIONS
  ];

  // Outline geometry on a 24x24 grid, stroked in currentColor so the tone
  // classes tint it. Matches the thin-outline weight of the kit's own icons.
  const NODE_ICONS = {
    document: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
    ticket: '<path d="M4 5h16a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6V7a2 2 0 0 1 2-2z"/><path d="M14 5v2"/><path d="M14 11v2"/><path d="M14 17v2"/>',
    users: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><path d="M16 3.3a4 4 0 0 1 0 7.4"/><path d="M22 21v-2a4 4 0 0 0-3-3.85"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M4 17l4-4 3 3 4-4 5 5"/>',
    branch: '<circle cx="12" cy="5" r="2"/><path d="M12 7v3"/><path d="M5 14v-2.5A1.5 1.5 0 0 1 6.5 10h11a1.5 1.5 0 0 1 1.5 1.5V14"/><path d="M12 10v4"/><circle cx="5" cy="16" r="2"/><circle cx="12" cy="16" r="2"/><circle cx="19" cy="16" r="2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    gauge: '<path d="M4 17a9 9 0 0 1 16 0"/><path d="M12 17l4-4"/>',
    paperclip: '<path d="M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    node: '<rect x="5" y="5" width="14" height="14" rx="3"/>'
  };

  function renderNodeIcon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
      + (NODE_ICONS[name] || NODE_ICONS.node)
      + '</svg>';
  }

  // An event node and its session counterpart share an icon on purpose: the
  // repeat is what makes them read as one setting at two levels.
  const NODE_VISUALS = {};
  NODE_VISUALS[NODE_TYPES.BASICS] = { kind: 'Event details', icon: 'document', tone: 'blue' };
  NODE_VISUALS[NODE_TYPES.REGISTRATION] = { kind: 'Registration', icon: 'ticket', tone: 'blue' };
  NODE_VISUALS[NODE_TYPES.BANNER] = { kind: 'Media', icon: 'image', tone: 'slate' };
  NODE_VISUALS[NODE_TYPES.SESSIONS] = { kind: 'Branch point', icon: 'branch', tone: 'accent' };
  NODE_VISUALS[NODE_TYPES.SESSION] = { kind: 'Session branch', icon: 'calendar', tone: 'accent' };
  NODE_VISUALS[NODE_TYPES.SESSION_BASICS] = { kind: 'Session detail', icon: 'document', tone: 'slate' };
  NODE_VISUALS[NODE_TYPES.SESSION_SCHEDULE] = { kind: 'Session detail', icon: 'clock', tone: 'slate' };
  NODE_VISUALS[NODE_TYPES.SESSION_VENUE] = { kind: 'Session detail', icon: 'pin', tone: 'slate' };
  NODE_VISUALS[NODE_TYPES.SESSION_CAPACITY] = { kind: 'Session detail', icon: 'gauge', tone: 'slate' };
  NODE_VISUALS[NODE_TYPES.SESSION_INSTRUCTORS] = { kind: 'Session detail', icon: 'users', tone: 'slate' };
  NODE_VISUALS[NODE_TYPES.SESSION_MATERIALS] = { kind: 'Session detail', icon: 'paperclip', tone: 'slate' };
  NODE_VISUALS[NODE_TYPES.SESSION_REG_RULES] = { kind: 'Session detail', icon: 'ticket', tone: 'slate' };

  function getNodeVisual(type) {
    return NODE_VISUALS[type] || { kind: 'Node', icon: 'node', tone: 'slate' };
  }

  const MAX_BANNER_BYTES = 5 * 1024 * 1024;
  const SINGLETON_TYPES = [NODE_TYPES.BASICS, NODE_TYPES.REGISTRATION, NODE_TYPES.BANNER, NODE_TYPES.SESSIONS];

  // One vocabulary for both levels, so the event and a session never call the
  // same value by different names. The two enrollment paths are what a session
  // may override; attendance tracking is an event-wide flag.
  const REGISTRATION_MODES = [
    { id: 'open-registration', label: 'Open registration', isPath: true },
    { id: 'approval-required', label: 'Approval required', isPath: true },
    { id: 'attendance-tracked', label: 'Attendance tracking enabled', isPath: false }
  ];

  const REGISTRATION_PATHS = REGISTRATION_MODES.filter(function (mode) { return mode.isPath; });

  function registrationModeLabel(id) {
    const match = REGISTRATION_MODES.find(function (mode) { return mode.id === id; });
    return match ? match.label : '';
  }

  // Every required field with a sane default is a field that should not block a
  // first publish. These four are answerable without asking the admin, so new
  // nodes start pre-filled rather than empty-and-erroring.
  const FALLBACK_TIMEZONE = 'America/Los_Angeles';
  const DEFAULT_VENUE_MODE = 'physical';
  const DEFAULT_CAPACITY = '25';
  const DEFAULT_REGISTRATION_MODES = ['open-registration'];
  const MAX_QUICK_SESSIONS = 6;

  function resolveDefaultTimezone() {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return zone || FALLBACK_TIMEZONE;
    } catch (error) {
      return FALLBACK_TIMEZONE;
    }
  }

  const paletteItems = [
    { type: NODE_TYPES.BASICS, label: 'Basics', helper: 'Name, description and spot', required: true },
    { type: NODE_TYPES.REGISTRATION, label: 'Registration', helper: 'How people sign up', required: true },
    { type: NODE_TYPES.BANNER, label: 'Banner', helper: 'Optional image', required: false },
    { type: NODE_TYPES.SESSIONS, label: 'Sessions', helper: 'Every event needs at least one', required: true },
    { type: NODE_TYPES.SESSION, label: 'Session', helper: 'One date, time and place', required: false }
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
    adminPanel: document.querySelector('.event-admin-panel'),
    coldStart: document.getElementById('event-cold-start'),
    aiForm: document.getElementById('event-ai-form'),
    aiInput: document.getElementById('event-ai-input'),
    aiSubmit: document.getElementById('event-ai-submit'),
    aiError: document.getElementById('event-ai-error'),
    aiGenerating: document.getElementById('event-ai-generating'),
    manualToggle: document.getElementById('event-manual-toggle'),
    quickManual: document.getElementById('event-quick-manual'),
    quickForm: document.getElementById('event-quick-form'),
    quickSessionCount: document.getElementById('event-quick-session-count'),
    quickSessionLegend: document.getElementById('event-quick-session-legend'),
    quickNote: document.getElementById('event-quick-note'),
    quickError: document.getElementById('event-quick-error'),
    quickVenueMode: document.getElementById('event-quick-venue-mode'),
    quickPlaceLabel: document.getElementById('event-quick-place-label'),
    quickPlaceInput: document.getElementById('event-quick-place'),
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
    viewToggle: document.getElementById('event-view-toggle'),
    zoomCluster: document.getElementById('event-canvas-zoom-cluster'),
    canvasHeading: document.getElementById('event-canvas-heading'),
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
    openInsertKey: null,
    aiChangedNodeIds: {},
    // 'outline' is the primary editing surface; 'map' is the read-only graph.
    viewMode: 'outline',
    collapsedNodeIds: {}
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
    const sessionsId = addNodeByType(draft, NODE_TYPES.SESSIONS, false);
    const sessionA = addNodeByType(draft, NODE_TYPES.SESSION, false);
    const sessionB = addNodeByType(draft, NODE_TYPES.SESSION, false);
    draft.payloadByNodeId[basicsId] = {
      title: '',
      description: 'Multi-track kickoff for enterprise planning and launch alignment.',
      spot: ''
    };
    draft.payloadByNodeId[regId] = { modes: ['open-registration', 'attendance-tracked'] };
    draft.payloadByNodeId[sessionsId] = { sessionIds: [sessionA, sessionB] };
    draft.payloadByNodeId[sessionA] = { title: 'Opening Keynote' };
    draft.payloadByNodeId[sessionB] = { title: 'Breakout: Expansion Plan' };
    seedSessionBranchData(draft, sessionA, {
      title: 'Opening Keynote',
      summary: 'Kickoff keynote for revenue teams.',
      track: 'Keynote',
      venueMode: 'physical',
      waitlist: 'enabled'
    });
    seedSessionBranchData(draft, sessionB, {
      title: 'Breakout: Expansion Plan',
      summary: 'Regional expansion planning breakout.',
      track: 'Breakout',
      venueMode: 'physical',
      waitlist: 'disabled'
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
      title: '',
      description: 'Role-based onboarding tracks for new hires across regions.',
      spot: ''
    };
    draft.payloadByNodeId[regId] = { modes: ['approval-required', 'attendance-tracked'] };
    draft.payloadByNodeId[sessionsId] = { sessionIds: [sessionA, sessionB] };
    draft.payloadByNodeId[sessionA] = { title: 'Culture and Values' };
    draft.payloadByNodeId[sessionB] = { title: 'Tools and Security Basics' };
    seedSessionBranchData(draft, sessionA, {
      title: 'Culture and Values',
      venueMode: 'virtual'
    });
    seedSessionBranchData(draft, sessionB, {
      title: 'Tools and Security Basics',
      venueMode: 'virtual'
    });
    syncGraphStructure(draft);
    return draft;
  }

  function createProductTrainingDraft() {
    const draft = createDraft({ id: 'event-template-product-training' });
    const basicsId = addNodeByType(draft, NODE_TYPES.BASICS, false);
    const regId = addNodeByType(draft, NODE_TYPES.REGISTRATION, false);
    const sessionsId = addNodeByType(draft, NODE_TYPES.SESSIONS, false);
    const sessionA = addNodeByType(draft, NODE_TYPES.SESSION, false);
    draft.payloadByNodeId[basicsId] = {
      title: '',
      description: 'Hands-on product training for customer-facing teams.',
      spot: ''
    };
    draft.payloadByNodeId[regId] = { modes: ['open-registration'] };
    draft.payloadByNodeId[sessionsId] = { sessionIds: [sessionA] };
    draft.payloadByNodeId[sessionA] = { title: 'Demo Workflow Deep Dive' };
    seedSessionBranchData(draft, sessionA, {
      title: 'Demo Workflow Deep Dive',
      venueMode: 'physical'
    });
    syncGraphStructure(draft);
    return draft;
  }

  // Schedule payloads store clock strings, so the back-to-back arithmetic works
  // in minutes past midnight and converts back at the edges.
  function minutesOf(hhmm) {
    const parts = String(hhmm || '').split(':');
    return (Number(parts[0]) * 60) + Number(parts[1]);
  }

  function clockOf(mins) {
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }

  function clampSessionCount(value) {
    const count = Math.floor(Number(value));
    if (!count || count < 1) return 1;
    return Math.min(count, MAX_QUICK_SESSIONS);
  }

  // The short-form path. Everything the seven answers do not cover is either
  // defaulted at node creation or derived, so the draft this returns publishes
  // with no blockers and the canvas opens already green. Several sessions run
  // consecutively rather than at once: overlapping them in one room would be a
  // venue collision, which is the opposite of arriving publishable.
  function createQuickDraft(input) {
    const data = input || {};
    const title = cleanText(data.title);
    const venueMode = data.venueMode === 'virtual' ? 'virtual' : DEFAULT_VENUE_MODE;
    const place = cleanText(data.place);
    const instructorName = cleanText(data.instructorName);
    const sessionCount = clampSessionCount(data.sessionCount);
    const startTime = cleanText(data.startTime);
    const duration = minutesOf(cleanText(data.endTime)) - minutesOf(startTime);

    const draft = createDraft();
    const basicsId = addNodeByType(draft, NODE_TYPES.BASICS, false);
    addNodeByType(draft, NODE_TYPES.REGISTRATION, false);
    const sessionsId = addNodeByType(draft, NODE_TYPES.SESSIONS, false);

    draft.payloadByNodeId[basicsId] = { title: title, description: '', spot: cleanText(data.spot) };

    const sessionIds = [];
    for (let index = 0; index < sessionCount; index += 1) {
      const sessionId = addNodeByType(draft, NODE_TYPES.SESSION, false);
      const startsAt = minutesOf(startTime) + (index * duration);
      sessionIds.push(sessionId);

      seedSessionBranchData(draft, sessionId, {
        // Repeating one title across sessions reads back as a duplicate warning.
        title: sessionCount === 1 ? title : `${title} — Session ${index + 1}`,
        date: cleanText(data.date),
        startTime: clockOf(startsAt),
        endTime: clockOf(startsAt + duration),
        venueMode: venueMode,
        location: venueMode === 'physical' ? place : '',
        virtualLink: venueMode === 'virtual' ? place : '',
        instructors: instructorName ? [{ name: instructorName, email: '' }] : []
      });
    }

    draft.payloadByNodeId[sessionsId] = { sessionIds: sessionIds };
    draft.meta.templateChosen = true;
    syncGraphStructure(draft);
    return draft;
  }

  function validateQuickInput(input) {
    const data = input || {};
    if (!cleanText(data.title)) return 'Give the event a name.';
    if (!cleanText(data.spot)) return 'Choose a spot.';
    if (!cleanText(data.date)) return 'Pick a date.';
    if (!cleanText(data.startTime) || !cleanText(data.endTime)) return 'Add a start and end time.';
    if (cleanText(data.endTime) <= cleanText(data.startTime)) return 'The end time needs to be after the start time.';
    if (!cleanText(data.place)) {
      return data.venueMode === 'virtual' ? 'Add a joining link.' : 'Add a location.';
    }
    if (!cleanText(data.instructorName)) return 'Add who is teaching.';

    const sessionCount = clampSessionCount(data.sessionCount);
    const duration = minutesOf(cleanText(data.endTime)) - minutesOf(cleanText(data.startTime));
    if (minutesOf(cleanText(data.startTime)) + (sessionCount * duration) > 24 * 60) {
      return `${sessionCount} sessions that long will not fit after ${cleanText(data.startTime)}. Shorten them or use fewer.`;
    }
    return '';
  }

  // Seeded from the chat-proposed rollout plan. AMER and EMEA deliberately share
  // Maya Lin on overlapping times so computeConflicts reports a genuine blocker
  // the assistant can then resolve; APAC is clean.
  function createMethodologyRolloutDraft() {
    const draft = createDraft({ id: 'event-plan-methodology-rollout' });
    const basicsId = addNodeByType(draft, NODE_TYPES.BASICS, false);
    const regId = addNodeByType(draft, NODE_TYPES.REGISTRATION, false);
    const sessionsId = addNodeByType(draft, NODE_TYPES.SESSIONS, false);
    const amerId = addNodeByType(draft, NODE_TYPES.SESSION, false);
    const emeaId = addNodeByType(draft, NODE_TYPES.SESSION, false);
    const apacId = addNodeByType(draft, NODE_TYPES.SESSION, false);

    draft.payloadByNodeId[basicsId] = {
      title: 'Sales Methodology Certification 2026',
      description: 'Regional certification program for 412 reps ahead of the Q1 deadline.',
      spot: 'Enterprise Hub'
    };
    draft.payloadByNodeId[regId] = { modes: ['approval-required', 'attendance-tracked'] };
    draft.payloadByNodeId[sessionsId] = { sessionIds: [amerId, emeaId, apacId] };
    draft.payloadByNodeId[amerId] = { title: 'AMER Certification' };
    draft.payloadByNodeId[emeaId] = { title: 'EMEA Certification' };
    draft.payloadByNodeId[apacId] = { title: 'APAC Certification' };

    seedSessionBranchData(draft, amerId, {
      title: 'AMER Certification',
      summary: 'Certification track for North and South America.',
      track: 'AMER',
      date: '2026-03-12',
      startTime: '09:00',
      endTime: '11:00',
      timezone: 'America/Los_Angeles',
      venueMode: 'physical',
      location: 'Enterprise Hub — Main Hall',
      capacity: '180',
      waitlist: 'enabled',
      instructors: [{ name: 'Maya Lin', email: 'maya@example.com' }]
    });
    seedSessionBranchData(draft, emeaId, {
      title: 'EMEA Certification',
      summary: 'Certification track for Europe, Middle East, and Africa.',
      track: 'EMEA',
      date: '2026-03-12',
      startTime: '10:00',
      endTime: '12:00',
      timezone: 'Europe/London',
      venueMode: 'virtual',
      virtualLink: 'https://meet.example.com/methodology-emea',
      capacity: '150',
      waitlist: 'enabled',
      instructors: [{ name: 'Maya Lin', email: 'maya@example.com' }]
    });
    seedSessionBranchData(draft, apacId, {
      title: 'APAC Certification',
      summary: 'Certification track for Asia Pacific.',
      track: 'APAC',
      date: '2026-03-13',
      startTime: '09:00',
      endTime: '11:00',
      timezone: 'Asia/Singapore',
      venueMode: 'virtual',
      virtualLink: 'https://meet.example.com/methodology-apac',
      capacity: '82',
      waitlist: 'disabled',
      instructors: [{ name: 'Sam Patel', email: 'sam@example.com' }],
      // Deliberate divergence from the event default, so the canvas shows an
      // inherited and an overridden session side by side.
      registrationOverride: 'open-registration',
      registrationNote: 'APAC runs open enrollment; regional leads approve offline.'
    });

    draft.meta.templateChosen = true;
    syncGraphStructure(draft);
    return draft;
  }

  const EVENT_PLANS = {
    'methodology-rollout': {
      label: 'Sales Methodology Certification',
      createDraft: createMethodologyRolloutDraft
    }
  };

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

  // The host is a body child so it can sit above the modals and stay put when
  // the builder is hidden, for example right after publishing closes it. Its
  // position comes entirely from .event-admin-toast-host in the stylesheet.
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
    if (type === NODE_TYPES.SESSION_SCHEDULE) return { date: '', startTime: '', endTime: '', timezone: resolveDefaultTimezone() };
    if (type === NODE_TYPES.SESSION_VENUE) return { venueMode: DEFAULT_VENUE_MODE, location: '', virtualLink: '' };
    if (type === NODE_TYPES.SESSION_CAPACITY) return { capacity: DEFAULT_CAPACITY, waitlist: 'disabled' };
    if (type === NODE_TYPES.SESSION_INSTRUCTORS) return { entries: [] };
    if (type === NODE_TYPES.SESSION_MATERIALS) return { resources: [] };
    if (type === NODE_TYPES.SESSION_REG_RULES) return { overrideMode: '', notes: '' };
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

  // The shape of an event is knowledge the product has and a first-time admin
  // does not. Required steps that are missing hold their place on the spine as
  // ghosts, so a blank canvas shows what an event is made of rather than a void.
  const GHOSTED_SPINE_TYPES = [NODE_TYPES.BASICS, NODE_TYPES.REGISTRATION, NODE_TYPES.SESSIONS];

  function getSpineSlots(draft) {
    const byType = {};
    draft.nodes.forEach(function (node) {
      if (CANONICAL_ROOT_ORDER.indexOf(node.type) > -1 && !byType[node.type]) byType[node.type] = node;
    });
    return CANONICAL_ROOT_ORDER
      .map(function (type) {
        if (byType[type]) return { type: type, node: byType[type] };
        if (GHOSTED_SPINE_TYPES.indexOf(type) > -1) return { type: type, node: null };
        return null;
      })
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
      height: isSessionChildType(node.type) ? CANVAS_CHILD_HEIGHT : CANVAS_NODE_HEIGHT
    };
  }

  function makeGhostEntry(type, x, y) {
    return {
      id: `__ghost-${type}`,
      node: null,
      isTerminal: false,
      isGhost: true,
      ghostType: type,
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

    const spineSlots = getSpineSlots(draft);
    const sessionsContainer = spineSlots.find(function (slot) {
      return slot.type === NODE_TYPES.SESSIONS && slot.node;
    }) || null;
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

    spineSlots.forEach(function (slot) {
      const left = centerX - (CANVAS_NODE_WIDTH / 2);
      const entry = slot.node
        ? makeLayoutEntry(slot.node, left, cursorY)
        : makeGhostEntry(slot.type, left, cursorY);
      entries.push(entry);
      connectors.push({
        kind: 'spine',
        d: `M ${centerX} ${entryBottom(previousEntry)} L ${centerX} ${entry.y}`
      });
      pushSpineInsert(previousEntry, entry.y, previousType, slot.type);
      previousEntry = entry;
      previousType = slot.type;
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
      return Math.max(max, insert.x + 24);
    }, 0);

    return {
      entries: entries,
      connectors: connectors,
      inserts: inserts,
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
      if (child.type === NODE_TYPES.SESSION_REG_RULES) {
        payload.overrideMode = data.registrationOverride || payload.overrideMode;
        payload.notes = data.registrationNote || payload.notes;
      }
      draft.payloadByNodeId[child.id] = payload;
    });

    if (data.title) setSessionTitle(draft, sessionId, data.title);
  }

  // Legacy entries were flat strings written as a name followed by its email,
  // so an address attaches to the person before it. Anything else becomes a
  // person named by that string, which is what already rendered.
  function migrateInstructorEntries(entries) {
    const list = entries || [];
    if (!list.length || typeof list[0] === 'object') return list;

    const people = [];
    list.forEach(function (entry) {
      const value = cleanText(entry);
      if (!value) return;
      const previous = people[people.length - 1];
      if (isEmail(value) && previous && !previous.email) previous.email = value;
      else people.push({ name: value, email: '' });
    });
    return people;
  }

  function dropNodesOfType(draft, type) {
    const legacy = draft.nodes.filter(function (node) { return node.type === type; });
    if (!legacy.length) return;
    legacy.forEach(function (node) { delete draft.payloadByNodeId[node.id]; });
    const removed = legacy.map(function (node) { return node.id; });
    draft.nodes = draft.nodes.filter(function (node) { return removed.indexOf(node.id) === -1; });
    draft.edges = (draft.edges || []).filter(function (edge) {
      return removed.indexOf(edge.from) === -1 && removed.indexOf(edge.to) === -1;
    });
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

    // Older drafts kept the event-level Instructors node and a per-session
    // Publish checks card, and stored instructor names and emails as separate
    // strings rather than people.
    dropNodesOfType(draft, 'InstructorsNode');
    dropNodesOfType(draft, NODE_TYPES.SESSION_PUBLISH_CHECKS);
    draft.nodes
      .filter(function (node) { return node.type === NODE_TYPES.SESSION_INSTRUCTORS; })
      .forEach(function (node) {
        const payload = draft.payloadByNodeId[node.id];
        if (payload) payload.entries = migrateInstructorEntries(payload.entries);
      });

    draft.nodes
      .filter(function (node) { return node.type === NODE_TYPES.SESSION; })
      .forEach(function (sessionNode) { ensureSessionBranch(draft, sessionNode.id); });

    syncGraphStructure(draft);
    syncDefaultEdges(draft);
  }

  function updateColdStartVisibility() {
    if (!DOM.coldStart || !state.draft) return;
    if (state.draft.nodes.length > 0 || state.draft.meta.templateChosen) hideColdStart();
    else showColdStart();
  }

  function updateCanvasZoomLabel() {
    if (!DOM.zoomLabel) return;
    DOM.zoomLabel.textContent = `${Math.round(state.canvasView.scale * 100)}%`;
  }

  function applyCanvasTransform() {
    const viewport = DOM.canvas.querySelector('#event-canvas-viewport');
    if (!viewport) return;
    viewport.style.transform = `translate(${state.canvasView.panX}px, ${state.canvasView.panY}px) scale(${state.canvasView.scale})`;
    // Published so the insert layer can divide it back out and hold a constant
    // on-screen size, the way canvas tools keep their controls legible.
    viewport.style.setProperty('--canvas-zoom', String(state.canvasView.scale));
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

  // Framing used right after an assistant build. Fitting the whole graph drops
  // below the point where node labels and status chips can be read, and the
  // information here is horizontal anyway: parallel branches side by side. So
  // fit the width, keep the scale legible, and let branch depth run off the
  // bottom as an invitation to scroll.
  function frameGraphForIntro() {
    if (!state.draft || !state.layout) return;
    const padding = 32;
    const graphWidth = state.layout.width;
    const viewWidth = Math.max(1, DOM.canvas.clientWidth);
    const scale = Math.max(CANVAS_INTRO_MIN_ZOOM, Math.min(1, (viewWidth - (padding * 2)) / graphWidth));
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
    if (type === NODE_TYPES.REGISTRATION) return { modes: DEFAULT_REGISTRATION_MODES.slice() };
    if (type === NODE_TYPES.BANNER) return { fileName: '', fileType: '', fileSize: 0 };
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
    const sessions = findSingletonNodeId(draft, NODE_TYPES.SESSIONS);

    function addAutoEdge(from, to) {
      if (!from || !to) return;
      addEdgeIfMissing(draft, from, to);
    }

    addAutoEdge(basics, reg);
    addAutoEdge(reg, banner);
    addAutoEdge(banner, sessions);

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
      if (targetDraft === state.draft) setAlert('Add Sessions before adding a session.', true);
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
      setAlert('Session details stay attached to their session.', true);
      return;
    }
    if (node.type === NODE_TYPES.SESSIONS && countNodesOfType(state.draft, NODE_TYPES.SESSION) > 0) {
      setAlert('Remove the sessions before removing Sessions.', true);
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
    updateColdStartVisibility();
    renderAll();
  }

  function duplicateSession(sessionId) {
    const sourceNode = state.draft.nodes.find(function (node) { return node.id === sessionId; });
    if (!sourceNode) return;
    const copyTitle = `${getSessionTitle(sessionId)} (Copy)`;
    const newSessionId = addNodeByType(state.draft, NODE_TYPES.SESSION, false);

    getSessionChildNodes(state.draft, sessionId).forEach(function (child) {
      const targetChild = getSessionChildNodes(state.draft, newSessionId).find(function (node) { return node.type === child.type; });
      if (!targetChild) return;
      state.draft.payloadByNodeId[targetChild.id] = JSON.parse(JSON.stringify(state.draft.payloadByNodeId[child.id] || {}));
    });

    setSessionTitle(state.draft, newSessionId, copyTitle);

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

    if (node.type === NODE_TYPES.SESSIONS) {
      const sessions = payload.sessionIds || [];
      hasContent = sessions.length > 0;
      if (!sessions.length) errors.push('Add at least one session.');
    }

    // The session head carries its own branch's readiness, so a blocked session
    // is visible without opening every child card. This is not a publish blocker
    // in its own right: computePublishChecklist reports the children directly.
    if (node.type === NODE_TYPES.SESSION) {
      hasContent = hasText(payload.title);
      if (!hasContent) warnings.push('Session title is recommended for handoff.');
      const blockedChildren = getSessionChildNodes(state.draft, node.id).filter(function (child) {
        return validateNode(child).errors.length;
      });
      if (blockedChildren.length) {
        errors.push(`${blockedChildren.length} item${blockedChildren.length === 1 ? '' : 's'} in this session need attention.`);
      }
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
      entries.forEach(function (person) {
        const email = cleanText(person && person.email);
        if (email && !isEmail(email)) errors.push(`Invalid email: ${email}`);
      });
    }

    // Inheriting is a resolved state, not an empty one, so the card should not
    // read as never-started just because no override was chosen.
    if (node.type === NODE_TYPES.SESSION_REG_RULES) {
      hasContent = hasText(getEffectiveRegistration(node.parentSessionId).label) || hasText(payload.notes);
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

  function getEventRegistration(draft) {
    const source = draft || state.draft;
    const registrationId = findSingletonNodeId(source, NODE_TYPES.REGISTRATION);
    const modes = registrationId ? ((source.payloadByNodeId[registrationId] || {}).modes || []) : [];
    const path = REGISTRATION_PATHS
      .map(function (mode) { return mode.id; })
      .filter(function (id) { return modes.indexOf(id) > -1; })[0] || '';
    return {
      path: path,
      label: registrationModeLabel(path),
      attendanceTracked: modes.indexOf('attendance-tracked') > -1
    };
  }

  // The event sets the enrollment path; a session may override it. Callers get
  // the resolved value and where it came from, so the UI can say which.
  function getEffectiveRegistration(sessionId, draft) {
    const source = draft || state.draft;
    const event = getEventRegistration(source);
    const rules = getSessionChildPayload(source, sessionId, NODE_TYPES.SESSION_REG_RULES);
    const override = cleanText(rules.overrideMode);

    if (hasText(override)) {
      return {
        path: override,
        label: registrationModeLabel(override),
        source: 'session',
        eventPath: event.path,
        eventLabel: event.label
      };
    }

    return {
      path: event.path,
      label: event.label,
      source: 'event',
      eventPath: event.path,
      eventLabel: event.label
    };
  }

  // Teaching is declared per session, so the people already assigned elsewhere
  // in this program are what a session can offer as a shortcut.
  function getProgramInstructors(draft, excludeSessionId) {
    const source = draft || state.draft;
    const seen = {};
    const people = [];
    (source.sessions || []).forEach(function (sessionId) {
      if (sessionId === excludeSessionId) return;
      (getSessionInstructorsPayload(sessionId, source).entries || []).forEach(function (person) {
        const name = cleanText(person && person.name);
        if (!name || seen[name]) return;
        seen[name] = true;
        people.push({ name: name, email: cleanText(person.email) });
      });
    });
    return people;
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
            sessionId: leftId,
            counterpartSessionId: rightId
          });
        }

        const rightNames = rightInstructors.map(function (person) { return cleanText(person && person.name); });
        leftInstructors.forEach(function (person) {
          const name = cleanText(person && person.name);
          if (!name || rightNames.indexOf(name) === -1) return;
          const instructorNode = getSessionChildNodes(draft, leftId).find(function (node) {
            return node.type === NODE_TYPES.SESSION_INSTRUCTORS;
          });
          conflicts.push({
            type: 'error',
            message: `Instructor "${name}" is double-booked across overlapping sessions.`,
            nodeId: instructorNode ? instructorNode.id : null,
            sessionId: leftId,
            counterpartSessionId: rightId
          });
        });
      }
    }

    draft.conflicts = conflicts;
    return conflicts;
  }

  const RESCHEDULE_BUFFER_MINUTES = 15;

  function parseClockMinutes(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value || '');
    if (!match) return null;
    return (Number(match[1]) * 60) + Number(match[2]);
  }

  function formatClockMinutes(totalMinutes) {
    const clamped = Math.max(0, Math.min(totalMinutes, (24 * 60) - 1));
    const hours = String(Math.floor(clamped / 60)).padStart(2, '0');
    const minutes = String(clamped % 60).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // A session's name has two homes: the Session node's payload, which the rail
  // and the canvas head card read, and its Basics child, whose title validation
  // requires. The Session payload is canonical; every read goes through here.
  function getSessionTitle(sessionId, draft) {
    const source = draft || state.draft;
    const sessionPayload = source.payloadByNodeId[sessionId] || {};
    if (hasText(sessionPayload.title)) return cleanText(sessionPayload.title);
    const basics = getSessionBasicsPayload(sessionId, source);
    if (hasText(basics.title)) return cleanText(basics.title);
    const sessionNode = source.nodes.find(function (node) { return node.id === sessionId; });
    return sessionNode ? cleanText(sessionNode.label) : 'Session';
  }

  // ...and every write goes through here, so the two stores cannot drift apart.
  // The raw value is kept untrimmed so typing a trailing space still works.
  function setSessionTitle(draft, sessionId, value) {
    if (!sessionId) return;
    const text = value == null ? '' : String(value);

    const sessionPayload = draft.payloadByNodeId[sessionId] || {};
    sessionPayload.title = text;
    draft.payloadByNodeId[sessionId] = sessionPayload;

    const basics = draft.nodes.find(function (node) {
      return node.parentSessionId === sessionId && node.type === NODE_TYPES.SESSION_BASICS;
    });
    if (!basics) return;
    const basicsPayload = draft.payloadByNodeId[basics.id] || {};
    basicsPayload.title = text;
    draft.payloadByNodeId[basics.id] = basicsPayload;
  }

  // Moves whichever of the two overlapping sessions starts later so it begins
  // after the other one ends. Derived from the conflict rather than scripted, so
  // it works for any overlap the engine reports.
  function resolveConflict(index) {
    if (!state.draft) return null;

    const conflict = (state.draft.conflicts || [])[index];
    if (!conflict || !conflict.sessionId || !conflict.counterpartSessionId) return null;

    const leftSchedule = getSessionSchedulePayload(conflict.sessionId);
    const rightSchedule = getSessionSchedulePayload(conflict.counterpartSessionId);
    const leftStart = parseClockMinutes(leftSchedule.startTime);
    const rightStart = parseClockMinutes(rightSchedule.startTime);
    if (leftStart === null || rightStart === null) return null;

    const movesRight = rightStart >= leftStart;
    const moveSessionId = movesRight ? conflict.counterpartSessionId : conflict.sessionId;
    const anchorSchedule = movesRight ? leftSchedule : rightSchedule;
    const moveSchedule = movesRight ? rightSchedule : leftSchedule;

    const anchorEnd = parseClockMinutes(anchorSchedule.endTime);
    const moveStart = parseClockMinutes(moveSchedule.startTime);
    const moveEnd = parseClockMinutes(moveSchedule.endTime);
    if (anchorEnd === null || moveStart === null || moveEnd === null) return null;

    const duration = moveEnd - moveStart;
    const nextStart = anchorEnd + RESCHEDULE_BUFFER_MINUTES;
    const previousWindow = `${moveSchedule.startTime}\u2013${moveSchedule.endTime}`;
    moveSchedule.startTime = formatClockMinutes(nextStart);
    moveSchedule.endTime = formatClockMinutes(nextStart + duration);

    const scheduleNode = getSessionChildNodes(state.draft, moveSessionId).find(function (node) {
      return node.type === NODE_TYPES.SESSION_SCHEDULE;
    });

    markDirty();
    computeConflicts(state.draft);

    if (scheduleNode) {
      state.selectedNodeId = scheduleNode.id;
      flagAiChangedNode(scheduleNode.id);
    }

    renderAll();

    return {
      sessionTitle: getSessionTitle(moveSessionId),
      previousWindow: previousWindow,
      nextWindow: `${moveSchedule.startTime}\u2013${moveSchedule.endTime}`,
      timezone: moveSchedule.timezone || '',
      remainingConflicts: (state.draft.conflicts || []).length
    };
  }

  function flagAiChangedNode(nodeId) {
    state.aiChangedNodeIds[nodeId] = true;
    window.setTimeout(function () {
      delete state.aiChangedNodeIds[nodeId];
    }, 1200);
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
    if (validation.hasContent) return STATUS.IN_PROGRESS;
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
        + `<span class="event-palette-tile event-canvas-tone-${visual.tone}" aria-hidden="true">${renderNodeIcon(visual.icon)}</span>`
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

  function countLabel(count, singular) {
    return `${count} ${singular}${count === 1 ? '' : 's'}`;
  }

  function firstEntryWithOverflow(entries) {
    const list = (entries || []).filter(function (entry) { return hasText(entry); });
    if (!list.length) return '';
    const extra = list.length - 1;
    return extra ? `${cleanText(list[0])} +${extra}` : cleanText(list[0]);
  }

  const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Split rather than parsed as a Date: an ISO date string is treated as UTC and
  // can render as the previous day west of Greenwich.
  function formatShortDate(value) {
    const parts = cleanText(value).split('-');
    if (parts.length !== 3) return cleanText(value);
    const month = SHORT_MONTHS[Number(parts[1]) - 1];
    if (!month) return cleanText(value);
    return `${month} ${Number(parts[2])}`;
  }

  function sentenceCase(value) {
    const text = cleanText(value);
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
  }

  function formatScheduleSummary(schedule) {
    const window = schedule.startTime && schedule.endTime
      ? `${schedule.startTime}-${schedule.endTime}`
      : cleanText(schedule.startTime);
    return [formatShortDate(schedule.date), window].filter(hasText).join(', ');
  }

  // The card's second line. Reading the node's own payload makes the canvas
  // legible without opening each node; the category label is only a fallback
  // for a node nobody has filled in yet.
  function getNodeSummary(node) {
    const payload = state.draft.payloadByNodeId[node.id] || {};

    if (node.type === NODE_TYPES.BASICS) return cleanText(payload.title);
    if (node.type === NODE_TYPES.REGISTRATION) return (payload.modes || []).map(sentenceCase).join(', ');
    if (node.type === NODE_TYPES.BANNER) return cleanText(payload.fileName);
    if (node.type === NODE_TYPES.SESSIONS) {
      const count = (state.draft.sessions || []).length;
      return count ? countLabel(count, 'session') : '';
    }
    if (node.type === NODE_TYPES.SESSION) {
      return formatScheduleSummary(getSessionSchedulePayload(node.id) || {});
    }
    if (node.type === NODE_TYPES.SESSION_BASICS) {
      return cleanText(payload.title) || cleanText(payload.summary) || cleanText(payload.track);
    }
    if (node.type === NODE_TYPES.SESSION_SCHEDULE) return formatScheduleSummary(payload);
    if (node.type === NODE_TYPES.SESSION_VENUE) {
      const mode = sentenceCase(payload.venueMode);
      const where = cleanText(payload.location) || cleanText(payload.virtualLink);
      return [mode, where].filter(hasText).join(' · ');
    }
    if (node.type === NODE_TYPES.SESSION_CAPACITY) {
      const seats = cleanText(payload.capacity);
      if (!hasText(seats)) return '';
      return payload.waitlist === 'enabled' ? `${seats} seats · waitlist` : `${seats} seats`;
    }
    if (node.type === NODE_TYPES.SESSION_INSTRUCTORS) {
      return firstEntryWithOverflow((payload.entries || []).map(function (person) {
        return cleanText(person && person.name);
      }));
    }
    if (node.type === NODE_TYPES.SESSION_MATERIALS) {
      const count = (payload.resources || []).length;
      return count ? countLabel(count, 'resource') : '';
    }
    if (node.type === NODE_TYPES.SESSION_REG_RULES) {
      const effective = getEffectiveRegistration(node.parentSessionId);
      if (!hasText(effective.label)) return cleanText(payload.notes);
      return `${effective.label} · ${effective.source === 'session' ? 'overridden' : 'inherited'}`;
    }
    return '';
  }

  function renderCanvasNode(entry) {
    const node = entry.node;
    const status = nodeStatus(node);
    const isActive = state.selectedNodeId === node.id;
    // The session head carries its own name so the column identifies itself
    // without a separate floating label above it.
    const nodeLabel = node.type === NODE_TYPES.SESSION
      ? getSessionTitle(node.id)
      : cleanText(node.label);
    const visual = getNodeVisual(node.type);
    const isChild = isSessionChildType(node.type);
    const showError = nodeShowCanvasError(node);
    const summary = getNodeSummary(node) || visual.kind;

    const removeButton = (node.type === NODE_TYPES.SESSION || isChild)
      ? ''
      : `<button type="button" class="event-canvas-node-remove" data-action="remove-node" data-node-id="${node.id}" aria-label="Remove ${escapeHtml(nodeLabel)}">\u00d7</button>`;

    const classNames = ['event-canvas-node'];
    if (node.type === NODE_TYPES.SESSION) classNames.push('event-canvas-node-session');
    if (isChild) classNames.push('event-canvas-node-child');
    if (showError) classNames.push('event-canvas-node-has-error');
    if (isActive) classNames.push('is-active');
    if (state.aiChangedNodeIds[node.id]) classNames.push('is-ai-changed');

    // A dot rather than a text chip: a seeded program has 30-odd complete nodes,
    // and repeating the word on every card drowns out the few that need work.
    const statusDot = status === STATUS.NOT_STARTED
      ? ''
      : `<span class="event-canvas-node-dot ${statusClass(status)}" role="img" aria-label="${escapeHtml(status)}" title="${escapeHtml(status)}"></span>`;

    return `<div class="${classNames.join(' ')}" data-node-id="${node.id}" role="button" tabindex="0" aria-pressed="${isActive}" style="left:${entry.x}px;top:${entry.y}px;width:${entry.width}px;height:${entry.height}px">`
      + removeButton
      + `<span class="event-canvas-node-tile event-canvas-tone-${visual.tone}" aria-hidden="true">${renderNodeIcon(visual.icon)}</span>`
      + '<span class="event-canvas-node-copy">'
      + `<span class="event-canvas-node-title">${escapeHtml(nodeLabel)}</span>`
      + '<span class="event-canvas-node-meta">'
      + `<span class="event-canvas-node-summary">${escapeHtml(summary)}</span>`
      + statusDot
      + '</span>'
      + '</span>'
      + '</div>';
  }

  function renderCanvasGhost(entry) {
    const definition = getNodeDefinition(entry.ghostType) || { label: entry.ghostType, helper: '' };
    const visual = getNodeVisual(entry.ghostType);
    const label = cleanText(definition.label);
    return `<button type="button" class="event-canvas-node event-canvas-node-ghost" data-ghost-type="${escapeHtml(entry.ghostType)}" aria-label="Add ${escapeHtml(label)}" style="left:${entry.x}px;top:${entry.y}px;width:${entry.width}px;height:${entry.height}px">`
      + `<span class="event-canvas-node-tile event-canvas-tone-${visual.tone}" aria-hidden="true">${renderNodeIcon(visual.icon)}</span>`
      + '<span class="event-canvas-node-copy">'
      + `<span class="event-canvas-node-title">${escapeHtml(label)}</span>`
      + `<span class="event-canvas-node-summary">${escapeHtml(cleanText(definition.helper))}</span>`
      + '</span>'
      + '<span class="event-canvas-node-ghost-cta">Add</span>'
      + '</button>';
  }

  function renderCanvasTerminal(entry) {
    return `<div class="event-canvas-terminal" style="left:${entry.x}px;top:${entry.y}px;width:${entry.width}px;height:${entry.height}px">${escapeHtml(entry.label)}</div>`;
  }

  // No arrowheads: the layout is strictly top-down and acyclic, so every
  // connector's direction is already given by which end sits lower.
  function renderCanvasConnectors(layout) {
    const paths = layout.connectors.map(function (connector) {
      return `<path class="event-canvas-edge-path is-${connector.kind}" d="${connector.d}"></path>`;
    }).join('');

    return `<svg class="event-canvas-edges" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">${paths}</svg>`;
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

  // ---------------------------------------------------------------------------
  // Outline view: the primary editing surface. Same node model as the canvas,
  // presented as an indented tree that matches the event's real hierarchy
  // (Event parts -> Sessions -> per-session details) rather than a spatial graph.
  // ---------------------------------------------------------------------------
  function outlineStatusChip(node) {
    const status = nodeStatus(node);
    return `<span class="event-status event-outline-status ${statusClass(status)}">${escapeHtml(status)}</span>`;
  }

  function outlineCaret(nodeId, collapsed, label) {
    return `<button type="button" class="event-outline-caret" data-action="toggle-outline" data-node-id="${nodeId}"`
      + ` aria-expanded="${collapsed ? 'false' : 'true'}" aria-label="${collapsed ? 'Expand' : 'Collapse'} ${escapeHtml(label)}">`
      + `${collapsed ? '\u25B8' : '\u25BE'}</button>`;
  }

  function outlineRowMarkup(node, depth, extras) {
    const options = extras || {};
    const visual = getNodeVisual(node.type);
    const isActive = state.selectedNodeId === node.id;
    const title = node.type === NODE_TYPES.SESSION ? getSessionTitle(node.id) : cleanText(node.label);
    const summary = getNodeSummary(node) || visual.kind;
    const classes = ['event-outline-row', `event-outline-depth-${depth}`];
    if (isActive) classes.push('is-active');
    if (state.aiChangedNodeIds[node.id]) classes.push('is-ai-changed');

    return `<div class="${classes.join(' ')}" data-node-id="${node.id}" role="treeitem" tabindex="0" aria-selected="${isActive}">`
      + (options.caret || '<span class="event-outline-caret-spacer" aria-hidden="true"></span>')
      + `<span class="event-outline-tile event-canvas-tone-${visual.tone}" aria-hidden="true">${renderNodeIcon(visual.icon)}</span>`
      + '<span class="event-outline-copy">'
      + `<span class="event-outline-title">${escapeHtml(title)}</span>`
      + (summary ? `<span class="event-outline-summary">${escapeHtml(summary)}</span>` : '')
      + '</span>'
      + outlineStatusChip(node)
      + (options.actions || '')
      + '</div>';
  }

  function outlineSessionActions(sessionId, index, total) {
    return '<span class="event-outline-actions">'
      + `<button type="button" class="event-mini-button" data-action="reorder-session-up" data-session-id="${sessionId}" ${index === 0 ? 'disabled' : ''} aria-label="Move session up">\u2191</button>`
      + `<button type="button" class="event-mini-button" data-action="reorder-session-down" data-session-id="${sessionId}" ${index === total - 1 ? 'disabled' : ''} aria-label="Move session down">\u2193</button>`
      + `<button type="button" class="event-mini-button" data-action="duplicate-session" data-session-id="${sessionId}">Duplicate</button>`
      + `<button type="button" class="event-mini-button" data-action="remove-node" data-node-id="${sessionId}">Remove</button>`
      + '</span>';
  }

  function outlineGhostRow(type) {
    const definition = getNodeDefinition(type) || { label: type, helper: '' };
    const visual = getNodeVisual(type);
    const label = cleanText(definition.label);
    return '<div class="event-outline-item">'
      + `<button type="button" class="event-outline-row event-outline-ghost event-outline-depth-0" data-ghost-type="${escapeHtml(type)}" aria-label="Add ${escapeHtml(label)}">`
      + '<span class="event-outline-caret-spacer" aria-hidden="true"></span>'
      + `<span class="event-outline-tile event-canvas-tone-${visual.tone}" aria-hidden="true">${renderNodeIcon(visual.icon)}</span>`
      + '<span class="event-outline-copy">'
      + `<span class="event-outline-title">${escapeHtml(label)}</span>`
      + `<span class="event-outline-summary">${escapeHtml(cleanText(definition.helper))}</span>`
      + '</span>'
      + '<span class="event-outline-add-cta">Add</span>'
      + '</button></div>';
  }

  function buildSessionBranch(draft, sessionNode, index, total) {
    const collapsed = Boolean(state.collapsedNodeIds[sessionNode.id]);
    const caret = outlineCaret(sessionNode.id, collapsed, getSessionTitle(sessionNode.id));
    const actions = outlineSessionActions(sessionNode.id, index, total);
    let html = '<div class="event-outline-item event-outline-session">';
    html += outlineRowMarkup(sessionNode, 1, { caret: caret, actions: actions });
    if (!collapsed) {
      html += '<div class="event-outline-children" role="group">';
      getSessionChildNodes(draft, sessionNode.id).forEach(function (child) {
        html += '<div class="event-outline-item">' + outlineRowMarkup(child, 2, {}) + '</div>';
      });
      html += '</div>';
    }
    return html + '</div>';
  }

  function buildSessionsGroup(draft, containerNode) {
    const collapsed = Boolean(state.collapsedNodeIds[containerNode.id]);
    const sessions = draft.sessions || [];
    const caret = outlineCaret(containerNode.id, collapsed, 'sessions');
    let html = '<div class="event-outline-item event-outline-group">';
    html += outlineRowMarkup(containerNode, 0, { caret: caret });
    if (!collapsed) {
      html += '<div class="event-outline-children" role="group">';
      sessions.forEach(function (sessionId, index) {
        const sessionNode = getNodeById(sessionId);
        if (sessionNode) html += buildSessionBranch(draft, sessionNode, index, sessions.length);
      });
      html += '<button type="button" class="event-outline-add" data-action="outline-add-session">+ Add session</button>';
      html += '</div>';
    }
    return html + '</div>';
  }

  function buildOutlineHtml(draft) {
    syncGraphStructure(draft);
    let rows = '';
    getSpineSlots(draft).forEach(function (slot) {
      if (slot.type === NODE_TYPES.SESSIONS && slot.node) {
        rows += buildSessionsGroup(draft, slot.node);
        return;
      }
      if (slot.node) {
        rows += '<div class="event-outline-item">' + outlineRowMarkup(slot.node, 0, {}) + '</div>';
      } else {
        rows += outlineGhostRow(slot.type);
      }
    });
    return '<div class="event-outline" role="tree" aria-label="Event outline">' + rows + '</div>';
  }

  function renderOutline() {
    if (!state.draft) return;
    // The outline is derived, not spatial: clear any canvas layout so the
    // canvas-only pan/zoom paths know there is nothing to frame.
    state.layout = null;
    DOM.canvas.innerHTML = buildOutlineHtml(state.draft);
  }

  function handleOutlineClick(event) {
    const action = event.target.closest('[data-action]');
    if (action) {
      const name = action.dataset.action;
      if (name === 'toggle-outline') {
        const id = action.dataset.nodeId;
        state.collapsedNodeIds[id] = !state.collapsedNodeIds[id];
        renderView();
        return;
      }
      if (name === 'outline-add-session') { insertNodeOfType(NODE_TYPES.SESSION); return; }
      if (name === 'duplicate-session') { duplicateSession(action.dataset.sessionId); return; }
      if (name === 'reorder-session-up') { reorderSession(action.dataset.sessionId, 'up'); return; }
      if (name === 'reorder-session-down') { reorderSession(action.dataset.sessionId, 'down'); return; }
      if (name === 'remove-node') { removeNode(action.dataset.nodeId); return; }
    }
    const ghost = event.target.closest('[data-ghost-type]');
    if (ghost) { insertNodeOfType(ghost.dataset.ghostType); return; }
    const row = event.target.closest('.event-outline-row[data-node-id]');
    if (row) selectCanvasNode(row.dataset.nodeId);
  }

  function updateViewToggle() {
    const isMap = state.viewMode === 'map';
    if (DOM.viewToggle) {
      DOM.viewToggle.textContent = isMap ? 'Outline view' : 'Map view';
      DOM.viewToggle.setAttribute('aria-pressed', isMap ? 'true' : 'false');
    }
    if (DOM.zoomCluster) DOM.zoomCluster.classList.toggle('is-hidden', !isMap);
    if (DOM.canvasHeading) DOM.canvasHeading.textContent = isMap ? 'Map' : 'Outline';
    if (DOM.canvas) DOM.canvas.classList.toggle('is-map-view', isMap);
    if (DOM.adminPanel) DOM.adminPanel.classList.toggle('is-map-view', isMap);
  }

  // One paint routine for the middle column, so every caller stays view-agnostic.
  function renderView() {
    if (state.viewMode === 'map') renderCanvas();
    else renderOutline();
    updateViewToggle();
  }

  function renderCanvas() {
    if (!state.draft) return;

    const layout = buildLayoutTree(state.draft);
    state.layout = layout;
    state.draft.meta.graphWidth = layout.width;
    state.draft.meta.graphHeight = layout.height;

    const nodesMarkup = layout.entries.map(function (entry) {
      if (entry.isTerminal) return renderCanvasTerminal(entry);
      if (entry.isGhost) return renderCanvasGhost(entry);
      return renderCanvasNode(entry);
    }).join('');

    DOM.canvas.innerHTML = '<div class="event-canvas-viewport" id="event-canvas-viewport">'
      + `<div class="event-canvas-graph" id="event-canvas-graph" style="width:${layout.width}px;height:${layout.height}px">`
      + renderCanvasConnectors(layout)
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

    DOM.title.textContent = selected ? `${selected.label} details` : 'Event details';
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

  /* Cold start is a state of the whole panel, not one element: the builder grid
     stands down and the actions that would act on a non-existent event go with
     it, leaving only Back to Home and Reset. */
  function setColdStart(isShowing) {
    if (DOM.coldStart) DOM.coldStart.classList.toggle('is-hidden', !isShowing);
    if (DOM.adminPanel) DOM.adminPanel.classList.toggle('is-cold-start', isShowing);
    [
      DOM.workspaceSaveButton,
      DOM.workspaceReviewButton,
      DOM.workspacePublishButton,
      DOM.saveButton,
      DOM.reviewButton,
      DOM.publishButton
    ].forEach(function (button) {
      if (button) button.classList.toggle('is-hidden', isShowing);
    });
  }

  function showColdStart() {
    setColdStart(true);
  }

  function hideColdStart() {
    setColdStart(false);
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
      showColdStart();
      return false;
    }

    if (!opts.skipConfirm && !confirmReplaceDraft('You have unvalidated changes. Load this template anyway?')) {
      return false;
    }

    const draft = createTemplateDraft(templateId);
    loadDraft(draft);
    saveDraft(false);
    hideColdStart();
    showToast(`${template.label} template loaded.`, 4000);
    return true;
  }

  function createQuickEvent(input, options) {
    const opts = options || {};
    const problem = validateQuickInput(input);

    if (problem) {
      setQuickError(problem);
      return false;
    }

    if (!opts.skipConfirm && !confirmReplaceDraft('You have unvalidated changes. Create this event anyway?')) {
      return false;
    }

    setQuickError('');
    loadDraft(createQuickDraft(input));

    // Open on the session rather than Basics: the session is what the admin just
    // described, and it is where a second session gets added from.
    const sessionId = state.draft.sessions[0];
    if (sessionId) {
      state.selectedNodeId = sessionId;
      renderAll();
    }

    saveDraft(false);
    hideColdStart();
    frameGraphForIntro();
    showToast('Event created. Review the canvas, then publish.', 5000);
    return true;
  }

  function readQuickForm() {
    if (!DOM.quickForm) return null;
    function valueOf(id) {
      const field = document.getElementById(id);
      return field ? field.value : '';
    }
    return {
      title: valueOf('event-quick-title'),
      spot: valueOf('event-quick-spot'),
      date: valueOf('event-quick-date'),
      startTime: valueOf('event-quick-start'),
      endTime: valueOf('event-quick-end'),
      venueMode: valueOf('event-quick-venue-mode'),
      place: valueOf('event-quick-place'),
      instructorName: valueOf('event-quick-instructor'),
      sessionCount: readQuickSessionCount()
    };
  }

  function isSeveralSessions() {
    const chosen = document.querySelector('input[name="quick-shape"]:checked');
    return Boolean(chosen) && chosen.value === 'several';
  }

  function readQuickSessionCount() {
    if (!isSeveralSessions()) return 1;
    return clampSessionCount(DOM.quickSessionCount ? DOM.quickSessionCount.value : 2);
  }

  function setQuickError(message) {
    if (!DOM.quickError) return;
    DOM.quickError.textContent = message;
    DOM.quickError.classList.toggle('is-hidden', !message);
  }

  function syncQuickVenueLabel() {
    if (!DOM.quickVenueMode || !DOM.quickPlaceLabel || !DOM.quickPlaceInput) return;
    const isVirtual = DOM.quickVenueMode.value === 'virtual';
    DOM.quickPlaceLabel.textContent = isVirtual ? 'Joining link' : 'Location';
    DOM.quickPlaceInput.placeholder = isVirtual ? 'https://meet.example.com/session' : 'Building 2 — Training Room';
  }

  // The one date and time block describes the first session and the rest follow
  // it, so both the legend and the note have to say so before the admin submits.
  function syncQuickShape() {
    const several = isSeveralSessions();
    if (DOM.quickSessionCount) DOM.quickSessionCount.classList.toggle('is-hidden', !several);
    if (DOM.quickSessionLegend) DOM.quickSessionLegend.textContent = several ? 'The first session' : 'The session';
    if (!DOM.quickNote) return;

    const defaults = `Times are in ${resolveDefaultTimezone()}. Seats default to ${DEFAULT_CAPACITY} and sign-up is open to everyone; both are editable on the canvas.`;
    DOM.quickNote.textContent = several
      ? `${defaults} The other sessions follow this one back to back, same day and place.`
      : defaults;
  }

  function initializeQuickForm() {
    syncQuickVenueLabel();
    syncQuickShape();
  }

  function buildFromPlan(planId, options) {
    const opts = options || {};
    const plan = EVENT_PLANS[planId];

    if (!plan) {
      setAlert('Unknown plan. Starting with a blank draft.', true);
      loadDraft(createDraft());
      showColdStart();
      return false;
    }

    if (!opts.skipConfirm && !confirmReplaceDraft('You have unvalidated changes. Build this plan anyway?')) {
      return false;
    }

    const draft = plan.createDraft();
    draft.meta.planId = planId;
    loadDraft(draft);

    // Open on the sessions rail rather than the default first node: it lists
    // every branch and renders the cross-session checks, which is what the
    // assistant is talking about the moment the build lands.
    const sessionsId = findSingletonNodeId(state.draft, NODE_TYPES.SESSIONS);
    if (sessionsId) {
      state.selectedNodeId = sessionsId;
      renderAll();
    }

    saveDraft(false);
    hideColdStart();
    frameGraphForIntro();
    showToast(`${plan.label} built on the canvas.`, 4000);
    return true;
  }

  // Conflicts carry node ids, which chat cannot read. Resolve the session titles
  // here so the assistant can describe the conflict in the admin's language.
  function getConflicts() {
    if (!state.draft) return [];
    return (state.draft.conflicts || []).map(function (conflict) {
      return {
        type: conflict.type,
        message: conflict.message,
        sessionTitle: conflict.sessionId ? getSessionTitle(conflict.sessionId) : '',
        counterpartTitle: conflict.counterpartSessionId ? getSessionTitle(conflict.counterpartSessionId) : '',
        isResolvable: Boolean(conflict.sessionId && conflict.counterpartSessionId)
      };
    });
  }

  function getProgramSummary() {
    if (!state.draft) return null;

    const sessions = state.draft.sessions || [];
    const teaching = getProgramInstructors(state.draft);

    const basicsId = findSingletonNodeId(state.draft, NODE_TYPES.BASICS);
    const basicsPayload = basicsId ? (state.draft.payloadByNodeId[basicsId] || {}) : {};
    const conflicts = state.draft.conflicts || [];
    const registration = getEventRegistration(state.draft);
    const overrideCount = sessions.filter(function (sessionId) {
      return getEffectiveRegistration(sessionId).source === 'session';
    }).length;

    return {
      title: basicsPayload.title || '',
      sessionCount: sessions.length,
      instructorCount: teaching.length,
      instructorNames: teaching.map(function (person) { return person.name; }),
      registrationLabel: registration.label,
      overrideCount: overrideCount,
      conflictCount: conflicts.length,
      blockerCount: conflicts.filter(function (item) { return item.type === 'error'; }).length
    };
  }

  function startBlankFromGallery() {
    if (!confirmReplaceDraft('You have unvalidated changes. Start a blank canvas anyway?')) return;
    const draft = createDraft();
    draft.meta.templateChosen = true;
    loadDraft(draft);
    saveDraft(false);
    hideColdStart();
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
    hideColdStart();
    showToast(`Event created: "${normalizedTitle}"`, 5000);
    return true;
  }

  function openWorkspace(options) {
    const opts = options || {};

    if (opts.newEvent) {
      startNewDraft();
      return;
    }

    if (opts.plan) {
      buildFromPlan(opts.plan, { skipConfirm: Boolean(opts.skipConfirm) });
    } else if (opts.generatedDraft) {
      loadGeneratedDraft(opts.generatedDraft, { skipConfirm: Boolean(opts.skipConfirm) });
    } else if (opts.template) {
      loadTemplateDraft(opts.template, { skipConfirm: Boolean(opts.skipConfirm) });
    } else if (opts.basicsTitle) {
      openScratchWithBasics(opts.basicsTitle, { skipConfirm: opts.skipConfirm });
    } else if (state.isInitialized && state.draft && !state.draft.meta.templateChosen && !state.draft.nodes.length) {
      showColdStart();
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
    const sessionCount = (state.draft.sessions || []).length;
    const overrides = (state.draft.sessions || []).filter(function (sessionId) {
      return getEffectiveRegistration(sessionId).source === 'session';
    }).length;
    const inheritNote = sessionCount
      ? `<p class="event-helper">${sessionCount - overrides} of ${sessionCount} session${sessionCount === 1 ? '' : 's'} inherit this. ${overrides ? `${overrides} override${overrides === 1 ? 's' : ''} it.` : 'None override it.'}</p>`
      : '';
    return `
      <div class="event-field">
        <span class="event-inline-label">Registration/attendance modes</span>
        <div class="event-checkbox-list">
          ${REGISTRATION_MODES.map(function (option) {
            return `<label class="event-checkbox-row"><input type="checkbox" name="registration-mode" value="${option.id}" ${modes.indexOf(option.id) > -1 ? 'checked' : ''} /><span>${option.label}</span></label>`;
          }).join('')}
        </div>
        ${state.attemptedNodeIds[node.id] && validation.errors.length ? '<p class="event-error">Pick at least one mode.</p>' : ''}
        ${inheritNote}
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

  function renderSessionsForm(node, validation) {
    const payload = state.draft.payloadByNodeId[node.id] || { sessionIds: [] };
    const conflicts = computeConflicts(state.draft);
    const sessionIds = payload.sessionIds || [];
    const eventRegistration = getEventRegistration(state.draft);
    const overrides = sessionIds.filter(function (sessionId) {
      return getEffectiveRegistration(sessionId).source === 'session';
    });
    // The event no longer declares who teaches, so it reports what the sessions
    // decided.
    const teaching = getProgramInstructors(state.draft);
    const inheritanceRollup = sessionIds.length
      ? `<div class="event-field">
          <span class="event-inline-label">Across this event</span>
          <p class="event-helper">Registration: ${escapeHtml(eventRegistration.label || 'not set')} — ${sessionIds.length - overrides.length} of ${sessionIds.length} inherit${sessionIds.length - overrides.length === 1 ? 's' : ''}${overrides.length ? `, ${overrides.length} override${overrides.length === 1 ? 's' : ''}` : ''}.</p>
          <p class="event-helper">Teaching: ${teaching.length ? escapeHtml(teaching.map(function (person) { return person.name; }).join(', ')) : 'nobody assigned yet'}.</p>
        </div>`
      : '';
    return `
      ${inheritanceRollup}
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
      ${state.attemptedNodeIds[node.id] && validation.errors.length ? '<p class="event-error">Add at least one session.</p>' : ''}
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
      const assignedNames = entries.map(function (person) { return cleanText(person && person.name); });
      // Someone teaching another session in this program is the likeliest next
      // assignment, so offer them rather than making the admin retype a name.
      const elsewhere = getProgramInstructors(state.draft, node.parentSessionId)
        .filter(function (person) { return assignedNames.indexOf(person.name) === -1; });
      const quickAdd = elsewhere.length
        ? `<div class="event-field">
            <span class="event-inline-label">Also teaching this event</span>
            <div class="event-roster-chips">${elsewhere.map(function (person) {
              return `<button type="button" class="event-roster-chip" data-action="assign-known-instructor" data-name="${escapeHtml(person.name)}" data-email="${escapeHtml(person.email || '')}">+ ${escapeHtml(person.name)}</button>`;
            }).join('')}</div>
          </div>`
        : '';

      return `
        ${quickAdd}
        <div class="event-field">
          <label for="event-session-instructor-input">Add instructor</label>
          <div class="event-inline-actions">
            <input id="event-session-instructor-input" class="event-instructor-input" placeholder="Name" />
            <input id="event-session-instructor-email" class="event-instructor-input" placeholder="Email (optional)" />
            <button type="button" class="event-mini-button" data-action="add-session-instructor">Add</button>
          </div>
        </div>
        <div class="event-instructors-list">${entries.length ? entries.map(function (person, index) {
          const email = cleanText(person && person.email);
          return `<div class="event-instructor-item"><span class="event-instructor-value">${escapeHtml(cleanText(person && person.name))}${email ? ` <span class="event-instructor-email">${escapeHtml(email)}</span>` : ''}</span><button type="button" class="event-mini-button" data-action="remove-session-instructor" data-index="${index}">Remove</button></div>`;
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
      const effective = getEffectiveRegistration(node.parentSessionId);
      const eventLabel = hasText(effective.eventLabel) ? effective.eventLabel : 'not set on the event';
      const inheritOption = `<option value="">Inherit from event — ${escapeHtml(eventLabel)}</option>`;
      const pathOptions = REGISTRATION_PATHS.map(function (mode) {
        return `<option value="${mode.id}" ${payload.overrideMode === mode.id ? 'selected' : ''}>${escapeHtml(mode.label)}</option>`;
      }).join('');
      const provenance = effective.source === 'session'
        ? '<span class="event-inherit-chip is-override">Overrides the event</span>'
        : '<span class="event-inherit-chip">Inherited from the event</span>';
      return `
        <div class="event-field">
          <label for="event-session-reg-override">Enrollment path</label>
          <select id="event-session-reg-override" name="session-reg-override">${inheritOption}${pathOptions}</select>
          <p class="event-helper">This session enrolls with ${escapeHtml(effective.label || 'no path set')}. ${provenance}</p>
        </div>
        <div class="event-field"><label for="event-session-reg-notes">Notes</label><textarea id="event-session-reg-notes" name="session-reg-notes">${escapeHtml(payload.notes || '')}</textarea></div>
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
      <div class="event-field"><label for="event-session-title">Session name</label><input id="event-session-title" name="session-title" value="${escapeHtml(payload.title || '')}" /><p class="event-helper">Set the schedule, venue, capacity and instructors on the cards below this session.</p></div>
      <div class="event-field"><span class="event-inline-label">Session details</span><ul class="event-session-child-summary">${childSummary || '<li>No details yet.</li>'}</ul></div>
    `;
  }

  function renderForm() {
    const node = state.draft.nodes.find(function (item) { return item.id === state.selectedNodeId; });
    if (!node) {
      DOM.form.innerHTML = '<p class="event-helper">Pick a card on the canvas to edit it.</p>';
      return;
    }
    const validation = validateNode(node);
    if (node.type === NODE_TYPES.BASICS) { DOM.form.innerHTML = renderBasicsForm(node, validation); return; }
    if (node.type === NODE_TYPES.REGISTRATION) { DOM.form.innerHTML = renderRegistrationForm(node, validation); return; }
    if (node.type === NODE_TYPES.BANNER) { DOM.form.innerHTML = renderBannerForm(node, validation); return; }
    if (node.type === NODE_TYPES.SESSIONS) { DOM.form.innerHTML = renderSessionsForm(node, validation); return; }
    if (node.type === NODE_TYPES.SESSION) { DOM.form.innerHTML = renderSessionNodeForm(node); return; }
    if (isSessionChildType(node.type)) { DOM.form.innerHTML = renderSessionChildForm(node, validation); return; }
    DOM.form.innerHTML = '<p class="event-helper">No editable properties for this node.</p>';
  }

  function renderAll() {
    syncDefaultEdges();
    renderPalette();
    renderView();
    renderSummary();
    renderForm();
    updateColdStartVisibility();
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
      setSessionTitle(state.draft, node.id, target.value);
      markDirty();
      renderSummary();
      return;
    }

    if (node.type === NODE_TYPES.SESSION_BASICS) {
      if (target.name === 'session-basics-title') setSessionTitle(state.draft, node.parentSessionId, target.value);
      if (target.name === 'session-basics-summary') payload.summary = target.value;
      if (target.name === 'session-basics-track') payload.track = target.value;
      markDirty();
      renderSummary();
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

    if (target.dataset.action === 'update-session-title') {
      const sessionId = target.dataset.sessionId;
      const sessionNode = state.draft.nodes.find(function (item) { return item.id === sessionId; });
      if (!sessionNode) return;
      setSessionTitle(state.draft, sessionId, target.value);
      markDirty();
      renderSummary();
    }
  }

  // Shared by the free-text field and the quick-add chips, so an assignment
  // behaves identically however it was made.
  function assignSessionInstructor(name, email) {
    const node = state.draft.nodes.find(function (item) { return item.id === state.selectedNodeId; });
    if (!node || node.type !== NODE_TYPES.SESSION_INSTRUCTORS) return;
    const person = { name: cleanText(name), email: cleanText(email) };
    if (!person.name) return;
    const payload = state.draft.payloadByNodeId[node.id];
    const exists = payload.entries.some(function (entry) {
      return cleanText(entry && entry.name) === person.name;
    });
    if (exists) return;
    payload.entries.push(person);
    markDirty();
    computeConflicts(state.draft);
    renderAll();
  }

  function addSessionInstructor() {
    const input = DOM.form.querySelector('#event-session-instructor-input');
    const emailInput = DOM.form.querySelector('#event-session-instructor-email');
    if (!input) return;
    const value = input.value.trim();
    if (!value) return;
    const email = emailInput ? emailInput.value.trim() : '';
    input.value = '';
    if (emailInput) emailInput.value = '';
    assignSessionInstructor(value, email);
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
      setAlert('Add Basics, Registration and Sessions to the canvas first.', true);
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
      setAlert('Add Basics, Registration and Sessions to the canvas first.', true);
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

      const program = getProgramSummary() || { sessionCount: 0, instructorCount: 0, conflictCount: 0 };

      summaryHost.innerHTML = `
        <h2>Event published</h2>
        <p class="event-helper">${escapeHtml(basicsPayload.title || 'Untitled event')} · ${state.draft.sessions.length} session branch(es) · Live in prototype.</p>
        <ul>
          <li>${program.sessionCount} session branch(es), ${program.instructorCount} instructor(s), ${program.conflictCount} unresolved conflict(s)</li>
          <li>Template: ${escapeHtml(state.draft.meta.templateId || state.draft.meta.planId || 'Blank canvas')}</li>
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

    const summary = getProgramSummary();
    const inheritCount = summary.sessionCount - summary.overrideCount;
    summaryHost.innerHTML = `
      <h2>Event published</h2>
      <p class="event-helper">${escapeHtml(basicsPayload.title || 'Untitled event')} · ${summary.sessionCount} session${summary.sessionCount === 1 ? '' : 's'} · ${summary.instructorCount} instructor${summary.instructorCount === 1 ? '' : 's'}.</p>
      <ul>
        <li>Published at ${publishedAt}</li>
        ${summary.registrationLabel ? `<li>Registration: ${escapeHtml(summary.registrationLabel)} — ${inheritCount} inherited${summary.overrideCount ? `, ${summary.overrideCount} overridden` : ''}</li>` : ''}
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
    showColdStart();
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
    showColdStart();
    resetCanvasView();
    showToast('Draft reset.', 4000);
  }

  function initializeEditor() {
    initializeQuickForm();

    const params = new URLSearchParams(window.location.search);
    const templateParam = isEmbeddedWorkspace ? null : params.get('template');

    if (templateParam === 'blank') {
      const draft = createDraft();
      draft.meta.templateChosen = true;
      loadDraft(draft);
      hideColdStart();
      return;
    }

    if (templateParam) {
      if (loadTemplateDraft(templateParam, { skipConfirm: false })) return;
    }

    const stored = readStoredDraft();
    if (stored) {
      loadDraft(stored);
      if (stored.meta && stored.meta.templateChosen) hideColdStart();
      else showColdStart();
      return;
    }

    loadDraft(createDraft());
    showColdStart();
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

  DOM.quickForm && DOM.quickForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (createQuickEvent(readQuickForm())) DOM.canvas.focus();
  });

  DOM.quickForm && DOM.quickForm.addEventListener('input', function () {
    setQuickError('');
  });

  function setAiError(message) {
    if (!DOM.aiError) return;
    DOM.aiError.textContent = message || '';
    DOM.aiError.classList.toggle('is-hidden', !message);
  }

  function runColdStartGeneration() {
    if (!DOM.aiInput) return;
    const text = cleanText(DOM.aiInput.value);
    if (!text) {
      setAiError('Describe the event you want to create.');
      DOM.aiInput.focus();
      return;
    }
    setAiError('');
    if (DOM.aiGenerating) DOM.aiGenerating.classList.remove('is-hidden');
    if (DOM.aiSubmit) DOM.aiSubmit.disabled = true;
    // A short, deliberate beat so generation reads as work rather than an
    // instant swap; the draft itself is built synchronously.
    window.setTimeout(function () {
      const result = generateEventDraftFromText(text);
      if (DOM.aiGenerating) DOM.aiGenerating.classList.add('is-hidden');
      if (DOM.aiSubmit) DOM.aiSubmit.disabled = false;
      loadGeneratedDraft(result.draft, { skipConfirm: true });
      if (DOM.aiInput) DOM.aiInput.value = '';
    }, 620);
  }

  DOM.aiForm && DOM.aiForm.addEventListener('submit', function (event) {
    event.preventDefault();
    runColdStartGeneration();
  });

  DOM.aiInput && DOM.aiInput.addEventListener('input', function () { setAiError(''); });
  DOM.aiInput && DOM.aiInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      runColdStartGeneration();
    }
  });

  DOM.aiForm && DOM.aiForm.addEventListener('click', function (event) {
    const chip = event.target.closest('[data-ai-example]');
    if (!chip || !DOM.aiInput) return;
    DOM.aiInput.value = chip.dataset.aiExample;
    setAiError('');
    DOM.aiInput.focus();
  });

  DOM.manualToggle && DOM.manualToggle.addEventListener('click', function () {
    if (!DOM.quickManual) return;
    const hidden = DOM.quickManual.classList.toggle('is-hidden');
    DOM.manualToggle.textContent = hidden ? 'fill in manually' : 'hide manual form';
    if (!hidden) {
      const firstField = document.getElementById('event-quick-title');
      if (firstField) firstField.focus();
    }
  });

  DOM.quickVenueMode && DOM.quickVenueMode.addEventListener('change', syncQuickVenueLabel);

  DOM.quickForm && DOM.quickForm.addEventListener('change', function (event) {
    if (event.target.name === 'quick-shape' || event.target === DOM.quickSessionCount) syncQuickShape();
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
    updateColdStartVisibility();
    renderAll();
  });

  DOM.canvas.addEventListener('mousedown', function (event) {
    if (state.viewMode !== 'map') return;
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
    // Outline scrolls natively; only the map view captures the wheel to pan/zoom.
    if (state.viewMode !== 'map') return;
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
    updateColdStartVisibility();
    renderAll();
  }

  DOM.canvas.addEventListener('click', function (event) {
    if (state.viewMode !== 'map') {
      handleOutlineClick(event);
      return;
    }

    const option = event.target.closest('[data-insert-type]');
    if (option) {
      insertNodeOfType(option.dataset.insertType);
      return;
    }

    const ghost = event.target.closest('[data-ghost-type]');
    if (ghost) {
      insertNodeOfType(ghost.dataset.ghostType);
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
    if (state.viewMode !== 'map') {
      const row = event.target.closest('.event-outline-row[data-node-id]');
      if (!row) return;
      event.preventDefault();
      selectCanvasNode(row.dataset.nodeId);
      return;
    }
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
  // Cards show live payload values now, so any field edit can change the canvas.
  // Repainting here rather than inside updateSelectedNode keeps the inspector
  // markup untouched, so the field being typed into does not lose focus.
  DOM.form.addEventListener('change', function (event) { updateSelectedNode(event.target); renderView(); });
  DOM.form.addEventListener('input', function (event) { updateSelectedNode(event.target); renderView(); });

  DOM.form.addEventListener('click', function (event) {
    const action = event.target.closest('[data-action]');
    if (!action) return;
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
    if (action.dataset.action === 'assign-known-instructor') {
      assignSessionInstructor(action.dataset.name, action.dataset.email);
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
    if (event.code === 'Space' && !event.repeat && state.viewMode === 'map') {
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

  DOM.viewToggle && DOM.viewToggle.addEventListener('click', function () {
    state.viewMode = state.viewMode === 'map' ? 'outline' : 'map';
    if (state.viewMode === 'map') resetCanvasView();
    renderView();
    if (state.viewMode === 'map') fitCanvasToGraph();
  });

  // ---------------------------------------------------------------------------
  // AI-style event generation (deterministic, prototype-only).
  //
  // There is no LLM in this static kit, so "generation" is a parser: it reads a
  // free-text description and builds the same node draft the manual paths build,
  // reusing createDraft / addNodeByType / seedSessionBranchData. The intent is a
  // convincing chat-to-structure demo, not real language understanding.
  // ---------------------------------------------------------------------------
  const GEN_NUMBER_WORDS = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10, single: 1
  };
  const GEN_MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const GEN_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const GEN_SPOTS = [
    { test: /enterprise/i, spot: 'Enterprise Hub' },
    { test: /growth/i, spot: 'Growth Lab' }
  ];

  function genParseClock(token) {
    if (!token) return null;
    const cleaned = String(token).replace(/\s+/g, '').toLowerCase();
    const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    const meridiem = match[3];
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return null;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function genParseTimeRange(text) {
    const rangeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|–|—|to|until|till)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (rangeMatch) {
      const start = genParseClock(rangeMatch[1]);
      const end = genParseClock(rangeMatch[2]);
      if (start && end && minutesOf(end) > minutesOf(start)) return { start: start, end: end };
    }
    const singleMatch = text.match(/(?:at|from|starts?(?:\s+at)?|beginning(?:\s+at)?)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (singleMatch) {
      const start = genParseClock(singleMatch[1]);
      if (start) return { start: start, end: clockOf(Math.min(minutesOf(start) + 60, (23 * 60) + 59)) };
    }
    return { start: '09:00', end: '10:00' };
  }

  function genToISO(year, monthIndex, day) {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function genParseDate(text) {
    const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const named = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/i);
    if (named) {
      const monthIndex = GEN_MONTHS[named[1].toLowerCase()];
      const day = Number(named[2]);
      if (day < 1 || day > 31) return '';
      const today = new Date(); today.setHours(0, 0, 0, 0);
      let year = named[3] ? Number(named[3]) : today.getFullYear();
      if (!named[3] && new Date(year, monthIndex, day).getTime() < today.getTime()) year += 1;
      return genToISO(year, monthIndex, day);
    }
    return '';
  }

  function genAddDaysISO(iso, days) {
    if (!iso) return '';
    const parts = iso.split('-');
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    date.setDate(date.getDate() + days);
    return genToISO(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function genFormatDateShort(iso) {
    const parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    return `${GEN_MONTH_NAMES[Number(parts[1]) - 1]} ${Number(parts[2])}`;
  }

  function genParseCount(text) {
    const unit = '(?:part|parts|session|sessions|week|weeks|day|days|module|modules|track|tracks)';
    const digit = text.match(new RegExp('(\\d+)\\s*(?:-\\s*)?' + unit, 'i'));
    if (digit) return clampSessionCount(Number(digit[1]));
    const forCount = text.match(/for\s+(\d+)\s+(?:weeks|days|sessions)/i);
    if (forCount) return clampSessionCount(Number(forCount[1]));
    const words = Object.keys(GEN_NUMBER_WORDS).join('|');
    const word = text.match(new RegExp('\\b(' + words + ')[\\s-]+' + unit, 'i'));
    if (word) return clampSessionCount(GEN_NUMBER_WORDS[word[1].toLowerCase()]);
    if (/\bseries\b|\bmulti-?(?:part|session)\b/i.test(text)) return 3;
    return 1;
  }

  function genParseTitle(rawText) {
    const quoted = rawText.match(/["“”']([^"“”']{2,80})["“”']/);
    if (quoted) return cleanText(quoted[1]).replace(/\s+/g, ' ');
    const labelled = rawText.match(/(?:titled|called|named)\s+([^,.\n]{2,60})/i);
    if (labelled) return cleanText(labelled[1]).replace(/\s+/g, ' ');
    const firstClause = cleanText(rawText.split(/[.,\n]/)[0]).replace(/\s+/g, ' ');
    if (firstClause) {
      const shortened = firstClause.length > 60 ? `${firstClause.slice(0, 57).trim()}…` : firstClause;
      return shortened.charAt(0).toUpperCase() + shortened.slice(1);
    }
    return 'New event';
  }

  function genParseInstructors(rawText) {
    const match = rawText.match(/(?:led by|taught by|presented by|hosted by|facilitated by|instructors?:?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:(?:,|\s+and\s+)\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)*)/);
    if (!match) return [];
    return match[1]
      .split(/,|\s+and\s+/)
      .map(function (name) { return cleanText(name); })
      .filter(function (name) { return /^[A-Z][a-z]+/.test(name); })
      .slice(0, 4)
      .map(function (name) { return { name: name, email: '' }; });
  }

  function genParseModality(text) {
    if (/hybrid/i.test(text)) return 'physical';
    if (/virtual|online|remote|webinar|zoom|teams|google meet|livestream|live stream/i.test(text)) return 'virtual';
    if (/in[-\s]person|on[-\s]?site|classroom|training room|auditorium|\bhall\b|\boffice\b/i.test(text)) return 'physical';
    return 'physical';
  }

  function genParseRegistration(text) {
    const modes = [];
    if (/approv|invite|nominat|manager sign|rsvp required|\bapply\b/i.test(text)) modes.push('approval-required');
    else modes.push('open-registration');
    if (/certif|attendance|mandatory|compliance|required training|track completion|graded/i.test(text)) modes.push('attendance-tracked');
    return modes;
  }

  function genParseCadence(text) {
    if (/weekly|every week|each week|per week|once a week/i.test(text)) return 'weekly';
    if (/daily|every day|each day|consecutive days|back[-\s]to[-\s]back/i.test(text)) return 'daily';
    return 'sameday';
  }

  function genParseLocation(rawText, modality) {
    if (modality === 'virtual') {
      const url = rawText.match(/https?:\/\/[^\s,]+/);
      return { location: '', virtualLink: url ? url[0] : '' };
    }
    const at = rawText.match(/\b(?:at|in)\s+((?:the\s+)?[A-Z][^,.\n]{2,48})/);
    return { location: at ? cleanText(at[1]).replace(/\s+/g, ' ') : '', virtualLink: '' };
  }

  function genParseSpot(text) {
    const match = GEN_SPOTS.find(function (item) { return item.test.test(text); });
    return match ? match.spot : 'Northwest Spot';
  }

  function genBranchDetail(data) {
    const parts = [];
    const when = [];
    if (data.date) when.push(genFormatDateShort(data.date));
    if (data.startTime) when.push(`${data.startTime}–${data.endTime}`);
    if (when.length) parts.push(when.join(' '));
    parts.push(data.venueMode === 'virtual' ? 'Virtual' : (data.location || 'In person'));
    parts.push(`${data.capacity} seats`);
    return parts.join(' · ');
  }

  function parseEventPrompt(rawText) {
    const text = String(rawText || '');
    const lower = text.toLowerCase();
    const modality = genParseModality(lower);
    const location = genParseLocation(text, modality);
    const times = genParseTimeRange(lower);
    return {
      title: genParseTitle(text),
      description: cleanText(text).slice(0, 220),
      spot: genParseSpot(lower),
      sessionCount: genParseCount(lower),
      cadence: genParseCadence(lower),
      modality: modality,
      location: location.location,
      virtualLink: location.virtualLink,
      startTime: times.start,
      endTime: times.end,
      date: genParseDate(lower),
      instructors: genParseInstructors(text),
      registrationModes: genParseRegistration(lower)
    };
  }

  function generateEventDraftFromText(rawText) {
    const parsed = parseEventPrompt(rawText);
    const timezone = resolveDefaultTimezone();
    const draft = createDraft();
    const basicsId = addNodeByType(draft, NODE_TYPES.BASICS, false);
    const regId = addNodeByType(draft, NODE_TYPES.REGISTRATION, false);
    const sessionsId = addNodeByType(draft, NODE_TYPES.SESSIONS, false);

    draft.payloadByNodeId[basicsId] = { title: parsed.title, description: parsed.description, spot: parsed.spot };
    draft.payloadByNodeId[regId] = { modes: parsed.registrationModes };

    const duration = Math.max(30, minutesOf(parsed.endTime) - minutesOf(parsed.startTime));
    const stepDays = parsed.cadence === 'weekly' ? 7 : (parsed.cadence === 'daily' ? 1 : 0);
    const spacedByDate = stepDays > 0 && Boolean(parsed.date);

    const branches = [];
    const sessionIds = [];
    for (let index = 0; index < parsed.sessionCount; index += 1) {
      const sessionId = addNodeByType(draft, NODE_TYPES.SESSION, false);
      sessionIds.push(sessionId);

      const suffix = parsed.cadence === 'weekly' ? `Week ${index + 1}`
        : parsed.cadence === 'daily' ? `Day ${index + 1}`
        : `Session ${index + 1}`;
      const sessionTitle = parsed.sessionCount === 1 ? parsed.title : `${parsed.title} — ${suffix}`;
      const startMinutes = spacedByDate ? minutesOf(parsed.startTime) : minutesOf(parsed.startTime) + (index * duration);

      const data = {
        title: sessionTitle,
        summary: parsed.description,
        date: spacedByDate ? genAddDaysISO(parsed.date, index * stepDays) : parsed.date,
        startTime: clockOf(startMinutes),
        endTime: clockOf(startMinutes + duration),
        timezone: timezone,
        venueMode: parsed.modality,
        location: parsed.modality === 'virtual' ? '' : parsed.location,
        virtualLink: parsed.modality === 'virtual' ? parsed.virtualLink : '',
        capacity: DEFAULT_CAPACITY,
        waitlist: 'disabled',
        instructors: parsed.instructors.slice()
      };
      seedSessionBranchData(draft, sessionId, data);
      branches.push({ label: sessionTitle, detail: genBranchDetail(data) });
    }

    draft.payloadByNodeId[sessionsId] = { sessionIds: sessionIds };
    draft.meta.templateChosen = true;
    syncGraphStructure(draft);

    const registrationLabel = parsed.registrationModes.map(registrationModeLabel).join(' + ').toLowerCase();
    const modalityLabel = parsed.modality === 'virtual' ? 'virtual' : 'in-person';
    const cadencePhrase = parsed.cadence === 'weekly' ? ', one per week'
      : parsed.cadence === 'daily' ? ', on consecutive days'
      : (parsed.sessionCount > 1 ? ', back to back' : '');
    const rationale = `I generated ${countLabel(parsed.sessionCount, 'session')} under one ${modalityLabel} event${cadencePhrase}, `
      + `defaulted seats to ${DEFAULT_CAPACITY}, and set ${registrationLabel}. `
      + `Times use ${timezone}, and everything stays editable in the outline.`;

    return {
      draft: draft,
      rationale: rationale,
      structure: { spine: ['Basics', 'Registration', 'Sessions'], branches: branches }
    };
  }

  function loadGeneratedDraft(draft, options) {
    const opts = options || {};
    if (!draft) return false;
    if (!opts.skipConfirm && !confirmReplaceDraft('You have unvalidated changes. Build this event anyway?')) return false;
    loadDraft(draft);
    const sessionsId = findSingletonNodeId(state.draft, NODE_TYPES.SESSIONS);
    if (sessionsId) {
      state.selectedNodeId = sessionsId;
      renderAll();
    }
    saveDraft(false);
    hideColdStart();
    showToast('Event generated. Review the outline, then publish.', 5000);
    return true;
  }

  // Returns the preview payload for chat and, when asked, loads the draft into
  // the workspace. Returning the draft lets a deferred "Build this" action load
  // exactly what the preview described.
  function generateFromText(rawText, options) {
    const opts = options || {};
    const text = cleanText(rawText);
    if (!text) return null;
    const result = generateEventDraftFromText(text);
    if (opts.load) loadGeneratedDraft(result.draft, { skipConfirm: opts.skipConfirm });
    return result;
  }

  window.ArcticEventAdmin = {
    openWorkspace: openWorkspace,
    saveDraftLocal: saveDraftLocal,
    openPublishReview: openPublishReview,
    publishEvent: publishEvent,
    validateAndSave: validateAndSave,
    loadTemplateDraft: loadTemplateDraft,
    createQuickEvent: createQuickEvent,
    buildFromPlan: buildFromPlan,
    generateFromText: generateFromText,
    loadGeneratedDraft: loadGeneratedDraft,
    getConflicts: getConflicts,
    resolveConflict: resolveConflict,
    getProgramSummary: getProgramSummary
  };

  initializeEditor();
}());
