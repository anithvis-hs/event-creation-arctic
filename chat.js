(function () {
  const ARROW_DEFAULT = 'assets/submit%20chat%20arrow.svg';
  const ARROW_FILLED  = 'assets/submit%20chat%20arrow%20-%20filled.svg';
  const CHAT_LIST_ICON_DEFAULT = 'assets/chat%20list.svg';
  const CHAT_LIST_ICON_SELECTED = 'assets/chat%20list%20-%20selected.svg';
  const TITLE_EDIT_ICON = 'assets/edit.svg';
  const TITLE_SAVE_ICON = 'assets/check.svg';
  const DEFAULT_CHAT_TITLE = 'New chat';
  const DEMO_EVENT_BASICS_TITLE = 'Sales Strategies and Approaches 2026';

  const input        = document.getElementById('chat-input');
  const DEFAULT_CHAT_PLACEHOLDER = (input && input.dataset.placeholder) || 'Ask anything...';
  const submitBtn    = document.getElementById('submit-button');
  const arrowImg     = document.getElementById('submit-arrow');
  const messagesArea = document.getElementById('messages-area');
  const chatTitleContent = document.getElementById('chat-title-content');
  const chatTitleEditBtn = document.getElementById('chat-title-edit-button');
  const chatTitleActionIcon = document.getElementById('chat-title-action-icon');
  const homePanel = document.getElementById('home-panel');
  const chatPanel = document.getElementById('chat-panel');
  const chatHistoryPanel = document.getElementById('chat-history-panel');
  const workspacePanel = document.getElementById('workspace-panel');
  const workspaceDefaultView = document.getElementById('workspace-default-view');
  const workspaceEventView = document.getElementById('workspace-event-view');
  const workspaceEventOverviewView = document.getElementById('workspace-event-overview-view');
  const eventOverviewRoot = document.getElementById('event-overview-root');
  const eventOverviewBackButton = document.getElementById('event-overview-back-button');
  const draftProgramButton = document.getElementById('draft-program-button');
  const newChatBtn = document.getElementById('new-chat-button');
  const chatListBtn = document.getElementById('chat-list-button');
  const chatListIcon = chatListBtn ? chatListBtn.querySelector('.icon-img') : null;
  const profileHomeBtn = document.getElementById('profile-home-button');
  const pageSwitcherToggle = document.getElementById('page-switcher-toggle');
  const pageSwitcherHomeLabel = pageSwitcherToggle
    ? pageSwitcherToggle.querySelector('.menu-text')
    : null;
  const chatSearchInput = document.getElementById('chat-search-input');
  const chatListSections = document.getElementById('chat-list-sections');
  const homeInput = document.getElementById('home-prompt-input');
  const homeSubmitBtn = document.getElementById('home-prompt-submit');
  const homeArrowImg = document.getElementById('home-prompt-arrow');
  const BOTTOM_CLEARANCE_SHOW_THRESHOLD = 160;
  const BOTTOM_CLEARANCE_HIDE_THRESHOLD = 320;

  let isEditingTitle = false;
  let currentView = 'home';
  let lastNonListView = 'home';
  let titleBeforeEdit = '';
  let shouldAutoScrollToBottom = true;

  const demoChats = {
    'methodology-rollout': {
      title: 'Sales Methodology certification rollout',
      messages: [
        {
          type: 'user',
          text: '412 reps across AMER, EMEA, and APAC need Sales Methodology certification before March 31. Help me set up the program.'
        },
        {
          type: 'ai',
          intro: 'I drafted a 3-session Sales Methodology certification, one parallel session per region, and I am opening it on the canvas now. Tweak anything from there, or just tell me what to change.',
          heading: 'Program drafted',
          details: [
            'Capacity is split 180 / 150 / 82 to match regional headcount, so no single region is oversubscribed.',
            'AMER and EMEA both run on March 12 and APAC on March 13, which keeps the whole rollout inside one week and well ahead of the March 31 deadline.',
            'Want me to finish setup? I\'ll enroll the audience and size each session to headcount, confirm times against calendars, and reserve rooms + Zoom in one pass.'
          ],
          generatedCard: {
            title: 'Sales Methodology Certification 2026',
            sessionCount: 3
          },
          actions: [
            { label: 'Finish setup', enterpriseSetup: true },
            { label: 'Not now', dismiss: true }
          ]
        }
      ]
    },
    'openai-deal': {
      title: 'OpenAI 2026 deal progression',
      messages: [
        {
          type: 'user',
          text: 'Where does the OpenAI 2026 expansion deal stand right now?'
        },
        {
          type: 'ai',
          intro: 'The deal is active but needs momentum. It is still in Proposal with a 72 health score, and the last outbound touch was 12 days ago.',
          heading: 'Recommended next move',
          details: [
            'Send the champion a short pulse-check note today and confirm whether Security still needs procurement validation.',
            'Add the Enterprise Security Suite upsell to the digital room so the proposal aligns with the Q3 multi-product initiative.'
          ]
        },
        {
          type: 'user',
          text: 'What should I ask the champion?'
        },
        {
          type: 'ai',
          intro: 'Ask for a clear read on decision timing and any remaining blockers before the proposal review.',
          heading: 'Suggested note',
          details: [
            '"Hi Maya, checking in on the OpenAI 2026 expansion. Are Security and Procurement aligned on the current proposal, or is there anything we should adjust before next week\'s review?"'
          ]
        },
        {
          type: 'user',
          text: 'Anything else to prep before the next meeting?'
        },
        {
          type: 'ai',
          intro: 'Yes. Bring a concise mutual action plan and one slide showing the value of adding Enterprise Security Suite now instead of waiting for renewal.',
          heading: 'Prep checklist',
          details: [
            'Confirm executive sponsor attendance.',
            'Update the digital room with the security module and a procurement FAQ.',
            'Prepare a close-plan date tied to the Q3 expansion target.'
          ]
        }
      ]
    },
    'new-event-creation': {
      title: 'New event creation',
      messages: [
        {
          type: 'user',
          text: 'I need to create a new company event.'
        },
        {
          type: 'ai',
          intro: 'Start with an event template instead of building from an empty canvas. Each template pre-builds the node map so you only configure details and sessions.',
          heading: 'Recommended templates',
          details: [
            'Sales kickoff — multi-track launch event with sessions and instructors.',
            'Company training — onboarding-style program with registration and session branches.',
            'Product training — instructor-led enablement with focused session flow.'
          ],
          actions: [
            { label: 'Open event workspace', openEventWorkspace: true },
            { label: 'Sales kickoff', openEventWorkspace: true, template: 'sales-kickoff' },
            { label: 'Company training', openEventWorkspace: true, template: 'company-training' },
            { label: 'Product training', openEventWorkspace: true, template: 'product-training' }
          ]
        },
        {
          type: 'user',
          text: 'Create an event titled "Sales Strategies and Approaches 2026" from scratch.'
        },
        {
          type: 'ai',
          intro: 'I\'ll open the event workspace beside chat so you can build from a blank canvas. Start in Basics with the title "Sales Strategies and Approaches 2026", then add registration and session nodes and connect calendar experiences when you\'re ready.',
          heading: 'Create from scratch',
          details: [
            'Use the workspace link below, then complete Basics before moving through the canvas.'
          ],
          actions: [
            { label: 'Open event workspace', openEventWorkspace: true, basicsTitle: DEMO_EVENT_BASICS_TITLE }
          ]
        }
      ]
    }
  };

  // Seeded sessions for the methodology rollout. The AI still drafts all three
  // regions; Step 2 renders them so the human can review, tweak, or add/remove.
  const METHODOLOGY_SESSIONS = [
    { key: 'AMER', name: 'AMER', capacity: 180, date: '2026-03-12', timezone: 'America/Los_Angeles' },
    { key: 'EMEA', name: 'EMEA', capacity: 150, date: '2026-03-12', timezone: 'Europe/London' },
    { key: 'APAC', name: 'APAC', capacity: 82, date: '2026-03-13', timezone: 'Asia/Singapore' }
  ];

  // Basics + Registration edits captured from Step 1, carried into the Build
  // click on Step 2 so the two agent turns compose into one plan.
  let pendingProgramEdits = null;

  function buildMethodologySessionsMessage() {
    return {
      type: 'ai',
      intro: 'I drafted three parallel sessions, one per region, so no single agenda has to serve every timezone. Review, tweak, or add and remove any before you build.',
      heading: 'Sessions',
      details: [
        'Capacity is split 180 / 150 / 82 to match regional headcount, so no single region is oversubscribed.',
        'AMER and EMEA both run on March 12 and APAC on March 13, which keeps the whole rollout inside one week and well ahead of the March 31 deadline.'
      ],
      structure: {
        editable: true,
        step: 'sessions',
        branches: METHODOLOGY_SESSIONS.map(function (branch) {
          return Object.assign({}, branch);
        })
      },
      actions: [
        { label: 'Build this on the canvas', buildPlan: 'methodology-rollout' }
      ]
    };
  }

  function hasContent() {
    return input.textContent.trim().length > 0;
  }

  function homeHasContent() {
    return homeInput && homeInput.textContent.trim().length > 0;
  }

  function updateArrow() {
    arrowImg.src = hasContent() ? ARROW_FILLED : ARROW_DEFAULT;
  }

  function updateHomeArrow() {
    if (!homeArrowImg) return;

    homeArrowImg.src = homeHasContent() ? ARROW_FILLED : ARROW_DEFAULT;
  }

  function updateMessagesTopSpacing() {
    const shouldUseCompactTopSpacing = messagesArea.scrollTop > 0;

    messagesArea.classList.toggle('compact-top-spacing', shouldUseCompactTopSpacing);
  }

  function getDistanceFromBottom() {
    return messagesArea.scrollHeight - messagesArea.clientHeight - messagesArea.scrollTop;
  }

  function setMessagesBottomClearance(shouldHaveClearance) {
    messagesArea.classList.toggle('has-bottom-clearance', shouldHaveClearance);
  }

  function updateMessagesBottomClearance() {
    const hasBottomClearance = messagesArea.classList.contains('has-bottom-clearance');
    const distanceFromBottom = getDistanceFromBottom();

    if (!hasBottomClearance && distanceFromBottom <= BOTTOM_CLEARANCE_SHOW_THRESHOLD) {
      setMessagesBottomClearance(true);
      return;
    }

    if (!shouldAutoScrollToBottom && hasBottomClearance && distanceFromBottom > BOTTOM_CLEARANCE_HIDE_THRESHOLD) {
      setMessagesBottomClearance(false);
    }
  }

  function isNearBottom() {
    return getDistanceFromBottom() <= 12;
  }

  function scrollToBottom() {
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  function syncAutoScrollState() {
    const wasAutoScrolling = shouldAutoScrollToBottom;
    shouldAutoScrollToBottom = isNearBottom();
    updateMessagesBottomClearance();

    if (!wasAutoScrolling && shouldAutoScrollToBottom) {
      scrollToBottom();
    }
  }

  function createUserBubble(text) {
    const bubble = document.createElement('div');
    bubble.className = 'user-message-bubble';
    bubble.textContent = text;
    return bubble;
  }

  function createActionButton(label, onActivate) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'home-task-action ai-response-action';
    button.textContent = label;
    button.addEventListener('click', function () {
      onActivate(button);
    });
    return button;
  }

  // Renders the proposed node map inline so the chat and the canvas visibly
  // describe the same structure.
  function createStructurePreview(structure) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-response-structure';

    if (structure.editable) {
      wrapper.classList.add('is-editable');
      wrapper.appendChild(createEditableStructure(structure));
      return wrapper;
    }

    const spine = document.createElement('ol');
    spine.className = 'ai-structure-spine';
    (structure.spine || []).forEach(function (step) {
      const item = document.createElement('li');
      item.textContent = step;
      spine.appendChild(item);
    });
    wrapper.appendChild(spine);

    const branches = structure.branches || [];
    if (branches.length) {
      const branchList = document.createElement('ul');
      branchList.className = 'ai-structure-branches';

      branches.forEach(function (branch) {
        const item = document.createElement('li');

        const label = document.createElement('span');
        label.className = 'ai-structure-branch-label';
        label.textContent = branch.label;

        const detail = document.createElement('span');
        detail.className = 'ai-structure-branch-detail';
        detail.textContent = branch.detail;

        item.appendChild(label);
        item.appendChild(detail);
        branchList.appendChild(item);
      });

      wrapper.appendChild(branchList);
    }

    return wrapper;
  }

  // Editable card: sections are gated by structure.step so the flow can present
  // Basics + Registration first (details) and the region rows second (sessions).
  // An absent step renders every section, preserving the single-card behavior.
  function createEditableStructure(structure) {
    const sections = document.createElement('ol');
    sections.className = 'ai-structure-sections';

    const step = structure.step;
    const showDetails = step === 'details' || !step;
    const showSessions = step === 'sessions' || !step;

    if (showDetails) {
      const basics = structure.basics || {};
      const basicsSection = createStructureSection('Basics');
      basicsSection.appendChild(createBasicsField('title', 'Event title', basics.title, 'text'));
      basicsSection.appendChild(createBasicsField('description', 'Description', basics.description, 'textarea'));
      basicsSection.appendChild(createBasicsField('spot', 'Spot', basics.spot, 'select', [
        'Northwest Spot',
        'Enterprise Hub',
        'Growth Lab'
      ]));
      sections.appendChild(basicsSection);

      const registration = structure.registration || {};
      const regSection = createStructureSection('Registration');
      regSection.appendChild(createRegistrationControls(registration));
      sections.appendChild(regSection);
    }

    if (showSessions) {
      const sessionsSection = createStructureSection('Sessions');
      const branchList = document.createElement('ul');
      branchList.className = 'ai-structure-branches is-editable';
      (structure.branches || []).forEach(function (branch) {
        branchList.appendChild(createBranchRow(branch));
      });
      sessionsSection.appendChild(branchList);
      sessionsSection.appendChild(createAddSessionButton(branchList));
      sections.appendChild(sessionsSection);
    }

    return sections;
  }

  // One editable session row. Rows are read at build time by querying
  // .ai-structure-branch, so adding or removing rows flows through without
  // any change to readStructureEdits.
  function createBranchRow(branch) {
    const data = branch || {};
    const item = document.createElement('li');
    item.className = 'ai-structure-branch';
    item.appendChild(createBranchField('name', 'Region', data.name, 'text'));
    item.appendChild(createBranchField('capacity', 'Seats', data.capacity, 'number'));
    item.appendChild(createBranchField('date', 'Date', data.date, 'date'));
    item.appendChild(createBranchField('timezone', 'Timezone', data.timezone, 'text'));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ai-structure-branch-remove';
    remove.setAttribute('aria-label', 'Remove session');
    remove.textContent = '\u00d7';
    remove.addEventListener('click', function () {
      const list = item.parentElement;
      if (!list || list.querySelectorAll('.ai-structure-branch').length <= 1) return;
      item.remove();
    });
    item.appendChild(remove);

    return item;
  }

  function createAddSessionButton(branchList) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ai-structure-add-session';
    button.textContent = '+ Add session';
    button.addEventListener('click', function () {
      branchList.appendChild(createBranchRow({
        name: '',
        capacity: '',
        date: '',
        timezone: ''
      }));
    });
    return button;
  }

  function createStructureSection(title) {
    const section = document.createElement('li');
    section.className = 'ai-structure-section';

    const heading = document.createElement('span');
    heading.className = 'ai-structure-section-title';
    heading.textContent = title;
    section.appendChild(heading);

    return section;
  }

  function createBasicsField(field, label, value, inputType, options) {
    const wrap = document.createElement('label');
    wrap.className = 'ai-structure-field ai-structure-field-wide';

    const caption = document.createElement('span');
    caption.className = 'ai-structure-field-label';
    caption.textContent = label;
    wrap.appendChild(caption);

    const control = document.createElement(
      inputType === 'textarea' ? 'textarea' : (inputType === 'select' ? 'select' : 'input')
    );
    control.className = 'ai-structure-input';
    if (inputType === 'textarea') control.rows = 2;
    else if (inputType === 'select') {
      (options || []).forEach(function (optionValue) {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        control.appendChild(option);
      });
    } else control.type = inputType;
    control.value = value === undefined || value === null ? '' : String(value);
    control.dataset.basicsField = field;
    wrap.appendChild(control);

    return wrap;
  }

  let regPathGroupId = 0;

  function createRegistrationControls(registration) {
    const row = document.createElement('div');
    row.className = 'ai-structure-registration';

    // Two mutually exclusive options read better as radios than a dropdown:
    // both are visible at a glance on the review card.
    const pathWrap = document.createElement('div');
    pathWrap.className = 'ai-structure-field';
    const pathLabel = document.createElement('span');
    pathLabel.className = 'ai-structure-field-label';
    pathLabel.textContent = 'Registration';
    pathWrap.appendChild(pathLabel);

    const group = document.createElement('div');
    group.className = 'ai-structure-radio-group';
    // A unique name per card keeps grouping correct if more than one card is in
    // the DOM (e.g. across streamed agent turns).
    const groupName = 'reg-path-' + (++regPathGroupId);
    const hasPath = registration.path === 'open-registration' || registration.path === 'approval-required';
    [
      { value: 'open-registration', label: 'Open' },
      { value: 'approval-required', label: 'Approval required' }
    ].forEach(function (opt, index) {
      const option = document.createElement('label');
      option.className = 'ai-structure-radio';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = groupName;
      input.dataset.reg = 'path';
      input.value = opt.value;
      input.checked = hasPath ? registration.path === opt.value : index === 0;
      const text = document.createElement('span');
      text.textContent = opt.label;
      option.appendChild(input);
      option.appendChild(text);
      group.appendChild(option);
    });
    pathWrap.appendChild(group);
    row.appendChild(pathWrap);

    // Track attendance is independent of the path (it applies to either), so it
    // sits in its own divider-separated subgroup rather than as a third radio.
    const attendance = document.createElement('div');
    attendance.className = 'ai-structure-attendance';
    const attendanceLabel = document.createElement('span');
    attendanceLabel.className = 'ai-structure-field-label';
    attendanceLabel.textContent = 'Attendance';
    attendance.appendChild(attendanceLabel);

    const toggle = document.createElement('label');
    toggle.className = 'ai-structure-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.reg = 'attendance';
    checkbox.checked = Boolean(registration.attendance);
    const toggleText = document.createElement('span');
    toggleText.textContent = 'Track attendance';
    toggle.appendChild(checkbox);
    toggle.appendChild(toggleText);
    attendance.appendChild(toggle);
    row.appendChild(attendance);

    return row;
  }

  function createBranchField(field, label, value, inputType) {
    const wrap = document.createElement('label');
    wrap.className = 'ai-structure-field';
    wrap.dataset.field = field;

    const caption = document.createElement('span');
    caption.className = 'ai-structure-field-label';
    caption.textContent = label;

    const input = document.createElement('input');
    input.type = inputType;
    input.className = 'ai-structure-input';
    input.value = value === undefined || value === null ? '' : String(value);
    input.dataset.field = field;
    if (inputType === 'number') input.min = '0';

    wrap.appendChild(caption);
    wrap.appendChild(input);
    return wrap;
  }

  // Reads the human's edits out of an editable structure card at build time.
  // Returns null for read-only cards so the plan builds from its seeded defaults.
  function readStructureEdits(root) {
    if (!root || !root.querySelector('.ai-response-structure.is-editable')) return null;

    const basics = {};
    root.querySelectorAll('[data-basics-field]').forEach(function (input) {
      basics[input.dataset.basicsField] = input.value;
    });

    const pathChecked = root.querySelector('[data-reg="path"]:checked');
    const attendance = root.querySelector('[data-reg="attendance"]');
    const registration = {
      path: pathChecked ? pathChecked.value : '',
      attendance: attendance ? attendance.checked : false
    };

    const sessions = [];
    root.querySelectorAll('.ai-structure-branch').forEach(function (row) {
      const edit = {};
      row.querySelectorAll('.ai-structure-input').forEach(function (input) {
        edit[input.dataset.field] = input.value;
      });
      sessions.push(edit);
    });

    return { basics: basics, registration: registration, sessions: sessions };
  }

  // Streamed agent responses: a brief "thinking" indicator, then the reply text
  // types in and its cards/actions fade in after. Content reveal (the typing
  // cadence) is a local constant; the shimmer and card fade-in use Polar tokens.
  const AGENT_THINK_PHRASES = ['Analyzing historical context', 'Drafting the event', 'Checking schedules'];
  const AGENT_THINK_DURATION = 900;
  const AGENT_PHRASE_INTERVAL = 450;
  const STREAM_TICK_MS = 16;
  const STREAM_CHARS_PER_TICK = 3;

  function prefersReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function createThinkingIndicator() {
    const el = document.createElement('div');
    el.className = 'ai-thinking';

    const spark = document.createElement('span');
    spark.className = 'ai-thinking-spark';
    spark.setAttribute('aria-hidden', 'true');
    spark.textContent = '\u2726';

    const label = document.createElement('span');
    label.className = 'ai-thinking-label';
    label.textContent = AGENT_THINK_PHRASES[0];

    const chevron = document.createElement('span');
    chevron.className = 'ai-thinking-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '\u2304';

    el.appendChild(spark);
    el.appendChild(label);
    el.appendChild(chevron);

    let timer = null;
    return {
      el: el,
      start: function () {
        let index = 0;
        timer = window.setInterval(function () {
          index = (index + 1) % AGENT_THINK_PHRASES.length;
          label.textContent = AGENT_THINK_PHRASES[index];
        }, AGENT_PHRASE_INTERVAL);
      },
      stop: function () {
        if (timer) window.clearInterval(timer);
        timer = null;
      }
    };
  }

  function autoScrollIfNeeded() {
    if (shouldAutoScrollToBottom) scrollToBottom();
  }

  // Types out the response's text nodes in order, then reveals the deferred
  // attachments (structure preview, requirements form, generated card, actions).
  function streamResponseText(wrapper, onDone) {
    const textNodes = Array.prototype.slice.call(
      wrapper.querySelectorAll('.ai-response-text, .ai-response-heading')
    );
    const attachments = Array.prototype.slice.call(
      wrapper.querySelectorAll('.ai-response-structure, .ai-requirements-form, .ai-generated-card, .ai-response-actions')
    );
    attachments.forEach(function (node) { node.classList.add('is-stream-pending'); });

    const targets = textNodes.map(function (node) {
      const full = node.textContent;
      node.textContent = '';
      return { node: node, full: full };
    });

    function revealAttachments() {
      attachments.forEach(function (node, index) {
        window.setTimeout(function () {
          node.classList.remove('is-stream-pending');
          node.classList.add('is-stream-in');
          node.addEventListener('animationend', function handler() {
            node.classList.remove('is-stream-in');
            node.removeEventListener('animationend', handler);
          });
          autoScrollIfNeeded();
        }, index * 60);
      });
      if (typeof onDone === 'function') onDone();
    }

    function typeNode(i) {
      if (i >= targets.length) {
        revealAttachments();
        return;
      }
      const target = targets[i];
      if (!target.full) {
        typeNode(i + 1);
        return;
      }
      target.node.classList.add('ai-stream-active');
      let pos = 0;
      const tick = window.setInterval(function () {
        pos = Math.min(target.full.length, pos + STREAM_CHARS_PER_TICK);
        target.node.textContent = target.full.slice(0, pos);
        autoScrollIfNeeded();
        if (pos >= target.full.length) {
          window.clearInterval(tick);
          target.node.classList.remove('ai-stream-active');
          typeNode(i + 1);
        }
      }, STREAM_TICK_MS);
    }

    typeNode(0);
  }

  // onComplete (optional) fires once the reply has fully rendered: immediately in
  // reduced-motion, or after the stream finishes otherwise. Callers use it to
  // sequence a follow-on action (e.g. auto-opening the canvas after narration).
  function appendAiMessage(response, onComplete) {
    if (prefersReducedMotion()) {
      messagesArea.appendChild(createAiResponse(response));
      setMessagesBottomClearance(true);
      scrollToBottom();
      updateMessagesTopSpacing();
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    const thinking = createThinkingIndicator();
    messagesArea.appendChild(thinking.el);
    thinking.start();
    setMessagesBottomClearance(true);
    scrollToBottom();

    window.setTimeout(function () {
      thinking.stop();
      thinking.el.remove();
      const wrapper = createAiResponse(response);
      messagesArea.appendChild(wrapper);
      // Blank the text and hide attachments synchronously first, then anchor the
      // scroll to the now-short message so the reveal grows down from a stable
      // point instead of jumping to the bottom of a full-height block.
      streamResponseText(wrapper, function () {
        setMessagesBottomClearance(true);
        updateMessagesTopSpacing();
        autoScrollIfNeeded();
        if (typeof onComplete === 'function') onComplete();
      });
      setMessagesBottomClearance(true);
      scrollToBottom();
      updateMessagesTopSpacing();
    }, AGENT_THINK_DURATION);
  }

  // Small DOM helpers shared by the requirements form so each labelled control
  // matches the workspace's `.event-field` markup.
  function makeFormField(grid, id, labelText, control) {
    const field = document.createElement('div');
    field.className = 'event-field';
    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = labelText;
    control.id = id;
    field.appendChild(label);
    field.appendChild(control);
    grid.appendChild(field);
    return control;
  }

  function makeInput(type, value) {
    const el = document.createElement('input');
    el.type = type || 'text';
    if (value != null) el.value = value;
    return el;
  }

  function makeSelect(options, value) {
    const el = document.createElement('select');
    options.forEach(function (opt) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === value) option.selected = true;
      el.appendChild(option);
    });
    return el;
  }

  // In-chat requirements form: the parse pre-fills every field, the human
  // adjusts, and Generate builds the draft (nothing opens yet).
  function createRequirementsForm(params) {
    const p = params || {};
    const cadence = p.cadence === 'weekly' || p.cadence === 'daily' ? p.cadence : 'sameday';
    const modality = p.modality === 'virtual' ? 'virtual' : 'physical';
    const registration = (p.registrationModes || []).indexOf('approval-required') > -1
      ? 'approval-required'
      : 'open-registration';
    const instructors = Array.isArray(p.instructors) ? p.instructors.join(', ') : '';

    const form = document.createElement('form');
    form.className = 'ai-requirements-form';
    form.setAttribute('novalidate', 'novalidate');

    const title = document.createElement('p');
    title.className = 'ai-requirements-title';
    title.textContent = 'Generate event';
    form.appendChild(title);

    // Requirements group
    const reqGroup = document.createElement('div');
    reqGroup.className = 'ai-requirements-group';
    const reqLabel = document.createElement('span');
    reqLabel.className = 'ai-requirements-group-label';
    reqLabel.textContent = 'Requirements';
    reqGroup.appendChild(reqLabel);

    const reqGrid = document.createElement('div');
    reqGrid.className = 'ai-requirements-grid';
    const audienceInput = makeFormField(reqGrid, 'ai-req-audience', 'Audience', makeInput('text', p.audience || ''));
    audienceInput.placeholder = 'New-hire sales reps';

    const objectiveField = document.createElement('div');
    objectiveField.className = 'event-field ai-requirements-wide';
    const objectiveLabel = document.createElement('label');
    objectiveLabel.setAttribute('for', 'ai-req-objective');
    objectiveLabel.textContent = 'Objective';
    const objectiveInput = document.createElement('textarea');
    objectiveInput.id = 'ai-req-objective';
    objectiveInput.rows = 2;
    objectiveInput.value = p.description || '';
    objectiveInput.placeholder = 'What should attendees be able to do afterward?';
    objectiveField.appendChild(objectiveLabel);
    objectiveField.appendChild(objectiveInput);
    reqGrid.appendChild(objectiveField);
    reqGroup.appendChild(reqGrid);

    // Reference content: display-only fidelity detail, not wired to generation.
    const refField = document.createElement('div');
    refField.className = 'event-field ai-requirements-wide';
    const refLabel = document.createElement('label');
    refLabel.textContent = 'Reference content';
    const refRow = document.createElement('div');
    refRow.className = 'ai-requirements-refs';
    const refHint = document.createElement('span');
    refHint.className = 'ai-requirements-ref-hint';
    refHint.textContent = 'No content attached';
    const addRef = document.createElement('button');
    addRef.type = 'button';
    addRef.className = 'ai-requirements-ref-add';
    addRef.textContent = 'Add content';
    addRef.disabled = true;
    refRow.appendChild(refHint);
    refRow.appendChild(addRef);
    refField.appendChild(refLabel);
    refField.appendChild(refRow);
    reqGroup.appendChild(refField);
    form.appendChild(reqGroup);

    // Event shape group
    const shapeGroup = document.createElement('div');
    shapeGroup.className = 'ai-requirements-group';
    const shapeLabel = document.createElement('span');
    shapeLabel.className = 'ai-requirements-group-label';
    shapeLabel.textContent = 'Event shape';
    shapeGroup.appendChild(shapeLabel);

    const shapeGrid = document.createElement('div');
    shapeGrid.className = 'ai-requirements-grid';

    const nameInput = makeFormField(shapeGrid, 'ai-req-name', 'Event name', makeInput('text', p.title || ''));
    nameInput.placeholder = 'New event';
    nameInput.classList.add('ai-requirements-wide');

    const sessionsInput = makeFormField(shapeGrid, 'ai-req-sessions', 'Sessions', makeInput('number', p.sessionCount || 1));
    sessionsInput.min = '1';
    sessionsInput.max = '12';

    makeFormField(shapeGrid, 'ai-req-cadence', 'Cadence', makeSelect([
      { value: 'sameday', label: 'Same day' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'daily', label: 'Daily' }
    ], cadence));

    makeFormField(shapeGrid, 'ai-req-date', 'First date', makeInput('date', p.date || ''));
    makeFormField(shapeGrid, 'ai-req-start', 'Starts', makeInput('time', p.startTime || '09:00'));
    makeFormField(shapeGrid, 'ai-req-end', 'Ends', makeInput('time', p.endTime || '10:00'));

    makeFormField(shapeGrid, 'ai-req-modality', 'Where', makeSelect([
      { value: 'physical', label: 'In person' },
      { value: 'virtual', label: 'Virtual' }
    ], modality));

    const venueInput = makeFormField(shapeGrid, 'ai-req-venue', 'Venue or link',
      makeInput('text', modality === 'virtual' ? (p.virtualLink || '') : (p.location || '')));
    venueInput.placeholder = 'Enterprise Hub';
    venueInput.classList.add('ai-requirements-wide');

    const instructorInput = makeFormField(shapeGrid, 'ai-req-instructor', 'Instructor', makeInput('text', instructors));
    instructorInput.placeholder = 'Full name';
    instructorInput.classList.add('ai-requirements-wide');

    makeFormField(shapeGrid, 'ai-req-registration', 'Registration', makeSelect([
      { value: 'open-registration', label: 'Open registration' },
      { value: 'approval-required', label: 'Approval required' }
    ], registration));

    shapeGroup.appendChild(shapeGrid);
    form.appendChild(shapeGroup);

    // Footer actions
    const footer = document.createElement('div');
    footer.className = 'ai-requirements-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'home-task-action ai-response-action ai-requirements-cancel';
    cancelBtn.textContent = 'Cancel';
    const generateBtn = document.createElement('button');
    generateBtn.type = 'submit';
    generateBtn.className = 'home-task-action ai-response-action ai-requirements-generate';
    generateBtn.textContent = 'Generate';
    footer.appendChild(cancelBtn);
    footer.appendChild(generateBtn);
    form.appendChild(footer);

    function disableForm() {
      Array.prototype.forEach.call(form.querySelectorAll('input, textarea, select, button'), function (el) {
        el.disabled = true;
      });
    }

    cancelBtn.addEventListener('click', function () {
      disableForm();
      appendAiMessage({ intro: 'Okay, cancelled. Describe the event again whenever you are ready.', details: [] });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const admin = window.ArcticEventAdmin;
      if (!admin || typeof admin.buildDraftFromParams !== 'function') return;

      const audience = audienceInput.value.trim();
      const objective = objectiveInput.value.trim();
      const description = [audience ? ('Audience: ' + audience) : '', objective]
        .filter(Boolean).join('. ');
      const chosenModality = document.getElementById('ai-req-modality').value === 'virtual' ? 'virtual' : 'physical';
      const venueValue = venueInput.value.trim();

      const built = {
        title: nameInput.value.trim() || 'New event',
        description: description,
        // Spot is a required Basics field with no form control; carry the
        // parsed spot when present, otherwise fall back to the default.
        spot: (params && params.spot) || 'Northwest Spot',
        sessionCount: Math.max(1, parseInt(sessionsInput.value, 10) || 1),
        cadence: document.getElementById('ai-req-cadence').value,
        modality: chosenModality,
        location: chosenModality === 'physical' ? venueValue : '',
        virtualLink: chosenModality === 'virtual' ? venueValue : '',
        startTime: document.getElementById('ai-req-start').value || '09:00',
        endTime: document.getElementById('ai-req-end').value || '10:00',
        date: document.getElementById('ai-req-date').value || '',
        timeExplicit: true,
        // The session model stores instructors as { name, email } entries.
        instructors: instructorInput.value.split(',').map(function (name) { return name.trim(); })
          .filter(Boolean).map(function (name) { return { name: name, email: '' }; }),
        registrationModes: [document.getElementById('ai-req-registration').value],
        audience: audience
      };

      const result = admin.buildDraftFromParams(built);
      const draft = result && result.draft;
      if (!draft) return;

      disableForm();
      appendAiMessage({
        intro: 'Successfully generated. Review it in the canvas to make edits.',
        details: [],
        generatedCard: {
          title: built.title,
          sessionCount: built.sessionCount,
          draft: draft
        }
      });
    });

    return form;
  }

  // Read-only summary of the drafted event. The canvas auto-opens after the
  // narration, so this is a confirmation, not an action surface.
  function createGeneratedCard(summary) {
    const card = document.createElement('div');
    card.className = 'ai-generated-card';

    const header = document.createElement('div');
    header.className = 'ai-generated-header';
    const name = document.createElement('span');
    name.className = 'ai-generated-name';
    name.textContent = summary.title || 'New event';
    const chip = document.createElement('span');
    chip.className = 'ai-generated-chip';
    chip.textContent = 'Draft';
    header.appendChild(name);
    header.appendChild(chip);
    card.appendChild(header);

    const label = document.createElement('span');
    label.className = 'ai-generated-label';
    const count = summary.sessionCount || 1;
    label.textContent = 'Event plan \u00b7 ' + count + (count === 1 ? ' session' : ' sessions');
    card.appendChild(label);

    return card;
  }

  // The assistant reads conflicts off the live canvas state rather than from
  // scripted copy, so the follow-up matches whatever was actually built.
  function appendConflictFollowUp() {
    const admin = window.ArcticEventAdmin;
    if (!admin || typeof admin.getConflicts !== 'function') return;

    const conflicts = admin.getConflicts();
    let blockerIndex = -1;
    conflicts.forEach(function (item, index) {
      if (blockerIndex === -1 && item.type === 'error' && item.isResolvable) blockerIndex = index;
    });

    if (blockerIndex === -1) {
      appendAiMessage({
        intro: 'The canvas is built and I found no scheduling collisions across the three branches.',
        heading: 'Ready for review',
        details: ['Open any node on the canvas to fill in the remaining details.']
      });
      return;
    }

    const blocker = conflicts[blockerIndex];
    appendAiMessage({
      intro: 'The canvas is built. While laying out the branches I checked the regional schedules against each other and found a collision.',
      heading: 'Needs a decision',
      details: [
        blocker.message,
        `This affects ${blocker.sessionTitle} and ${blocker.counterpartTitle}. I can move the later session so the two no longer overlap.`
      ],
      actions: [
        { label: 'Reschedule the later session', resolveConflictIndex: blockerIndex }
      ]
    });
  }

  function resolveCanvasConflict(index) {
    const admin = window.ArcticEventAdmin;
    if (!admin || typeof admin.resolveConflict !== 'function') return null;
    return admin.resolveConflict(index);
  }

  function appendFixConfirmation(result) {
    const timezoneNote = result.timezone ? ` (${result.timezone})` : '';
    const details = [
      `${result.sessionTitle} moved from ${result.previousWindow} to ${result.nextWindow}${timezoneNote}. Its schedule node is selected on the canvas.`
    ];

    details.push(result.remainingConflicts
      ? `${result.remainingConflicts} other issue${result.remainingConflicts === 1 ? '' : 's'} still needs attention before publish.`
      : 'No conflicts remain. The program is ready for review and publish.');

    appendAiMessage({
      intro: 'Done. I shifted the later session so the two no longer overlap, then re-checked the whole program.',
      heading: 'Conflict resolved',
      details: details
    });
  }

  // Proactive core of the AI-first flow, reshaped as a single follow-up. Rather
  // than auto-dumping a stepped audience/times/rooms report, the reveal turn ends
  // with ONE question: "want me to finish setup?" (Finish setup / Not now).
  // Accepting runs the whole pass (LMS enrollment, calendar confirmation,
  // room/video booking) and posts a single recap. The only genuine interruption
  // left is a real scheduling collision, surfaced at the end for a decision.
  //
  // offerEnterpriseSetup posts the question as its own turn; it is used by the
  // explicit proposal-build path, where there is no reveal message to fold into.
  function offerEnterpriseSetup() {
    const admin = window.ArcticEventAdmin;
    const integrations = window.ArcticIntegrations;
    if (!admin || !integrations || typeof admin.getEventContext !== 'function') return;

    const context = admin.getEventContext();
    if (!context || !context.sessions || !context.sessions.length) return;

    const audience = integrations.getAudience(context);
    appendAiMessage({
      intro: audience.summary,
      heading: 'Want me to finish setup?',
      details: [
        'I can enroll the audience and size each session to headcount, confirm every time against the instructor and attendee calendars, and reserve rooms plus create Zoom links \u2014 all in one pass.'
      ],
      actions: [
        { label: 'Finish setup', enterpriseSetup: true },
        { label: 'Not now', dismiss: true }
      ]
    });
  }

  // Accept path: apply the audience, schedule, and logistics payloads together,
  // post one concise recap, then surface any real conflict for a decision.
  function runEnterpriseSetupNow() {
    const admin = window.ArcticEventAdmin;
    const integrations = window.ArcticIntegrations;
    if (!admin || !integrations || typeof admin.getEventContext !== 'function') {
      appendConflictFollowUp();
      return;
    }

    const context = admin.getEventContext();
    if (!context || !context.sessions || !context.sessions.length) {
      appendConflictFollowUp();
      return;
    }

    const audience = integrations.getAudience(context);
    const times = integrations.proposeTimes(context);
    const logistics = integrations.bookLogistics(context);

    if (typeof admin.applyEnterprise === 'function') {
      admin.applyEnterprise({ audience: audience.applyPayload });
      admin.applyEnterprise({ schedules: times.schedules });
      admin.applyEnterprise({ venues: logistics.venues });
    }

    const enrolled = (audience.applyPayload && audience.applyPayload.total) || 0;
    const regionCount = (audience.applyPayload && audience.applyPayload.segments && audience.applyPayload.segments.length) || 0;
    const sessionCount = context.sessions.length;
    const virtualCount = context.sessions.filter(function (session) {
      return session.venueMode === 'virtual' || !session.venueMode;
    }).length;
    const roomCount = sessionCount - virtualCount;

    const recap = [];
    recap.push('Enrolled ' + enrolled + ' learner' + (enrolled === 1 ? '' : 's')
      + (regionCount > 1 ? ' across ' + regionCount + ' regions' : '')
      + ' from Workday Learning and sized each session to headcount.');
    recap.push('Confirmed ' + sessionCount + ' session time' + (sessionCount === 1 ? '' : 's') + ' against Outlook calendars.');
    recap.push(
      (roomCount ? 'Reserved ' + roomCount + ' room' + (roomCount === 1 ? '' : 's') : '')
      + (roomCount && virtualCount ? ' and ' : '')
      + (virtualCount ? 'created ' + virtualCount + ' Zoom link' + (virtualCount === 1 ? '' : 's') : '')
      + '.'
    );

    // Sequence the conflict follow-up after the recap finishes streaming.
    appendAiMessage({
      intro: 'Done \u2014 I finished the enterprise setup in one pass.',
      heading: 'Setup complete',
      details: recap
    }, appendConflictFollowUp);
  }

  function createAiResponse(response) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-response';

    const p1 = document.createElement('p');
    p1.className = 'ai-response-text';
    p1.textContent = response && response.intro
      ? response.intro
      : 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';

    const divider = document.createElement('div');
    divider.className = 'ai-response-divider';

    const block2 = document.createElement('div');

    const heading = document.createElement('p');
    heading.className = 'ai-response-heading';
    heading.textContent = response && response.heading ? response.heading : 'Lorem ipsum summary';

    // An explicit details array (even empty) is respected; only fall back to
    // placeholder copy when details is entirely absent.
    const details = response && Array.isArray(response.details)
      ? response.details
      : [
        'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt.',
        'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet consectetur adipisci velit.'
      ];

    block2.appendChild(heading);
    details.forEach(function (detail, index) {
      const detailParagraph = document.createElement('p');
      detailParagraph.className = 'ai-response-text';
      detailParagraph.textContent = detail;

      if (index > 0) {
        detailParagraph.style.marginTop = '8px';
      }

      block2.appendChild(detailParagraph);
    });

    let structurePreview = null;
    if (response && response.structure) {
      structurePreview = createStructurePreview(response.structure);
      block2.appendChild(structurePreview);
    }

    if (response && response.requirementsForm) {
      block2.appendChild(createRequirementsForm(response.requirementsForm));
    }

    if (response && response.generatedCard) {
      block2.appendChild(createGeneratedCard(response.generatedCard));
    }

    if (response && response.actions && response.actions.length) {
      const actionsRow = document.createElement('div');
      actionsRow.className = 'ai-response-actions';
      const structureActionsRow = document.createElement('div');
      structureActionsRow.className = 'ai-response-actions ai-structure-actions';

      response.actions.forEach(function (action) {
        if (action.undoEdit) {
          actionsRow.appendChild(createActionButton(action.label, function (button) {
            const admin = window.ArcticEventAdmin;
            if (!admin || typeof admin.undoLastEdit !== 'function') return;
            const result = admin.undoLastEdit();
            button.disabled = true;
            appendAiMessage({ intro: result.message, details: [] });
          }));
          return;
        }

        if (action.nextStep) {
          const button = createActionButton(action.label, function (button) {
            // Capture the details edits and carry them into the sessions step so
            // the two agent turns compose into one plan at build time.
            const details = readStructureEdits(button.closest('.ai-response'));
            pendingProgramEdits = details
              ? { basics: details.basics, registration: details.registration }
              : null;
            button.disabled = true;
            if (action.nextStep === 'methodology-sessions') {
              appendAiMessage(buildMethodologySessionsMessage());
            }
          });
          (structurePreview ? structureActionsRow : actionsRow).appendChild(button);
          return;
        }

        if (action.buildPlan) {
          const button = createActionButton(action.label, function (button) {
            const cardEdits = readStructureEdits(button.closest('.ai-response'));
            // In the staged flow the details live in an earlier turn; merge them
            // with the session rows from this card. Non-staged cards carry all
            // sections themselves, so cardEdits is used as-is.
            const edits = pendingProgramEdits
              ? {
                basics: pendingProgramEdits.basics,
                registration: pendingProgramEdits.registration,
                sessions: cardEdits ? cardEdits.sessions : []
              }
              : cardEdits;
            openEventWorkspace({ plan: action.buildPlan, planEdits: edits, skipConfirm: true, viewMode: 'map' });
            button.disabled = true;
            offerEnterpriseSetup();
          });
          (structurePreview ? structureActionsRow : actionsRow).appendChild(button);
          return;
        }

        if (action.enterpriseSetup) {
          actionsRow.appendChild(createActionButton(action.label, function (button) {
            button.disabled = true;
            // Disable the sibling "Not now" so the offer resolves to one choice.
            const siblings = button.parentElement ? button.parentElement.querySelectorAll('button') : [];
            siblings.forEach(function (other) { other.disabled = true; });
            runEnterpriseSetupNow();
          }));
          return;
        }

        if (action.dismiss) {
          actionsRow.appendChild(createActionButton(action.label, function (button) {
            button.disabled = true;
            const siblings = button.parentElement ? button.parentElement.querySelectorAll('button') : [];
            siblings.forEach(function (other) { other.disabled = true; });
          }));
          return;
        }

        if (action.enterprise) {
          actionsRow.appendChild(createActionButton(action.label, function (button) {
            const admin = window.ArcticEventAdmin;
            if (admin && typeof admin.applyEnterprise === 'function') {
              admin.applyEnterprise(action.enterprise.payload);
            }
            button.disabled = true;
            if (typeof action.enterprise.next === 'function') action.enterprise.next();
          }));
          return;
        }

        if (typeof action.resolveConflictIndex === 'number') {
          actionsRow.appendChild(createActionButton(action.label, function (button) {
            const result = resolveCanvasConflict(action.resolveConflictIndex);
            if (!result) return;
            button.disabled = true;
            appendFixConfirmation(result);
          }));
          return;
        }

        if (action.proposalParams && workspaceEventView) {
          actionsRow.appendChild(createActionButton(action.label, function (button) {
            // Opens the editable review; the enterprise sync pass runs once the
            // human clicks Build (via the setEventBuiltHandler hook).
            openEventWorkspace({ proposalParams: action.proposalParams, skipConfirm: true, viewMode: 'map' });
            button.disabled = true;
          }));
          return;
        }

        if (action.generatedDraft && workspaceEventView) {
          actionsRow.appendChild(createActionButton(action.label, function (button) {
            openEventWorkspace({ generatedDraft: action.generatedDraft, skipConfirm: true, viewMode: 'map' });
            button.disabled = true;
            offerEnterpriseSetup();
          }));
          return;
        }

        if (action.openEventOverview && workspaceEventOverviewView) {
          actionsRow.appendChild(createActionButton(action.label, function () {
            openEventOverview(action.openEventOverview);
          }));
          return;
        }

        if (action.openEventWorkspace && workspaceEventView) {
          actionsRow.appendChild(createActionButton(action.label, function () {
            openEventWorkspace({
              template: action.template,
              basicsTitle: action.basicsTitle
            });
          }));
          return;
        }

        const link = document.createElement('a');
        link.className = 'home-task-action ai-response-action';
        link.href = action.href || '#';
        link.textContent = action.label;

        actionsRow.appendChild(link);
      });

      if (structureActionsRow.childElementCount && structurePreview) {
        structurePreview.appendChild(structureActionsRow);
      }
      if (actionsRow.childElementCount) block2.appendChild(actionsRow);
    }

    wrapper.appendChild(p1);
    wrapper.appendChild(divider);
    wrapper.appendChild(block2);

    return wrapper;
  }

  function createTitleFromPrompt(prompt) {
    const normalizedPrompt = prompt.replace(/\s+/g, ' ').trim();
    const maxTitleLength = 42;

    if (normalizedPrompt.length <= maxTitleLength) {
      return normalizedPrompt;
    }

    return `${normalizedPrompt.slice(0, maxTitleLength - 1).trim()}...`;
  }

  function resetChat() {
    messagesArea.innerHTML = '';
    input.textContent = '';
    shouldAutoScrollToBottom = true;
    updateArrow();
    setMessagesBottomClearance(true);
    updateMessagesTopSpacing();

    if (chatTitleContent) {
      chatTitleContent.textContent = DEFAULT_CHAT_TITLE;
    }
  }

  function loadDemoChat(chatId, options) {
    const demoChat = demoChats[chatId];
    if (!demoChat) return;

    const opts = options || {};

    messagesArea.innerHTML = '';
    input.textContent = '';
    shouldAutoScrollToBottom = true;

    if (chatTitleContent) {
      chatTitleContent.textContent = demoChat.title;
    }

    const lastIndex = demoChat.messages.length - 1;
    demoChat.messages.forEach(function (message, index) {
      if (message.type === 'user') {
        messagesArea.appendChild(createUserBubble(message.text));
        return;
      }

      // Live playback: stream the trailing AI reply (thinking -> typed text ->
      // revealed cards) so a proactive card feels like a real agent turn.
      // Prior turns and non-streamed entry points render instantly.
      if (opts.stream && index === lastIndex) {
        appendAiMessage(message, opts.onStreamComplete);
        return;
      }

      messagesArea.appendChild(createAiResponse(message));
    });

    updateArrow();
    setView('chat');
    setMessagesBottomClearance(true);
    scrollToBottom();
    updateMessagesTopSpacing();
  }

  function openEventWorkspace(options) {
    if (!workspaceEventView || !workspaceDefaultView) return;

    const opts = options || {};

    workspaceDefaultView.classList.add('is-hidden');
    workspaceDefaultView.setAttribute('aria-hidden', 'true');
    if (workspaceEventOverviewView) {
      workspaceEventOverviewView.classList.add('is-hidden');
      workspaceEventOverviewView.setAttribute('aria-hidden', 'true');
    }
    workspaceEventView.classList.remove('is-hidden');
    workspaceEventView.setAttribute('aria-hidden', 'false');

    if (workspacePanel) {
      workspacePanel.classList.add('is-event-workspace-active');
    }

    setView('chat');

    if (window.ArcticEventAdmin && typeof window.ArcticEventAdmin.openWorkspace === 'function') {
      window.ArcticEventAdmin.openWorkspace({
        newEvent: opts.newEvent,
        plan: opts.plan,
        planEdits: opts.planEdits,
        template: opts.template,
        basicsTitle: opts.basicsTitle,
        generatedDraft: opts.generatedDraft,
        proposalParams: opts.proposalParams,
        skipConfirm: opts.skipConfirm,
        viewMode: opts.viewMode
      });
    }

    window.requestAnimationFrame(function () {
      window.dispatchEvent(new Event('resize'));
    });
  }

  function closeEventWorkspace(options) {
    if (!workspaceEventView || !workspaceDefaultView) return;

    const opts = options || {};

    workspaceEventView.classList.add('is-hidden');
    workspaceEventView.setAttribute('aria-hidden', 'true');
    if (workspaceEventOverviewView) {
      workspaceEventOverviewView.classList.add('is-hidden');
      workspaceEventOverviewView.setAttribute('aria-hidden', 'true');
    }
    workspaceDefaultView.classList.remove('is-hidden');
    workspaceDefaultView.setAttribute('aria-hidden', 'false');

    if (workspacePanel) {
      workspacePanel.classList.remove('is-event-workspace-active');
    }

    if (!opts.preserveView) {
      setView('chat');
    }
  }

  window.openEventWorkspace = openEventWorkspace;
  window.closeEventWorkspace = closeEventWorkspace;

  // ---- Post-publish Event Overview ---------------------------------------
  // Publishing keeps the canvas mounted and posts a recap turn. From there the
  // human opens an Arctic-native Event Overview (read-only summary of the live
  // event) and can drop back into the editor at any time.
  function postPublishRecap(summary) {
    const info = summary || {};
    const details = [];
    if (info.whenText) details.push('First session ' + info.whenText + '.');

    const sync = info.sync;
    if (sync && sync.hasIntegrations) {
      const parts = [];
      if (sync.enrolled) parts.push(sync.enrolled + ' learner' + (sync.enrolled === 1 ? '' : 's') + ' enrolled');
      if (sync.invites) parts.push(sync.invites + ' calendar invite' + (sync.invites === 1 ? '' : 's') + ' sent');
      if (sync.rooms) parts.push(sync.rooms + ' room' + (sync.rooms === 1 ? '' : 's') + ' reserved');
      if (sync.videos) parts.push(sync.videos + ' Zoom link' + (sync.videos === 1 ? '' : 's') + ' created');
      if (parts.length) details.push('Enterprise sync: ' + parts.join(', ') + '.');
    }

    const sessionCount = info.sessionCount || 0;
    appendAiMessage({
      intro: '\u201c' + (info.title || 'Your event') + '\u201d is live \u2014 '
        + sessionCount + ' session' + (sessionCount === 1 ? '' : 's') + ' published.',
      heading: 'Event published',
      details: details,
      actions: [{ label: 'Open event', openEventOverview: info }]
    });
  }

  function openEventOverview(summary) {
    if (!workspaceEventOverviewView) return;
    renderEventOverview(summary);

    if (workspaceDefaultView) {
      workspaceDefaultView.classList.add('is-hidden');
      workspaceDefaultView.setAttribute('aria-hidden', 'true');
    }
    if (workspaceEventView) {
      workspaceEventView.classList.add('is-hidden');
      workspaceEventView.setAttribute('aria-hidden', 'true');
    }
    workspaceEventOverviewView.classList.remove('is-hidden');
    workspaceEventOverviewView.setAttribute('aria-hidden', 'false');
    if (workspacePanel) workspacePanel.classList.add('is-event-workspace-active');

    setView('chat');
  }

  function closeEventOverview() {
    if (!workspaceEventOverviewView) return;
    workspaceEventOverviewView.classList.add('is-hidden');
    workspaceEventOverviewView.setAttribute('aria-hidden', 'true');
    if (workspaceEventView) {
      workspaceEventView.classList.remove('is-hidden');
      workspaceEventView.setAttribute('aria-hidden', 'false');
    }
    if (workspacePanel) workspacePanel.classList.add('is-event-workspace-active');
    window.requestAnimationFrame(function () {
      window.dispatchEvent(new Event('resize'));
    });
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function formatSessionWhen(session) {
    const parts = [];
    if (session.date) parts.push(session.date);
    if (session.startTime) {
      parts.push(session.startTime + (session.endTime ? '\u2013' + session.endTime : ''));
    }
    if (session.timezone) parts.push(session.timezone);
    return parts.join(' \u00b7 ');
  }

  function renderEventOverview(summary) {
    if (!eventOverviewRoot) return;
    eventOverviewRoot.innerHTML = '';

    const info = summary || {};
    const admin = window.ArcticEventAdmin || {};
    const context = typeof admin.getEventContext === 'function' ? admin.getEventContext() : null;
    const program = typeof admin.getProgramSummary === 'function' ? admin.getProgramSummary() : null;
    const sync = (info.sync)
      || (typeof admin.getEnterpriseSyncSummary === 'function' ? admin.getEnterpriseSyncSummary() : null);

    const title = (context && context.eventTitle) || info.title || 'Untitled event';
    const sessions = (context && context.sessions) || [];
    const sessionCount = program ? program.sessionCount : (info.sessionCount || sessions.length);
    const instructorCount = program ? program.instructorCount : (info.instructorCount || 0);
    const registrationLabel = (program && program.registrationLabel) || 'Not set';

    // Header: title + published status.
    const header = el('div', 'event-overview-header');
    header.appendChild(el('h2', 'event-overview-title', title));
    const statusRow = el('div', 'event-overview-status');
    statusRow.appendChild(el('span', 'event-overview-pill', 'Published'));
    if (info.publishedAt) statusRow.appendChild(el('span', 'event-overview-meta', 'Published at ' + info.publishedAt));
    header.appendChild(statusRow);
    eventOverviewRoot.appendChild(header);

    // Stat tiles.
    const stats = el('div', 'event-overview-stats');
    const tiles = [
      { label: 'Sessions', value: String(sessionCount) },
      { label: 'Instructors', value: String(instructorCount) },
      { label: 'Registration', value: registrationLabel }
    ];
    if (sync && sync.enrolled) tiles.push({ label: 'Enrolled', value: String(sync.enrolled) });
    tiles.forEach(function (tile) {
      const tileEl = el('div', 'event-overview-stat');
      tileEl.appendChild(el('span', 'event-overview-stat-value', tile.value));
      tileEl.appendChild(el('span', 'event-overview-stat-label', tile.label));
      stats.appendChild(tileEl);
    });
    eventOverviewRoot.appendChild(stats);

    // Details.
    const spot = (context && context.eventSpot) || '';
    if (spot || info.whenText) {
      const detailList = el('dl', 'event-overview-details');
      if (spot) {
        detailList.appendChild(el('dt', 'event-overview-detail-key', 'Spot'));
        detailList.appendChild(el('dd', 'event-overview-detail-val', spot));
      }
      if (info.whenText) {
        detailList.appendChild(el('dt', 'event-overview-detail-key', 'Starts'));
        detailList.appendChild(el('dd', 'event-overview-detail-val', info.whenText));
      }
      eventOverviewRoot.appendChild(detailList);
    }

    // Sessions list.
    const sessionsSection = el('div', 'event-overview-section');
    sessionsSection.appendChild(el('h3', 'event-overview-section-title', 'Sessions'));
    const list = el('ul', 'event-overview-sessions');
    sessions.forEach(function (session, index) {
      const item = el('li', 'event-overview-session');
      const top = el('div', 'event-overview-session-top');
      top.appendChild(el('span', 'event-overview-session-index', String(index + 1)));
      top.appendChild(el('span', 'event-overview-session-title', session.title || 'Session ' + (index + 1)));
      item.appendChild(top);

      const when = formatSessionWhen(session);
      if (when) item.appendChild(el('p', 'event-overview-session-meta', when));

      const logistics = [];
      if (session.venueMode === 'virtual') logistics.push('Virtual');
      else if (session.venueMode) logistics.push('In person');
      if (session.location) logistics.push(session.location);
      if (session.capacity) logistics.push(session.capacity + ' seats');
      if (session.instructors && session.instructors.length) logistics.push(session.instructors.join(', '));
      if (logistics.length) item.appendChild(el('p', 'event-overview-session-meta', logistics.join(' \u00b7 ')));

      list.appendChild(item);
    });
    sessionsSection.appendChild(list);
    eventOverviewRoot.appendChild(sessionsSection);

    // Enterprise sync summary.
    if (sync && sync.hasIntegrations) {
      const syncBox = el('div', 'event-sync-summary');
      syncBox.appendChild(el('h3', null, 'Enterprise sync'));
      const syncList = el('ul', 'event-sync-list');
      if (sync.enrolled) {
        const li = el('li', 'event-sync-item is-enroll');
        li.appendChild(el('span', 'event-sync-provider', 'Workday Learning'));
        li.appendChild(document.createTextNode(' enrolled ' + sync.enrolled + ' learner' + (sync.enrolled === 1 ? '' : 's')));
        syncList.appendChild(li);
      }
      if (sync.invites) {
        const li = el('li', 'event-sync-item is-calendar');
        li.appendChild(el('span', 'event-sync-provider', 'Outlook'));
        li.appendChild(document.createTextNode(' sent ' + sync.invites + ' calendar invite' + (sync.invites === 1 ? '' : 's')));
        syncList.appendChild(li);
      }
      if (sync.rooms) {
        const li = el('li', 'event-sync-item is-room');
        li.appendChild(el('span', 'event-sync-provider', 'Facilities'));
        li.appendChild(document.createTextNode(' reserved ' + sync.rooms + ' room' + (sync.rooms === 1 ? '' : 's')));
        syncList.appendChild(li);
      }
      if (sync.videos) {
        const li = el('li', 'event-sync-item is-video');
        li.appendChild(el('span', 'event-sync-provider', 'Zoom'));
        li.appendChild(document.createTextNode(' created ' + sync.videos + ' meeting link' + (sync.videos === 1 ? '' : 's')));
        syncList.appendChild(li);
      }
      syncBox.appendChild(syncList);
      eventOverviewRoot.appendChild(syncBox);
    }
  }

  if (eventOverviewBackButton) {
    eventOverviewBackButton.addEventListener('click', closeEventOverview);
  }

  function isIndexPage() {
    const path = window.location.pathname;
    return /(?:^|\/)index\.html$/i.test(path) || path.endsWith('/') || path === '';
  }

  function closePageSwitcher() {
    const toggle = document.getElementById('page-switcher-toggle');
    const popover = document.getElementById('page-switcher-popover');
    if (!toggle || !popover) return;

    toggle.setAttribute('aria-expanded', 'false');
    popover.setAttribute('aria-hidden', 'true');
  }

  function goHome() {
    if (!isIndexPage() || window.location.hash) {
      window.location.assign('index.html');
      return;
    }

    if (isEditingTitle) {
      finishTitleEdit(true);
    }

    closeEventWorkspace({ preserveView: true });
    closePageSwitcher();
    setView('home');
  }

  window.goHome = goHome;

  function setView(nextView) {
    if (nextView !== 'list') {
      lastNonListView = nextView;
    }

    currentView = nextView;
    const isHomeView = currentView === 'home';
    const isChatView = currentView === 'chat';
    const isListView = currentView === 'list';

    if (homePanel) {
      homePanel.classList.toggle('is-hidden', !isHomeView);
      homePanel.setAttribute('aria-hidden', isHomeView ? 'false' : 'true');
    }

    if (chatPanel) {
      chatPanel.classList.toggle('is-hidden', !isChatView);
      chatPanel.setAttribute('aria-hidden', isChatView ? 'false' : 'true');
    }

    if (chatHistoryPanel) {
      chatHistoryPanel.classList.toggle('is-hidden', !isListView);
      chatHistoryPanel.setAttribute('aria-hidden', isListView ? 'false' : 'true');
    }

    if (chatListBtn) {
      chatListBtn.setAttribute('aria-label', isListView ? 'Close chat list' : 'Open chat list');
    }
    
    if (chatListIcon) {
      chatListIcon.src = isListView ? CHAT_LIST_ICON_SELECTED : CHAT_LIST_ICON_DEFAULT;
    }

    if (isListView && chatSearchInput) {
      chatSearchInput.focus();
      applyChatListFilter(chatSearchInput.value);
      return;
    }

    if (isChatView) {
      input.focus();
    }
  }

  function applyChatListFilter(query) {
    if (!chatListSections) return;

    const normalizedQuery = query.trim().toLowerCase();
    const sections = chatListSections.querySelectorAll('.chat-list-section');

    sections.forEach(function (section) {
      let hasVisibleItems = false;
      const items = section.querySelectorAll('.chat-list-item');

      items.forEach(function (item) {
        const itemText = item.textContent.toLowerCase();
        const isMatch = !normalizedQuery || itemText.includes(normalizedQuery);
        item.hidden = !isMatch;
        hasVisibleItems = hasVisibleItems || isMatch;
      });

      section.hidden = !hasVisibleItems;
    });
  }

  // Loose gate so event descriptions route to the generator while ordinary
  // questions still get the generic assistant reply.
  function looksLikeEventPrompt(text) {
    return /\b(event|session|sessions|onboarding|training|kickoff|kick-off|workshop|webinar|certification|summit|bootcamp|course|program|programme|offsite|off-site|conference|seminar|enablement|schedule|create)\b/i.test(text);
  }

  // Turns a typed description into a narrate-then-reveal turn: the AI summarizes
  // what it drafted, then the caller auto-opens the canvas (via the returned
  // `open`) so the reveal is the payoff. Edits happen on the canvas or by chat.
  function buildGeneratedEventResponse(text) {
    const admin = window.ArcticEventAdmin;
    if (!admin || typeof admin.previewFromText !== 'function' || !workspaceEventView) return null;

    const preview = admin.previewFromText(text);
    if (!preview || !preview.params) return null;
    if (typeof admin.buildDraftFromParams !== 'function') return null;

    // Default the Spot (a required Basics field with no prompt slot) so the
    // auto-built event stays publishable.
    const params = Object.assign({}, preview.params, { spot: preview.params.spot || 'Northwest Spot' });
    const result = admin.buildDraftFromParams(params);
    const draft = result && result.draft;
    if (!draft) return null;

    const title = params.title || 'New event';
    const count = Math.max(1, parseInt(params.sessionCount, 10) || 1);

    const response = {
      intro: 'I drafted "' + title + '" and I am opening it on the canvas now. Tweak anything from there, or just tell me what to change.',
      heading: 'Program drafted',
      details: [
        'Want me to finish setup? I\'ll enroll the audience and size each session to headcount, confirm times against calendars, and reserve rooms + Zoom in one pass.'
      ],
      generatedCard: { title: title, sessionCount: count },
      actions: [
        { label: 'Finish setup', enterpriseSetup: true },
        { label: 'Not now', dismiss: true }
      ]
    };

    return {
      response: response,
      open: function () {
        openEventWorkspace({ generatedDraft: draft, skipConfirm: true, viewMode: 'map' });
      }
    };
  }

  // Words that signal an edit command so unmatched-but-edit-shaped text can get
  // a graceful "not yet" instead of spawning a brand-new event.
  const EDIT_INTENT = /^\s*(swap|rename|add|remove|delete|duplicate|move|reorder|set|make|shift)\b/i;

  // Natural-language edits on the already-open event. Returns 'handled' when a
  // command ran, 'unknown-edit' when the text looks like an edit but matched no
  // pattern, or null when there is nothing to edit (falls through to today's
  // behavior). A small, reliable command set beats guessing.
  // Maps a spoken target ("all", "every session", "session 2", "APAC") to the
  // session ids it refers to, so one handler covers single and bulk edits.
  function resolveTargets(targetText, sessions) {
    const text = String(targetText || '').trim().replace(/[.!?,]+$/, '');
    if (!text) return [];
    if (/\b(all|every|each|both)\b/i.test(text)) {
      return sessions.map(function (s) { return s.id; });
    }
    const idxMatch = text.match(/session\s+(\d+)/i);
    if (idxMatch) {
      const i = parseInt(idxMatch[1], 10) - 1;
      return i >= 0 && i < sessions.length ? [sessions[i].id] : [];
    }
    const needle = text.toLowerCase();
    return sessions
      .filter(function (s) { return (s.title || '').toLowerCase().indexOf(needle) > -1; })
      .map(function (s) { return s.id; });
  }

  function maybeHandleEventEdit(text) {
    const admin = window.ArcticEventAdmin;
    if (!admin || typeof admin.applyEventEdit !== 'function' || typeof admin.getEventContext !== 'function') return null;
    if (!workspaceEventView || workspaceEventView.classList.contains('is-hidden')) return null;

    const context = admin.getEventContext();
    if (!context || !Array.isArray(context.sessions) || !context.sessions.length) return null;

    const sessions = context.sessions;
    function sessionIdAt(oneBasedIndex) {
      const idx = oneBasedIndex - 1;
      return idx >= 0 && idx < sessions.length ? sessions[idx].id : null;
    }
    function confirm(result) {
      const message = { intro: result.message, details: Array.isArray(result.changes) ? result.changes : [] };
      // Every reversible mutation gets a one-click Undo so no edit feels risky.
      if (result.undoable) {
        message.actions = [{ label: 'Undo', undoEdit: true }];
      }
      appendAiMessage(message);
      return 'handled';
    }

    let match;

    match = text.match(/\bset\s+(?:the\s+)?capacity\s+(?:to|=|:)?\s*(\d+)\s+(?:for|on)\s+(.+)$/i)
      || text.match(/\bset\s+(.+?)\s+capacity\s+(?:to|=|:)?\s*(\d+)\b/i);
    if (match) {
      const value = /^\d+$/.test(match[1]) ? match[1] : match[2];
      const targetText = /^\d+$/.test(match[1]) ? match[2] : match[1];
      const ids = resolveTargets(targetText, sessions);
      if (!ids.length) return confirm({ ok: false, message: 'I could not find those sessions.' });
      return confirm(admin.applyEventEdit({ type: 'set-capacity', sessionIds: ids, value: value }));
    }

    match = text.match(/\bmake\s+(.+?)\s+(virtual|in[-\s]?person|physical|online)\b/i);
    if (match) {
      const ids = resolveTargets(match[1], sessions);
      if (!ids.length) return confirm({ ok: false, message: 'I could not find those sessions.' });
      const mode = /virtual|online/i.test(match[2]) ? 'virtual' : 'physical';
      return confirm(admin.applyEventEdit({ type: 'set-venue-mode', sessionIds: ids, value: mode }));
    }

    match = text.match(/\badd\s+(.+?)\s+as\s+(?:an?\s+)?instructor\s+(?:to|on|for)\s+(.+)$/i);
    if (match) {
      const ids = resolveTargets(match[2], sessions);
      if (!ids.length) return confirm({ ok: false, message: 'I could not find those sessions.' });
      return confirm(admin.applyEventEdit({ type: 'add-instructor', sessionIds: ids, value: match[1].trim().replace(/^["']|["']$/g, '') }));
    }

    match = text.match(/\b(?:shift|move|push|pull)\s+(.+?)\s+(?:by\s+)?(\d+)\s+(day|days|week|weeks)\s+(earlier|later|forward|back|backward|backwards|ahead|up|sooner)\b/i);
    if (match) {
      const ids = resolveTargets(match[1], sessions);
      if (!ids.length) return confirm({ ok: false, message: 'I could not find those sessions.' });
      const unit = /week/i.test(match[3]) ? 7 : 1;
      const amount = parseInt(match[2], 10) * unit;
      const isEarlier = /earlier|back|backward|backwards|up|sooner/i.test(match[4]);
      const signed = isEarlier ? -amount : amount;
      const unitWord = /week/i.test(match[3]) ? 'week' : 'day';
      const plural = parseInt(match[2], 10) === 1 ? '' : 's';
      const phrase = `${match[2]} ${unitWord}${plural} ${isEarlier ? 'earlier' : 'later'}`;
      return confirm(admin.applyEventEdit({ type: 'shift-dates', sessionIds: ids, value: signed, phrase: phrase }));
    }

    match = text.match(/\bswap\s+session\s+(\d+)\s+(?:and|with|&)\s+session\s+(\d+)/i)
      || text.match(/\bswap\s+session\s+(\d+)\s+(?:and|with|&)\s+(\d+)/i);
    if (match) {
      const a = sessionIdAt(parseInt(match[1], 10));
      const b = sessionIdAt(parseInt(match[2], 10));
      if (!a || !b) return confirm({ ok: false, message: 'I could not find those sessions.' });
      return confirm(admin.applyEventEdit({ type: 'swap', sessionId: a, otherSessionId: b }));
    }

    match = text.match(/\brename\s+session\s+(\d+)\s+to\s+(.+)$/i);
    if (match) {
      const id = sessionIdAt(parseInt(match[1], 10));
      if (!id) return confirm({ ok: false, message: 'I could not find that session.' });
      return confirm(admin.applyEventEdit({ type: 'rename-session', sessionId: id, title: match[2].trim().replace(/^["']|["']$/g, '') }));
    }

    match = text.match(/\brename\s+(?:the\s+)?event\s+to\s+(.+)$/i);
    if (match) {
      return confirm(admin.applyEventEdit({ type: 'rename-event', title: match[1].trim().replace(/^["']|["']$/g, '') }));
    }

    if (/\badd\s+(?:a\s+|another\s+)?session\b/i.test(text)) {
      return confirm(admin.applyEventEdit({ type: 'add-session' }));
    }

    match = text.match(/\b(?:remove|delete)\s+session\s+(\d+)/i);
    if (match) {
      const id = sessionIdAt(parseInt(match[1], 10));
      if (!id) return confirm({ ok: false, message: 'I could not find that session.' });
      return confirm(admin.applyEventEdit({ type: 'remove-session', sessionId: id }));
    }

    match = text.match(/\bduplicate\s+session\s+(\d+)/i);
    if (match) {
      const id = sessionIdAt(parseInt(match[1], 10));
      if (!id) return confirm({ ok: false, message: 'I could not find that session.' });
      return confirm(admin.applyEventEdit({ type: 'duplicate-session', sessionId: id }));
    }

    return EDIT_INTENT.test(text) ? 'unknown-edit' : null;
  }

  function submitMessage(messageText) {
    const text = typeof messageText === 'string' ? messageText.trim() : input.textContent.trim();
    if (!text) return;

    // A node-click may have set a per-session edit hint; restore the generic
    // placeholder once a message is on its way so the next empty state is neutral.
    if (input) input.dataset.placeholder = DEFAULT_CHAT_PLACEHOLDER;

    messagesArea.appendChild(createUserBubble(text));

    const editResult = maybeHandleEventEdit(text);
    if (editResult === 'handled') {
      input.textContent = '';
      updateArrow();
      if (shouldAutoScrollToBottom) {
        setMessagesBottomClearance(true);
        scrollToBottom();
      }
      updateMessagesTopSpacing();
      return;
    }
    if (editResult === 'unknown-edit') {
      appendAiMessage({
        intro: 'I can\'t do that yet. I can swap, rename, add, remove, or duplicate sessions \u2014 for example, "swap session 2 and 3".',
        details: []
      });
      input.textContent = '';
      updateArrow();
      if (shouldAutoScrollToBottom) {
        setMessagesBottomClearance(true);
        scrollToBottom();
      }
      updateMessagesTopSpacing();
      return;
    }

    const generated = looksLikeEventPrompt(text) ? buildGeneratedEventResponse(text) : null;
    if (generated) {
      // Narrate, then auto-reveal the drafted event on the canvas.
      appendAiMessage(generated.response, generated.open);
    } else {
      appendAiMessage(undefined);
    }

    input.textContent = '';
    updateArrow();
  }

  function startChatFromHome() {
    if (!homeInput) return;

    const text = homeInput.textContent.trim();
    if (!text) return;

    if (isEditingTitle) {
      finishTitleEdit(true);
    }

    setView('chat');
    resetChat();
    if (chatTitleContent) {
      chatTitleContent.textContent = createTitleFromPrompt(text);
    }

    submitMessage(text);
    homeInput.textContent = '';
    updateHomeArrow();
    input.focus();
  }

  function selectAllText(element) {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function placeCaretAtEnd(element) {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // Read-mostly canvas: clicking a node in the chat-embedded map seeds a change
  // prompt in the composer instead of demanding form editing on the canvas, so
  // edits flow back through the conversation. Guarded to the map view and an
  // empty composer so it never clobbers what the admin is typing.
  function registerCanvasNodeRouting() {
    const admin = window.ArcticEventAdmin;
    if (!admin || typeof admin.setNodeFocusHandler !== 'function') return;
    // When the human builds from the proposal review, offer to finish the
    // enterprise setup on the freshly mapped event. The build click is itself the
    // "user acted" signal, so the offer appears immediately.
    if (typeof admin.setEventBuiltHandler === 'function') {
      admin.setEventBuiltHandler(function () { offerEnterpriseSetup(); });
    }
    // Publishing keeps the canvas open and hands the moment to the conversation:
    // a concise recap turn with an "Open event" action into the Event Overview.
    if (typeof admin.setEventPublishedHandler === 'function') {
      admin.setEventPublishedHandler(function (summary) { postPublishRecap(summary); });
    }
    admin.setNodeFocusHandler(function (info) {
      if (!info || !input) return;
      if (typeof admin.getViewMode === 'function' && admin.getViewMode() !== 'map') return;
      if (!workspaceEventView || workspaceEventView.classList.contains('is-hidden')) return;
      if (input.textContent.trim()) return;
      // Seed a greyed placeholder (via :empty::before) rather than real text, so
      // the hint guides without needing deletion and vanishes as soon as you type.
      input.textContent = '';
      input.dataset.placeholder = 'Update ' + info.title + '\u2026';
      setView('chat');
      updateArrow();
      input.focus();
      placeCaretAtEnd(input);
    });
  }

  function setTitleActionButtonState(isEditing) {
    if (!chatTitleActionIcon || !chatTitleEditBtn) return;

    chatTitleActionIcon.src = isEditing ? TITLE_SAVE_ICON : TITLE_EDIT_ICON;
    chatTitleEditBtn.setAttribute('aria-label', isEditing ? 'Save chat title' : 'Edit chat title');
  }

  function finishTitleEdit(saveTitle) {
    if (!isEditingTitle) return;

    const nextTitle = chatTitleContent.textContent.trim();
    chatTitleContent.contentEditable = 'false';
    chatTitleContent.classList.remove('is-editing');
    chatTitleContent.setAttribute('aria-readonly', 'true');
    isEditingTitle = false;
    setTitleActionButtonState(false);

    if (!saveTitle || !nextTitle) {
      chatTitleContent.textContent = titleBeforeEdit;
    } else {
      chatTitleContent.textContent = nextTitle;
    }
  }

  function startTitleEdit() {
    if (isEditingTitle || !chatTitleContent) return;

    titleBeforeEdit = chatTitleContent.textContent.trim();
    chatTitleContent.contentEditable = 'true';
    chatTitleContent.classList.add('is-editing');
    chatTitleContent.setAttribute('aria-readonly', 'false');
    isEditingTitle = true;
    setTitleActionButtonState(true);
    chatTitleContent.focus();
    selectAllText(chatTitleContent);
  }

  input.addEventListener('input', updateArrow);

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  });

  submitBtn.addEventListener('click', submitMessage);

  if (homeInput) {
    homeInput.addEventListener('input', updateHomeArrow);

    homeInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        startChatFromHome();
      }
    });
  }

  if (homeSubmitBtn) {
    homeSubmitBtn.addEventListener('click', startChatFromHome);
  }
  messagesArea.addEventListener('scroll', function () {
    syncAutoScrollState();
    updateMessagesTopSpacing();
  });

  window.addEventListener('resize', function () {
    if (shouldAutoScrollToBottom) {
      scrollToBottom();
    }

    updateMessagesTopSpacing();
  });

  syncAutoScrollState();
  updateMessagesTopSpacing();
  registerCanvasNodeRouting();

  if (chatTitleEditBtn && chatTitleContent) {
    chatTitleEditBtn.addEventListener('mousedown', function (e) {
      if (isEditingTitle) {
        // Keep focus on the title so button click can control save state.
        e.preventDefault();
      }
    });

    chatTitleEditBtn.addEventListener('click', function () {
      if (isEditingTitle) {
        finishTitleEdit(true);
        return;
      }

      startTitleEdit();
    });

    chatTitleContent.addEventListener('keydown', function (e) {
      if (!isEditingTitle) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        finishTitleEdit(true);
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        finishTitleEdit(false);
      }
    });

    chatTitleContent.addEventListener('blur', function () {
      finishTitleEdit(true);
    });
  }

  if (newChatBtn) {
    newChatBtn.addEventListener('click', function () {
      if (isEditingTitle) {
        finishTitleEdit(true);
      }

      setView('chat');
      resetChat();
      input.focus();
    });
  }

  if (chatListBtn) {
    chatListBtn.addEventListener('click', function () {
      if (isEditingTitle) {
        finishTitleEdit(true);
      }

      if (currentView === 'list') {
        setView(lastNonListView);
        return;
      }

      setView('list');
    });
  }

  if (profileHomeBtn) {
    profileHomeBtn.addEventListener('click', goHome);
  }

  if (pageSwitcherHomeLabel) {
    pageSwitcherHomeLabel.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      goHome();
    });
  }

  if (chatSearchInput) {
    chatSearchInput.addEventListener('input', function () {
      applyChatListFilter(chatSearchInput.value);
    });
  }

  // Selecting a destination in the page switcher swaps the preview panel rather
  // than navigating. Only Deals and Events have panels today; the other rail
  // items stay inert.
  function selectSwitcherTarget(target) {
    const navItems = document.querySelectorAll('.switcher-nav-item[data-switcher-target]');
    navItems.forEach(function (item) {
      const isSelected = item.dataset.switcherTarget === target;
      item.classList.toggle('is-selected', isSelected);
      if (isSelected) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });

    const panels = document.querySelectorAll('.switcher-panel[data-switcher-panel]');
    panels.forEach(function (panel) {
      panel.classList.toggle('is-hidden', panel.dataset.switcherPanel !== target);
    });
  }

  document.querySelectorAll('.switcher-nav-item[data-switcher-target]').forEach(function (item) {
    item.addEventListener('click', function () {
      const target = item.dataset.switcherTarget;
      if (!document.querySelector('.switcher-panel[data-switcher-panel="' + target + '"]')) return;
      selectSwitcherTarget(target);
    });
  });

  const eventsNewButton = document.getElementById('events-new-button');
  if (eventsNewButton) {
    eventsNewButton.addEventListener('click', function () {
      closePageSwitcher();
      openEventWorkspace({ newEvent: true });
    });
  }

  const eventsAiButton = document.getElementById('events-ai-button');
  if (eventsAiButton) {
    eventsAiButton.addEventListener('click', function () {
      closePageSwitcher();
      setView('home');
      const composer = document.getElementById('home-prompt-input');
      if (composer) composer.focus();
    });
  }

  if (draftProgramButton) {
    draftProgramButton.addEventListener('click', function () {
      if (isEditingTitle) {
        finishTitleEdit(true);
      }

      // Narrate first, then auto-open the drafted program on the canvas so the
      // reveal animation is the payoff rather than a form click-through.
      loadDemoChat('methodology-rollout', {
        stream: true,
        onStreamComplete: function () {
          openEventWorkspace({ plan: 'methodology-rollout', skipConfirm: true, viewMode: 'map' });
        }
      });
    });
  }

  if (chatListSections) {
    chatListSections.addEventListener('click', function (e) {
      const demoChatButton = e.target.closest('[data-demo-chat]');
      if (!demoChatButton) return;

      if (isEditingTitle) {
        finishTitleEdit(true);
      }

      loadDemoChat(demoChatButton.dataset.demoChat);
    });
  }

  if (window.location.hash === '#events-workspace' && workspaceEventView) {
    openEventWorkspace();
  }

  // Starts the story at the conversation, not the canvas, so the build step
  // stays a deliberate click for anyone exploring the prototype unguided.
  if (window.location.hash === '#methodology-rollout') {
    loadDemoChat('methodology-rollout');
    return;
  }

  if (window.location.hash === '#events-chat') {
    loadDemoChat('new-event-creation');
    openEventWorkspace({ basicsTitle: DEMO_EVENT_BASICS_TITLE, skipConfirm: true });
    return;
  }

  setView('home');
}());
