(function () {
  'use strict';

  var EVENT_EDITOR_SHELL_HTML = [
    '<section class="event-admin-panel">',
    '  <div class="event-admin-layout">',
    '    <aside class="event-admin-palette-panel" aria-label="Node palette">',
    '      <div class="event-admin-nav-title-row">',
    '        <h3>Event Nodes</h3>',
    '      </div>',
    '      <div class="event-admin-palette-list" id="event-node-palette" aria-label="Draggable node palette"></div>',
    '    </aside>',
    '    <section class="event-admin-canvas-panel">',
    '      <div class="event-admin-alert is-hidden" id="event-admin-alert"></div>',
    '      <section class="event-template-gallery" id="event-template-gallery" aria-label="Event templates">',
    '        <div class="event-template-gallery-header">',
    '          <h3>Start from a template</h3>',
    '          <button type="button" class="event-template-blank-link" id="event-start-blank-button">Start blank</button>',
    '        </div>',
    '        <div class="event-template-cards" id="event-template-cards"></div>',
    '      </section>',
    '      <div class="event-admin-main-header">',
    '        <h3>Canvas</h3>',
    '        <div class="event-canvas-toolbar">',
    '          <span class="event-admin-chip" id="event-admin-progress-chip">0 / 0 complete</span>',
    '          <button type="button" class="event-mini-button" id="event-canvas-zoom-out" aria-label="Zoom out">−</button>',
    '          <span class="event-admin-chip" id="event-canvas-zoom-label">100%</span>',
    '          <button type="button" class="event-mini-button" id="event-canvas-zoom-in" aria-label="Zoom in">+</button>',
    '          <button type="button" class="event-mini-button" id="event-canvas-fit-graph">Fit graph</button>',
    '          <button type="button" class="event-mini-button" id="event-canvas-zoom-reset">Reset view</button>',
    '          <span class="event-admin-canvas-meta" id="event-admin-meta">Synced locally · Not validated yet.</span>',
    '        </div>',
    '      </div>',
    '      <div class="event-admin-canvas" id="event-node-canvas" aria-label="Node canvas" tabindex="0">',
    '        <p class="event-admin-canvas-empty">Choose a template above or drop nodes here to begin.</p>',
    '      </div>',
    '    </section>',
    '    <section class="event-admin-main-panel">',
    '      <div class="event-admin-main-header">',
    '        <h3 id="event-node-title">Node properties</h3>',
    '        <span class="event-admin-chip" id="event-node-status-chip">Not started</span>',
    '      </div>',
    '      <form class="event-node-form" id="event-node-form" novalidate></form>',
    '    </section>',
    '  </div>',
    '</section>'
  ].join('');

  function mountEventEditorShell() {
    var root = document.getElementById('event-editor-root');
    if (!root || root.dataset.shellMounted === 'true') return;
    root.innerHTML = EVENT_EDITOR_SHELL_HTML;
    root.dataset.shellMounted = 'true';
  }

  window.mountEventEditorShell = mountEventEditorShell;
  mountEventEditorShell();
}());
