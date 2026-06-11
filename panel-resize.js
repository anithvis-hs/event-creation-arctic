/**
 * App Side Panel Resize Functionality
 * Allows users to drag the right edge of the side panel to resize it
 */

(function() {
  'use strict';

  // Get elements
  const sidePanel = document.querySelector('.app-side-panel');
  const resizeHandle = document.querySelector('.panel-resize-handle');
  
  if (sidePanel && resizeHandle) {
    // Get computed style values
    const rootStyles = getComputedStyle(document.documentElement);
    const minWidthValue = rootStyles.getPropertyValue('--app-side-panel-min-width').trim() || '320px';
    const maxWidthValue = rootStyles.getPropertyValue('--app-side-panel-max-width').trim() || '50vw';

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    function getPanelConstraints() {
      const windowWidth = window.innerWidth;
      const minWidth = parseLength(minWidthValue, windowWidth);
      const maxWidth = Math.max(minWidth, parseLength(maxWidthValue, windowWidth));

      return { minWidth, maxWidth };
    }

    function parseLength(value, viewportWidth) {
      if (value.endsWith('vw')) {
        return (viewportWidth * parseFloat(value)) / 100;
      }

      if (value.endsWith('%')) {
        return (viewportWidth * parseFloat(value)) / 100;
      }

      return parseFloat(value) || 0;
    }

    /**
     * Start resizing
     */
    function startResize(e) {
      isResizing = true;
      startX = e.clientX;
      startWidth = sidePanel.offsetWidth;

      // Add resizing class for visual feedback
      sidePanel.classList.add('resizing');
      document.body.classList.add('resizing-panel');

      // Prevent text selection during resize
      e.preventDefault();
    }

    /**
     * Perform resize
     */
    function resize(e) {
      if (!isResizing) return;

      const deltaX = e.clientX - startX;
      const newWidth = startWidth + deltaX;
      const { minWidth, maxWidth } = getPanelConstraints();

      // Constrain width between min and max
      const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));

      // Update the CSS variable
      document.documentElement.style.setProperty('--app-side-panel-width', `${constrainedWidth}px`);
    }

    /**
     * Stop resizing
     */
    function stopResize() {
      if (!isResizing) return;

      isResizing = false;
      sidePanel.classList.remove('resizing');
      document.body.classList.remove('resizing-panel');
    }

    // Event listeners
    resizeHandle.addEventListener('mousedown', startResize);
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);

    // Handle double-click to reset to default width
    resizeHandle.addEventListener('dblclick', () => {
      document.documentElement.style.setProperty('--app-side-panel-width', 'var(--app-side-panel-default-width)');
    });

    // Update constraints on window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Ensure panel stays within min/max constraints after window resize
        const currentWidth = sidePanel.offsetWidth;
        const { minWidth, maxWidth } = getPanelConstraints();

        if (currentWidth > maxWidth) {
          document.documentElement.style.setProperty('--app-side-panel-width', `${maxWidth}px`);
        } else if (currentWidth < minWidth) {
          document.documentElement.style.setProperty('--app-side-panel-width', `${minWidth}px`);
        }
      }, 100);
    });
  } else {
    console.warn('Panel resize elements not found');
  }

  // Page switcher popover toggle
  const switcherToggle = document.querySelector('#page-switcher-toggle');
  const switcherPopover = document.querySelector('#page-switcher-popover');
  const omniboxTrigger = document.querySelector('#omnibox-trigger');
  const omniboxOverlay = document.querySelector('#omnibox-overlay');
  const omniboxInput = document.querySelector('#omnibox-input');
  const settingsButton = document.querySelector('#settings-button');
  const settingsMenu = document.querySelector('#settings-menu');
  const designModalOpen = document.querySelector('[data-design-modal-open]');
  const designModal = document.querySelector('#design-breakdown-modal');
  const designModalClose = document.querySelector('#design-breakdown-close');

  if (switcherToggle && switcherPopover) {
    function setSwitcherOpen(isOpen) {
      switcherToggle.setAttribute('aria-expanded', String(isOpen));
      switcherPopover.setAttribute('aria-hidden', String(!isOpen));
    }

    function isSwitcherOpen() {
      return switcherPopover.getAttribute('aria-hidden') === 'false';
    }

    switcherToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      setSwitcherOpen(!isSwitcherOpen());
    });

    document.addEventListener('click', (event) => {
      if (!isSwitcherOpen()) return;
      if (switcherPopover.contains(event.target) || switcherToggle.contains(event.target)) return;
      setSwitcherOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isSwitcherOpen()) {
        setSwitcherOpen(false);
      }
    });
  }

  // Prototype omnibox toggle
  if (omniboxTrigger && omniboxOverlay && omniboxInput) {
    function isOmniboxOpen() {
      return omniboxOverlay.getAttribute('aria-hidden') === 'false';
    }

    function closeOmnibox(restoreFocus = true) {
      if (!isOmniboxOpen()) return;

      omniboxOverlay.setAttribute('aria-hidden', 'true');
      omniboxTrigger.setAttribute('aria-expanded', 'false');
      omniboxInput.value = '';

      if (restoreFocus) {
        omniboxTrigger.focus();
      }
    }

    function openOmnibox() {
      if (switcherToggle && switcherPopover) {
        switcherToggle.setAttribute('aria-expanded', 'false');
        switcherPopover.setAttribute('aria-hidden', 'true');
      }

      omniboxOverlay.setAttribute('aria-hidden', 'false');
      omniboxTrigger.setAttribute('aria-expanded', 'true');
      omniboxInput.focus();
    }

    omniboxTrigger.addEventListener('click', (event) => {
      event.stopPropagation();

      if (isOmniboxOpen()) {
        closeOmnibox();
        return;
      }

      openOmnibox();
    });

    omniboxInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        closeOmnibox();
      }
    });

    omniboxOverlay.addEventListener('click', (event) => {
      if (event.target.matches('[data-omnibox-close]')) {
        closeOmnibox();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOmniboxOpen()) {
        closeOmnibox();
      }
    });
  }

  if (settingsButton && settingsMenu) {
    function isSettingsMenuOpen() {
      return settingsMenu.getAttribute('aria-hidden') === 'false';
    }

    function setSettingsMenuOpen(isOpen) {
      settingsButton.setAttribute('aria-expanded', String(isOpen));
      settingsMenu.setAttribute('aria-hidden', String(!isOpen));
    }

    settingsButton.addEventListener('click', (event) => {
      event.stopPropagation();
      setSettingsMenuOpen(!isSettingsMenuOpen());
    });

    settingsMenu.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    document.addEventListener('click', (event) => {
      if (!isSettingsMenuOpen()) return;
      if (settingsMenu.contains(event.target) || settingsButton.contains(event.target)) return;
      setSettingsMenuOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isSettingsMenuOpen()) {
        setSettingsMenuOpen(false);
        settingsButton.focus();
      }
    });
  }

  if (designModalOpen && designModal && designModalClose) {
    function isDesignModalOpen() {
      return designModal.getAttribute('aria-hidden') === 'false';
    }

    function openDesignModal() {
      if (settingsButton && settingsMenu) {
        settingsButton.setAttribute('aria-expanded', 'false');
        settingsMenu.setAttribute('aria-hidden', 'true');
      }

      designModal.setAttribute('aria-hidden', 'false');
      designModalClose.focus();
    }

    function closeDesignModal() {
      if (!isDesignModalOpen()) return;

      designModal.setAttribute('aria-hidden', 'true');
      settingsButton && settingsButton.focus();
    }

    designModalOpen.addEventListener('click', (event) => {
      event.preventDefault();
      openDesignModal();
    });

    designModalClose.addEventListener('click', closeDesignModal);

    designModal.addEventListener('click', (event) => {
      if (event.target.matches('[data-design-modal-close]')) {
        closeDesignModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isDesignModalOpen()) {
        closeDesignModal();
      }
    });
  }
})();
