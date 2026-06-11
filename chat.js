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
  const eventsWorkspaceButton = document.getElementById('events-workspace-button');
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
            'Use the workspace link below, then complete Basics before moving through the canvas nodes.'
          ],
          actions: [
            { label: 'Open event workspace', openEventWorkspace: true, basicsTitle: DEMO_EVENT_BASICS_TITLE }
          ]
        }
      ]
    }
  };

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

    const details = response && response.details && response.details.length
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

    if (response && response.actions && response.actions.length) {
      const actionsRow = document.createElement('div');
      actionsRow.className = 'ai-response-actions';

      response.actions.forEach(function (action) {
        if (action.openEventWorkspace && workspaceEventView) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'home-task-action ai-response-action';
          button.textContent = action.label;
          button.addEventListener('click', function () {
            openEventWorkspace({
              template: action.template,
              basicsTitle: action.basicsTitle
            });
          });
          actionsRow.appendChild(button);
          return;
        }

        const link = document.createElement('a');
        link.className = 'home-task-action ai-response-action';
        link.href = action.href || '#';
        link.textContent = action.label;

        actionsRow.appendChild(link);
      });

      block2.appendChild(actionsRow);
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

  function loadDemoChat(chatId) {
    const demoChat = demoChats[chatId];
    if (!demoChat) return;

    messagesArea.innerHTML = '';
    input.textContent = '';
    shouldAutoScrollToBottom = true;

    if (chatTitleContent) {
      chatTitleContent.textContent = demoChat.title;
    }

    demoChat.messages.forEach(function (message) {
      if (message.type === 'user') {
        messagesArea.appendChild(createUserBubble(message.text));
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
    workspaceEventView.classList.remove('is-hidden');
    workspaceEventView.setAttribute('aria-hidden', 'false');

    if (workspacePanel) {
      workspacePanel.classList.add('is-event-workspace-active');
    }

    setView('chat');

    if (window.ArcticEventAdmin && typeof window.ArcticEventAdmin.openWorkspace === 'function') {
      window.ArcticEventAdmin.openWorkspace({
        template: opts.template,
        basicsTitle: opts.basicsTitle,
        skipConfirm: opts.skipConfirm
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

  function submitMessage(messageText) {
    const text = typeof messageText === 'string' ? messageText.trim() : input.textContent.trim();
    if (!text) return;

    messagesArea.appendChild(createUserBubble(text));
    messagesArea.appendChild(createAiResponse());

    input.textContent = '';
    updateArrow();

    if (shouldAutoScrollToBottom) {
      setMessagesBottomClearance(true);
      scrollToBottom();
    }

    updateMessagesTopSpacing();
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

  if (eventsWorkspaceButton) {
    eventsWorkspaceButton.addEventListener('click', function () {
      closePageSwitcher();
      openEventWorkspace();
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

  if (window.location.hash === '#events-chat') {
    loadDemoChat('new-event-creation');
    openEventWorkspace({ basicsTitle: DEMO_EVENT_BASICS_TITLE, skipConfirm: true });
    return;
  }

  setView('home');
}());
