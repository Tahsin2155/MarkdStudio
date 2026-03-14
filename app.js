(function () {
    'use strict';

    // ================================================================
    //  CONSTANTS
    // ================================================================

    const DB_NAME = 'markdown-studio';
    const DB_VERSION = 1;
    const STORE_NAME = 'documents';
    const SETTINGS_KEY = 'ms-settings';

    const DEFAULT_CONTENT = `# Welcome to MarkdStudio

MarkdStudio is your focused Markdown workspace for writing, previewing, and exporting polished documents.

## Why MarkdStudio?

- Fast live preview with elegant typography
- Multiple reading themes and appearance modes
- Built-in diagrams (Mermaid), math (KaTeX), and callouts
- Powerful code editor features in write mode
- Flexible export options for publishing workflows

## Quick Start

1. Start writing in the editor panel.
2. Use headings to build your table of contents.
3. Switch between Split, Write, Preview, and Inline modes.
4. Export when your document is ready.

## Shortcuts Snapshot

| Shortcut | Action |
|----------|--------|
| Ctrl+S | Save file |
| Ctrl+O | Open file |
| Ctrl+N | New document |
| Ctrl+F | Find |
| Ctrl+H | Replace |
| Ctrl+B | Bold |
| Ctrl+I | Italic |
| Ctrl+K | Link |

## Example Block

\`\`\`js
function greet(name) {
    return \`Hello, \${name}. Welcome to MarkdStudio.\`;
}
\`\`\`

## Task List

- [x] Create a draft
- [x] Review in preview mode
- [ ] Export and publish

---

Happy writing in MarkdStudio.
`;

    // ================================================================
    //  MARKDOWN ENGINE ALIASES
    // ================================================================

    var escapeHtml = MarkdEngine.escapeHtml;
    var hasAttributionLink = MarkdEngine.hasAttributionLink;
    var renderMarkdown = MarkdEngine.renderMarkdown;
    var postProcessPreview = MarkdEngine.postProcessPreview;
    var richHtmlToMarkdown = MarkdEngine.richHtmlToMarkdown;
    var configureMarked = MarkdEngine.configureMarked;
    var ATTRIBUTION_LINK = MarkdEngine.ATTRIBUTION_LINK;

    // ================================================================
    //  STATE
    // ================================================================

    const state = {
        documents: [],
        activeDocId: null,
        mode: 'split',
        theme: 'github',
        appearance: 'light',
        syncScroll: true,
        sidebarOpen: true,
        splitRatio: 0.5,
        typography: {
            fontFamily: '',
            fontSize: 16,
            lineHeight: 1.6,
            maxWidth: 900
        }
    };

    // Rendering helpers
    let renderTimeout = null;
    let autoSaveTimeout = null;
    let scrollSyncSource = null;
    let dbPromise = null;
    let tocScrollContainer = null;
    let tocScrollHandler = null;
    let layoutRefreshFrame = null;
    let lastPreviewState = null;

    // DOM references (set in init)
    let editorEl, previewPanelEl, previewContentEl, tocNavEl, tabsContainerEl, docStatsEl;
    let tocSidebarEl, mainContentEl, inlineEditorEl, appEl;
    let cmEditor = null;
    let inlineDocEditorEl = null;
    let inlineDocSyncing = false;
    let inlineDocActiveDocId = null;

    // ================================================================
    //  UTILITY
    // ================================================================

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
    }

    function debounce(fn, ms) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    function showStatus(msg) {
        let el = document.querySelector('.save-status');
        if (!el) {
            el = document.createElement('div');
            el.className = 'save-status';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 1800);
    }

    function hasUnsavedDocuments() {
        return state.documents.some(function (doc) { return !!doc.isDirty; });
    }

    function isMobileViewport() {
        return window.matchMedia('(max-width: 640px)').matches;
    }

    function applyTOCVisibility() {
        if (!tocSidebarEl) return;

        var tocBtn = document.getElementById('toc-toggle-btn');
        var open = !!state.sidebarOpen;

        if (isMobileViewport()) {
            tocSidebarEl.classList.remove('hidden');
            tocSidebarEl.classList.toggle('mobile-open', open);
        } else {
            tocSidebarEl.classList.remove('mobile-open');
            tocSidebarEl.classList.toggle('hidden', !open);
        }

        if (tocBtn) tocBtn.classList.toggle('active', open);
    }

    function setupUnloadGuard() {
        window.addEventListener('beforeunload', function (e) {
            if (!hasUnsavedDocuments()) return;
            e.preventDefault();
            e.returnValue = '';
        });
    }

    function getDocStats(text) {
        const safeText = text || '';
        const words = (safeText.match(/\S+/g) || []).length;
        const chars = safeText.length;
        const readingMinutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / 200));
        return { words: words, chars: chars, readingMinutes: readingMinutes };
    }

    function updateDocStats() {
        if (!docStatsEl) return;
        const doc = getActiveDocument();
        const stats = getDocStats(doc ? doc.content : '');
        const readPart = stats.readingMinutes > 0 ? (stats.readingMinutes + ' min read') : 'No reading time';
        docStatsEl.textContent = stats.words.toLocaleString() + ' words · ' + stats.chars.toLocaleString() + ' chars · ' + readPart;
    }

    function getEmptyPreviewHTML() {
        return '<section class="empty-preview">'
            + '<h3>Start writing</h3>'
            + '<p>Your preview will appear here as you type.</p>'
            + '<ul>'
            + '<li>Use <strong>Ctrl+B</strong> for bold, <strong>Ctrl+I</strong> for italic, and <strong>Ctrl+K</strong> for links.</li>'
            + '<li>Try headings like <code># Project Notes</code> to build a table of contents.</li>'
            + '<li>Switch themes from the top toolbar to match your publishing style.</li>'
            + '</ul>'
            + '</section>';
    }

    function isEditorFocused() {
        return !!(cmEditor ? cmEditor.hasFocus() : (document.activeElement === editorEl));
    }

    function getEditorValue() {
        return cmEditor ? cmEditor.getValue() : (editorEl ? editorEl.value : '');
    }

    function setEditorValue(value) {
        var safeValue = value || '';
        if (cmEditor) {
            if (cmEditor.getValue() !== safeValue) cmEditor.setValue(safeValue);
            if (editorEl) editorEl.value = safeValue;
            return;
        }
        if (editorEl) editorEl.value = safeValue;
    }

    function focusEditor() {
        if (cmEditor) cmEditor.focus();
        else if (editorEl) editorEl.focus();
    }

    function setupCodeEditor() {
        if (!editorEl || typeof CodeMirror === 'undefined' || cmEditor) return;

        cmEditor = CodeMirror.fromTextArea(editorEl, {
            mode: 'markdown',
            lineNumbers: true,
            lineWrapping: true,
            theme: 'default',
            smartIndent: true,
            indentUnit: 4,
            tabSize: 4,
            indentWithTabs: false,
            autoCloseBrackets: true,
            matchBrackets: true,
            styleActiveLine: true,
            // Keep DOM size bounded for better performance on large documents.
            viewportMargin: 30,
            extraKeys: {
                'Ctrl-F': 'findPersistent',
                'Cmd-F': 'findPersistent',
                'Ctrl-H': 'replace',
                'Cmd-Alt-F': 'replace',
                'Ctrl-G': 'findNext',
                'Shift-Ctrl-G': 'findPrev',
                'Cmd-G': 'findNext',
                'Shift-Cmd-G': 'findPrev',
                'Ctrl-/': 'toggleComment',
                'Cmd-/': 'toggleComment',
                'Alt-Click': false
            }
        });

        cmEditor.on('change', function (cm) {
            if (editorEl) editorEl.value = cm.getValue();
            updatePreview();
        });

        // Auto-close markdown code fences when user types ```
        cmEditor.on('inputRead', function (cm, change) {
            if (!change || !change.text || change.text.length !== 1) return;
            if (change.text[0] !== '`') return;

            var cursor = cm.getCursor();
            var line = cm.getLine(cursor.line);
            var before = line.slice(0, cursor.ch);
            if (!/```$/.test(before)) return;

            var after = line.slice(cursor.ch);
            if (after.trim() !== '') return;

            cm.replaceRange('\n\n```', cursor);
            cm.setCursor({ line: cursor.line + 1, ch: 0 });
        });
    }

    // ================================================================
    //  STORAGE  (IndexedDB)
    // ================================================================

    function openDB() {
        if (dbPromise) return dbPromise;

        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
            req.onsuccess = () => {
                const db = req.result;
                db.onversionchange = function () {
                    db.close();
                    dbPromise = null;
                };
                resolve(db);
            };
            req.onerror = () => {
                dbPromise = null;
                reject(req.error);
            };
        });

        return dbPromise;
    }

    async function dbGetAll() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function dbPut(doc) {
        try {
            const db = await openDB();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.put(doc);
                req.onsuccess = () => resolve(true);
                req.onerror = () => {
                    console.warn('IndexedDB put failed:', req.error);
                    resolve(false);
                };
            });
        } catch (e) {
            console.warn('IndexedDB unavailable for put:', e);
            return false;
        }
    }

    async function dbDelete(id) {
        try {
            const db = await openDB();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.delete(id);
                req.onsuccess = () => resolve(true);
                req.onerror = () => {
                    console.warn('IndexedDB delete failed:', req.error);
                    resolve(false);
                };
            });
        } catch (e) {
            console.warn('IndexedDB unavailable for delete:', e);
            return false;
        }
    }

    function loadSettings() {
        try {
            return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
        } catch { return {}; }
    }

    function saveSettings() {
        const data = {
            mode: state.mode,
            theme: state.theme,
            appearance: state.appearance,
            syncScroll: state.syncScroll,
            sidebarOpen: state.sidebarOpen,
            splitRatio: state.splitRatio,
            typography: state.typography,
            activeDocId: state.activeDocId,
            openDocIds: state.documents.map(d => d.id)
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
    }

    // ================================================================
    //  TABLE OF CONTENTS
    // ================================================================

    function getTOCScrollContainer() {
        return state.mode === 'inline' ? inlineEditorEl : previewPanelEl;
    }

    function getTOCHeadingContainer() {
        return state.mode === 'inline' ? inlineEditorEl : previewContentEl;
    }

    function updateActiveTOCItem(container) {
        const headingContainer = getTOCHeadingContainer();
        if (!container || !headingContainer || !tocNavEl) return;

        const headings = headingContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const tocItems = tocNavEl.querySelectorAll('.toc-item');
        if (!headings.length || !tocItems.length) return;

        const containerRect = container.getBoundingClientRect();
        const threshold = containerRect.top + 84;
        let activeIdx = 0;

        headings.forEach(function (h, i) {
            const headingTop = h.getBoundingClientRect().top;
            if (headingTop <= threshold) activeIdx = i;
        });

        tocItems.forEach(function (item, i) {
            const isActive = i === activeIdx;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-current', isActive ? 'true' : 'false');
        });
    }

    function updateTOC() {
        if (!tocNavEl) return;
        tocNavEl.innerHTML = '';

        const headingContainer = getTOCHeadingContainer();
        if (!headingContainer) return;

        const headings = headingContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings.forEach(function (h) {
            const level = parseInt(h.tagName.charAt(1));
            const btn = document.createElement('button');
            btn.className = 'toc-item';
            btn.setAttribute('data-level', level);
            btn.setAttribute('aria-current', 'false');
            btn.textContent = h.textContent;
            btn.addEventListener('click', function () {
                const scrollContainer = getTOCScrollContainer();
                if (!scrollContainer) return;

                const containerRect = scrollContainer.getBoundingClientRect();
                const headingRect = h.getBoundingClientRect();
                const targetTop = scrollContainer.scrollTop + (headingRect.top - containerRect.top) - 20;
                scrollContainer.scrollTo({
                    top: Math.max(0, targetTop),
                    behavior: 'smooth'
                });
            });
            tocNavEl.appendChild(btn);
        });

        const scrollContainer = getTOCScrollContainer();
        requestAnimationFrame(function () {
            updateActiveTOCItem(scrollContainer);
        });
    }

    function getVisibleTOCWidth() {
        if (!tocSidebarEl) return 0;
        if (!state.sidebarOpen) return 0;
        if (isMobileViewport()) return 0;
        // Use the CSS-declared width so layout isn't affected by transition timing.
        return window.matchMedia('(max-width: 900px)').matches ? 200 : 240;
    }

    function normalizeSplitPanelLayout() {
        if (!mainContentEl) return;
        if (state.mode !== 'split') return;

        var editorPanel = document.getElementById('editor-panel');
        var previewPanel = document.getElementById('preview-panel');
        if (!editorPanel || !previewPanel) return;

        var r = Math.max(0.2, Math.min(0.8, state.splitRatio || 0.5));
        editorPanel.style.flex = r + ' 1 0px';
        previewPanel.style.flex = (1 - r) + ' 1 0px';
    }

    function refreshLayoutSoon(rebuildTOC) {
        if (rebuildTOC === undefined) rebuildTOC = true;
        if (layoutRefreshFrame) cancelAnimationFrame(layoutRefreshFrame);

        layoutRefreshFrame = requestAnimationFrame(function () {
            normalizeSplitPanelLayout();

            if (cmEditor) {
                cmEditor.refresh();
            }

            if (rebuildTOC) {
                setupTOCTracking();

                requestAnimationFrame(function () {
                    updateTOC();
                });
            }

            layoutRefreshFrame = null;
        });
    }

    // Scroll tracking for TOC
    function setupTOCTracking() {
        const container = getTOCScrollContainer();
        if (!container) return;

        if (tocScrollContainer && tocScrollHandler) {
            tocScrollContainer.removeEventListener('scroll', tocScrollHandler);
        }

        tocScrollHandler = debounce(function () {
            updateActiveTOCItem(container);
        }, 100);

        container.addEventListener('scroll', tocScrollHandler, { passive: true });
        tocScrollContainer = container;

        // Sync initial state without waiting for first user scroll.
        requestAnimationFrame(function () {
            updateActiveTOCItem(container);
        });
    }

    // ================================================================
    //  TABS
    // ================================================================

    function renderTabs() {
        if (!tabsContainerEl) return;
        tabsContainerEl.innerHTML = '';
        state.documents.forEach(function (doc) {
            var tab = document.createElement('div');
            tab.className = 'tab' + (doc.id === state.activeDocId ? ' active' : '');
            tab.setAttribute('data-doc-id', doc.id);

            var title = document.createElement('span');
            title.className = 'tab-title';
            title.textContent = doc.title || 'Untitled';
            tab.appendChild(title);

            if (doc.isDirty) {
                var modified = document.createElement('span');
                modified.className = 'tab-modified';
                modified.title = 'Unsaved local changes';
                tab.appendChild(modified);
            }

            var close = document.createElement('button');
            close.className = 'tab-close';
            close.innerHTML = '&times;';
            close.title = 'Close';
            close.addEventListener('click', function (e) {
                e.stopPropagation();
                closeDocument(doc.id);
            });
            tab.appendChild(close);

            tab.addEventListener('click', function () {
                switchToDocument(doc.id);
            });

            tabsContainerEl.appendChild(tab);
        });
    }

    function getActiveDocument() {
        return state.documents.find(function (d) { return d.id === state.activeDocId; });
    }

    function createDocument(title, content, fileHandle) {
        var options = arguments[3] || {};
        var doc = {
            id: generateId(),
            title: title || 'Untitled.md',
            content: content !== undefined ? content : '',
            lastModified: Date.now(),
            fileHandle: fileHandle || null,
            isDirty: false,
            lockTitle: !!options.lockTitle
        };
        state.documents.push(doc);
        dbPut({ id: doc.id, title: doc.title, content: doc.content, lastModified: doc.lastModified, lockTitle: doc.lockTitle });
        switchToDocument(doc.id);
        return doc;
    }

    function switchToDocument(docId) {
        // Save current editor content
        var current = getActiveDocument();
        if (current && editorEl) {
            current.content = getEditorValue();
            current.lastModified = Date.now();
            current.isDirty = false;
            dbPut({ id: current.id, title: current.title, content: current.content, lastModified: current.lastModified, lockTitle: current.lockTitle });
        }

        state.activeDocId = docId;
        var doc = getActiveDocument();
        if (doc && editorEl) {
            setEditorValue(doc.content);
            updatePreview();
            updateDocumentTitle();
            updateDocStats();
        }
        renderTabs();
        saveSettings();
    }

    function closeDocument(docId) {
        if (state.documents.length <= 1) return; // keep at least one
        var idx = state.documents.findIndex(function (d) { return d.id === docId; });
        if (idx === -1) return;

        var closingDoc = state.documents[idx];
        if (closingDoc.isDirty) {
            var shouldClose = window.confirm('This document has unsaved changes. Close it anyway?');
            if (!shouldClose) return;
        }

        state.documents.splice(idx, 1);
        dbDelete(docId);

        if (state.activeDocId === docId) {
            var newIdx = Math.min(idx, state.documents.length - 1);
            switchToDocument(state.documents[newIdx].id);
        }
        renderTabs();
        saveSettings();
    }

    function updateDocumentTitle() {
        var doc = getActiveDocument();
        if (!doc) return;
        // Extract title from first heading
        var match = doc.content.match(/^#\s+(.+)$/m);
        if (match && !doc.lockTitle) {
            doc.title = match[1].replace(/[*_`~]/g, '').trim().substring(0, 60);
            if (!doc.title.endsWith('.md')) doc.title += '.md';
        }
        document.title = doc.title + ' — MarkdStudio';
    }

    // ================================================================
    //  PREVIEW
    // ================================================================

    function updatePreview(options) {
        options = options || {};
        var forceRender = !!options.forceRender;

        clearTimeout(renderTimeout);
        renderTimeout = setTimeout(function () {
            var doc = getActiveDocument();
            if (!doc) return;
            var source = editorEl ? getEditorValue() : doc.content;
            var previousContent = doc.content || '';

            doc.content = source;
            if (source !== previousContent) {
                var becameDirty = !doc.isDirty;
                doc.isDirty = true;
                if (becameDirty) renderTabs();
            }

            var html = renderMarkdown(source, { hideAttributionInApp: true });
            var isEmpty = !source.trim();
            var shouldReusePreview = !forceRender
                && lastPreviewState
                && lastPreviewState.docId === doc.id
                && lastPreviewState.mode === state.mode
                && lastPreviewState.source === source
                && lastPreviewState.html === html
                && lastPreviewState.isEmpty === isEmpty;

            if (state.mode === 'inline') {
                renderInlineMode(source, html, { forceRender: forceRender || !shouldReusePreview });
            } else {
                if (!shouldReusePreview) {
                    if (isEmpty) {
                        previewContentEl.innerHTML = getEmptyPreviewHTML();
                    } else {
                        previewContentEl.innerHTML = html;
                        postProcessPreview(previewContentEl);
                    }
                }
            }

            if (!shouldReusePreview || !lastPreviewState || lastPreviewState.mode !== state.mode) {
                updateTOC();
            }

            lastPreviewState = {
                docId: doc.id,
                mode: state.mode,
                source: source,
                html: html,
                isEmpty: isEmpty
            };

            updateDocumentTitle();
            updateDocStats();
            scheduleAutoSave();
        }, 80);
    }

    function scheduleAutoSave() {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(function () {
            var doc = getActiveDocument();
            if (doc && doc.isDirty) {
                doc.lastModified = Date.now();
                dbPut({ id: doc.id, title: doc.title, content: doc.content, lastModified: doc.lastModified, lockTitle: doc.lockTitle }).then(function (ok) {
                    if (ok && doc.isDirty) {
                        doc.isDirty = false;
                        renderTabs();
                    } else if (!ok) {
                        showStatus('Autosave failed. Changes kept locally.');
                    }
                });
            }
        }, 1000);
    }

    function scheduleManualSaveState(doc) {
        if (!doc) return;
        dbPut({ id: doc.id, title: doc.title, content: doc.content, lastModified: doc.lastModified, lockTitle: doc.lockTitle }).then(function (ok) {
            if (ok && doc.isDirty) {
                doc.isDirty = false;
                renderTabs();
            }
        });
    }

    // ================================================================
    //  SYNC SCROLL
    // ================================================================

    function syncScroll(source, target) {
        if (!state.syncScroll) return;
        if (scrollSyncSource === target) return;
        scrollSyncSource = source;

        var maxSource = source.scrollHeight - source.clientHeight;
        var maxTarget = target.scrollHeight - target.clientHeight;
        if (maxSource <= 0 || maxTarget <= 0) { scrollSyncSource = null; return; }

        var ratio = source.scrollTop / maxSource;
        target.scrollTop = ratio * maxTarget;

        requestAnimationFrame(function () { scrollSyncSource = null; });
    }

    function setupSyncScroll() {
        var sourceScroller = cmEditor ? cmEditor.getScrollerElement() : editorEl;
        if (sourceScroller) {
            sourceScroller.addEventListener('scroll', function () {
                if (state.mode === 'split' && state.syncScroll) {
                    syncScroll(sourceScroller, previewPanelEl);
                }
            }, { passive: true });
        }

        previewPanelEl.addEventListener('scroll', function () {
            if (state.mode === 'split' && state.syncScroll) {
                if (cmEditor) {
                    var cmScroller = cmEditor.getScrollerElement();
                    syncScroll(previewPanelEl, cmScroller);
                } else {
                    syncScroll(previewPanelEl, editorEl);
                }
            }
        }, { passive: true });
    }

    // ================================================================
    //  PANEL DIVIDER (resize)
    // ================================================================

    function setupDivider() {
        var divider = document.getElementById('panel-divider');
        if (!divider) return;

        var editorPanel = document.getElementById('editor-panel');
        var previewPanel = document.getElementById('preview-panel');
        if (!editorPanel || !previewPanel) return;

        var isDragging = false;
        var startX = 0;
        var startEditorWidth = 0;
        var activeWidth = 0;

        divider.addEventListener('mousedown', function (e) {
            isDragging = true;
            startX = e.clientX;
            startEditorWidth = editorPanel.getBoundingClientRect().width;
            activeWidth = mainContentEl.getBoundingClientRect().width - getVisibleTOCWidth() - 4;
            divider.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', function (e) {
            if (!isDragging) return;
            var dx = e.clientX - startX;
            var available = activeWidth > 0 ? activeWidth : (mainContentEl.getBoundingClientRect().width - getVisibleTOCWidth() - 4);
            if (available <= 40) return;
            var newEditorWidth = startEditorWidth + dx;
            var ratio = Math.max(0.2, Math.min(0.8, newEditorWidth / available));
            state.splitRatio = ratio;

            editorPanel.style.flex = ratio + ' 1 0px';
            previewPanel.style.flex = (1 - ratio) + ' 1 0px';

            refreshLayoutSoon(false);
        });

        document.addEventListener('mouseup', function () {
            if (!isDragging) return;
            isDragging = false;
            divider.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            refreshLayoutSoon();
            saveSettings();
        });
    }

    // ================================================================
    //  INLINE MODE
    // ================================================================

    function renderInlineMode(source, renderedHtml, options) {
        options = options || {};
        var forceRender = !!options.forceRender;

        if (!inlineEditorEl) return;

        if (!inlineEditorEl.querySelector('.inline-doc-shell')) {
            inlineEditorEl.innerHTML = '';

            var shell = document.createElement('div');
            shell.className = 'inline-doc-shell';

            var toolbar = document.createElement('div');
            toolbar.className = 'inline-editor-toolbar inline-rich-toolbar';
            toolbar.innerHTML = '' +
                '<button type="button" class="inline-tool-btn" data-cmd="undo" title="Undo (Ctrl+Z)">Undo</button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="redo" title="Redo (Ctrl+Y)">Redo</button>' +
                '<span class="inline-tool-sep"></span>' +
                '<button type="button" class="inline-tool-btn" data-cmd="bold" title="Bold (Ctrl+B)"><strong>B</strong></button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="italic" title="Italic (Ctrl+I)"><em>I</em></button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="underline" title="Underline"><u>U</u></button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="strike" title="Strikethrough">S</button>' +
                '<span class="inline-tool-sep"></span>' +
                '<button type="button" class="inline-tool-btn" data-cmd="h1" title="Heading 1">H1</button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="h2" title="Heading 2">H2</button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="h3" title="Heading 3">H3</button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="p" title="Paragraph">P</button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="quote" title="Quote">Quote</button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="hr" title="Horizontal rule">HR</button>' +
                '<span class="inline-tool-sep"></span>' +
                '<button type="button" class="inline-tool-btn" data-cmd="ul" title="Bulleted list">List</button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="ol" title="Numbered list">1.</button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="task" title="Task list">Task</button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="indent" title="Indent">-></button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="outdent" title="Outdent"><-</button>' +
                '<span class="inline-tool-sep"></span>' +
                '<button type="button" class="inline-tool-btn" data-cmd="code" title="Inline code">Code</button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="codeblock" title="Code block">{ }</button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="link" title="Link (Ctrl+K)">Link</button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="unlink" title="Remove link">Unlink</button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="image" title="Image">Image</button>' +
                '<button type="button" class="inline-tool-btn" data-cmd="table" title="Table">Table</button>' +
                '<span class="inline-tool-sep"></span>' +
                '<button type="button" class="inline-tool-btn" data-cmd="clear" title="Clear formatting">Clear</button>' +
                '<span class="inline-tool-hint">Markdown sync auto-on</span>';

            var editable = document.createElement('div');
            editable.className = 'inline-block-editor inline-doc-editor';
            editable.setAttribute('contenteditable', 'true');
            editable.setAttribute('spellcheck', 'true');

            shell.appendChild(toolbar);
            shell.appendChild(editable);
            inlineEditorEl.appendChild(shell);

            inlineDocEditorEl = editable;

            function safeCommandState(cmd) {
                try { return document.queryCommandState(cmd); } catch (e) { return false; }
            }

            function safeFormatBlockValue() {
                try {
                    var value = document.queryCommandValue('formatBlock');
                    return (value || '').toString().replace(/[<>]/g, '').toLowerCase();
                } catch (e) {
                    return '';
                }
            }

            function updateInlineToolbarState() {
                if (!inlineDocEditorEl) return;
                if (!inlineDocEditorEl.contains(document.activeElement)) return;

                var formatValue = safeFormatBlockValue();
                toolbar.querySelectorAll('.inline-tool-btn').forEach(function (btn) {
                    var cmd = btn.getAttribute('data-cmd');
                    var active = false;
                    if (cmd === 'bold') active = safeCommandState('bold');
                    if (cmd === 'italic') active = safeCommandState('italic');
                    if (cmd === 'underline') active = safeCommandState('underline');
                    if (cmd === 'strike') active = safeCommandState('strikeThrough');
                    if (cmd === 'ul') active = safeCommandState('insertUnorderedList');
                    if (cmd === 'ol') active = safeCommandState('insertOrderedList');
                    if (cmd === 'quote') active = formatValue === 'blockquote';
                    if (cmd === 'h1') active = formatValue === 'h1';
                    if (cmd === 'h2') active = formatValue === 'h2';
                    if (cmd === 'h3') active = formatValue === 'h3';
                    if (cmd === 'p') active = formatValue === 'p' || formatValue === 'div';
                    btn.classList.toggle('is-active', active);
                });
            }

            function insertHtmlAtCursor(html) {
                document.execCommand('insertHTML', false, html);
            }

            function applyInlineCommand(cmd) {
                if (!inlineDocEditorEl) return;
                inlineDocEditorEl.focus();

                if (cmd === 'h1' || cmd === 'h2' || cmd === 'h3' || cmd === 'p') {
                    document.execCommand('formatBlock', false, cmd);
                } else if (cmd === 'quote') {
                    document.execCommand('formatBlock', false, 'blockquote');
                } else if (cmd === 'ul') {
                    document.execCommand('insertUnorderedList', false, null);
                } else if (cmd === 'ol') {
                    document.execCommand('insertOrderedList', false, null);
                } else if (cmd === 'task') {
                    insertHtmlAtCursor('<ul><li><input type="checkbox" /> Task item</li></ul>');
                } else if (cmd === 'indent') {
                    document.execCommand('indent', false, null);
                } else if (cmd === 'outdent') {
                    document.execCommand('outdent', false, null);
                } else if (cmd === 'code') {
                    document.execCommand('insertHTML', false, '<code>code</code>');
                } else if (cmd === 'codeblock') {
                    var lang = window.prompt('Code block language (optional)', 'js');
                    var langClass = (lang || '').trim();
                    var cls = langClass ? ' class="language-' + langClass + '"' : '';
                    insertHtmlAtCursor('<pre><code' + cls + '>code</code></pre><p><br></p>');
                } else if (cmd === 'strike') {
                    document.execCommand('strikeThrough', false, null);
                } else if (cmd === 'link') {
                    var url = window.prompt('Enter URL');
                    if (url) document.execCommand('createLink', false, url.trim());
                } else if (cmd === 'unlink') {
                    document.execCommand('unlink', false, null);
                } else if (cmd === 'image') {
                    var src = window.prompt('Image URL');
                    if (src) {
                        var alt = window.prompt('Image alt text (optional)', '') || '';
                        insertHtmlAtCursor('<img src="' + escapeHtml(src.trim()) + '" alt="' + escapeHtml(alt) + '" />');
                    }
                } else if (cmd === 'table') {
                    insertHtmlAtCursor('<table><thead><tr><th>Column 1</th><th>Column 2</th></tr></thead><tbody><tr><td>Value</td><td>Value</td></tr></tbody></table><p><br></p>');
                } else if (cmd === 'hr') {
                    insertHtmlAtCursor('<hr><p><br></p>');
                } else if (cmd === 'clear') {
                    document.execCommand('removeFormat', false, null);
                    document.execCommand('formatBlock', false, 'p');
                } else if (cmd === 'undo') {
                    document.execCommand('undo', false, null);
                } else if (cmd === 'redo') {
                    document.execCommand('redo', false, null);
                } else {
                    document.execCommand(cmd, false, null);
                }

                syncInlineDocumentToMarkdown();
                updateInlineToolbarState();
            }

            toolbar.querySelectorAll('.inline-tool-btn').forEach(function (btn) {
                btn.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                });
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    applyInlineCommand(btn.getAttribute('data-cmd'));
                });
            });

            editable.addEventListener('input', function () {
                syncInlineDocumentToMarkdown();
                updateInlineToolbarState();
            });

            editable.addEventListener('keydown', function (e) {
                var isCtrl = e.ctrlKey || e.metaKey;
                if (isCtrl && e.key.toLowerCase() === 'b') {
                    e.preventDefault();
                    document.execCommand('bold', false, null);
                    syncInlineDocumentToMarkdown();
                } else if (isCtrl && e.key.toLowerCase() === 'i') {
                    e.preventDefault();
                    document.execCommand('italic', false, null);
                    syncInlineDocumentToMarkdown();
                } else if (isCtrl && e.key.toLowerCase() === 'k') {
                    e.preventDefault();
                    applyInlineCommand('link');
                } else if (isCtrl && e.shiftKey && e.key === '7') {
                    e.preventDefault();
                    applyInlineCommand('ol');
                } else if (isCtrl && e.shiftKey && e.key === '8') {
                    e.preventDefault();
                    applyInlineCommand('ul');
                }
            });

            editable.addEventListener('mouseup', updateInlineToolbarState);
            editable.addEventListener('keyup', updateInlineToolbarState);
            editable.addEventListener('focus', updateInlineToolbarState);

            document.addEventListener('selectionchange', function () {
                if (!inlineDocEditorEl) return;
                if (!inlineDocEditorEl.contains(document.activeElement)) return;
                updateInlineToolbarState();
            });
        }

        inlineDocEditorEl = inlineEditorEl.querySelector('.inline-doc-editor');
        if (!inlineDocEditorEl) return;

        // Always refresh when switching to a different document.
        if (inlineDocActiveDocId !== state.activeDocId) {
            inlineDocActiveDocId = state.activeDocId;
            inlineDocEditorEl.innerHTML = source.trim() ? renderedHtml : '<p><br></p>';
            postProcessPreview(inlineDocEditorEl);
            return;
        }

        // Avoid overriding while user is typing in the inline document editor.
        if ((forceRender || document.activeElement !== inlineDocEditorEl) && !inlineDocSyncing) {
            inlineDocEditorEl.innerHTML = source.trim() ? renderedHtml : '<p><br></p>';
            postProcessPreview(inlineDocEditorEl);
        }
    }

    function syncInlineDocumentToMarkdown() {
        if (!inlineDocEditorEl || !editorEl) return;

        var markdown = richHtmlToMarkdown(inlineDocEditorEl.innerHTML);
        var doc = getActiveDocument();
        if (!doc) return;
        var previousContent = doc.content || '';

        inlineDocSyncing = true;
        setEditorValue(markdown);
        inlineDocActiveDocId = doc.id;

        doc.content = markdown;
        if (markdown !== previousContent) {
            var becameDirty = !doc.isDirty;
            doc.isDirty = true;
            if (becameDirty) renderTabs();
        }

        updateTOC();
        updateDocumentTitle();
        updateDocStats();
        scheduleAutoSave();

        inlineDocSyncing = false;
    }

    // ================================================================
    //  MODE SWITCHING
    // ================================================================

    function setMode(mode) {
        state.mode = mode;
        mainContentEl.setAttribute('data-mode', mode);

        // Clear stale inline flex values from split-mode resizing so CSS rules take effect.
        if (mode !== 'split') {
            var ep = document.getElementById('editor-panel');
            var pp = document.getElementById('preview-panel');
            if (ep) ep.style.flex = '';
            if (pp) pp.style.flex = '';
        }

        // Update mode buttons
        document.querySelectorAll('.mode-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
        });

        // Sync scroll button visibility
        var syncBtn = document.getElementById('sync-scroll-btn');
        if (syncBtn) syncBtn.style.display = mode === 'split' ? '' : 'none';

        // Divider visibility
        var divider = document.getElementById('panel-divider');
        if (divider) divider.style.display = mode === 'split' ? '' : 'none';

        // Update preview for newly visible panels
        if (mode === 'inline') {
            var doc = getActiveDocument();
            if (doc) {
                var html = renderMarkdown(doc.content, { hideAttributionInApp: true });
                renderInlineMode(doc.content, html, { forceRender: true });
            }
        } else {
            updatePreview({ forceRender: true });
        }

        refreshLayoutSoon();
        saveSettings();
    }

    // ================================================================
    //  THEMES
    // ================================================================

    function setTheme(theme) {
        state.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);

        // Update menu active state
        document.querySelectorAll('#theme-menu .dropdown-item').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
        });

        saveSettings();
    }

    // ================================================================
    //  APPEARANCE (Light / Dark / System)
    // ================================================================

    function getEffectiveAppearance() {
        if (state.appearance === 'system') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return state.appearance;
    }

    function applyAppearance() {
        var effective = getEffectiveAppearance();
        document.documentElement.setAttribute('data-appearance', effective);

        // Swap highlight.js theme
        var hljsLink = document.getElementById('hljs-theme');
        if (hljsLink) {
            hljsLink.href = effective === 'dark'
                ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
                : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
        }

        // Update mermaid theme
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({
                startOnLoad: false,
                theme: effective === 'dark' ? 'dark' : 'default',
                securityLevel: 'strict'
            });
        }

        // Update icon visibility
        var toggle = document.getElementById('appearance-toggle');
        if (toggle) {
            toggle.querySelector('.icon-light').style.display = state.appearance === 'light' ? '' : 'none';
            toggle.querySelector('.icon-dark').style.display = state.appearance === 'dark' ? '' : 'none';
            toggle.querySelector('.icon-system').style.display = state.appearance === 'system' ? '' : 'none';
        }

        // Update appearance menu active state
        document.querySelectorAll('#appearance-menu .dropdown-item').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-appearance') === state.appearance);
        });

        if (cmEditor) {
            cmEditor.setOption('theme', effective === 'dark' ? 'material-darker' : 'default');
        }
    }

    function setAppearance(appearance) {
        state.appearance = appearance;
        applyAppearance();
        // Re-render preview to pick up mermaid theme changes
        updatePreview({ forceRender: true });
        saveSettings();
    }

    // ================================================================
    //  TYPOGRAPHY
    // ================================================================

    function applyTypography() {
        var t = state.typography;
        var style = document.documentElement.style;
        if (t.fontFamily) style.setProperty('--preview-font-body', t.fontFamily);
        else style.removeProperty('--preview-font-body');
        style.setProperty('--preview-font-size', t.fontSize + 'px');
        style.setProperty('--preview-line-height', t.lineHeight);
        style.setProperty('--preview-max-width', t.maxWidth + 'px');
    }

    function setupTypography() {
        var fontSize = document.getElementById('font-size-range');
        var lineHeight = document.getElementById('line-height-range');
        var maxWidth = document.getElementById('max-width-range');
        var fontFamily = document.getElementById('font-family-select');

        if (fontSize) fontSize.addEventListener('input', function () {
            state.typography.fontSize = parseInt(this.value);
            document.getElementById('font-size-val').textContent = this.value + 'px';
            applyTypography();
            saveSettings();
        });

        if (lineHeight) lineHeight.addEventListener('input', function () {
            state.typography.lineHeight = parseFloat(this.value);
            document.getElementById('line-height-val').textContent = this.value;
            applyTypography();
            saveSettings();
        });

        if (maxWidth) maxWidth.addEventListener('input', function () {
            state.typography.maxWidth = parseInt(this.value);
            document.getElementById('max-width-val').textContent = this.value + 'px';
            applyTypography();
            saveSettings();
        });

        if (fontFamily) fontFamily.addEventListener('change', function () {
            state.typography.fontFamily = this.value;
            applyTypography();
            saveSettings();
        });

        var resetBtn = document.getElementById('typography-reset');
        if (resetBtn) resetBtn.addEventListener('click', function () {
            state.typography = { fontFamily: '', fontSize: 16, lineHeight: 1.6, maxWidth: 900 };
            if (fontSize) { fontSize.value = 16; document.getElementById('font-size-val').textContent = '16px'; }
            if (lineHeight) { lineHeight.value = 1.6; document.getElementById('line-height-val').textContent = '1.6'; }
            if (maxWidth) { maxWidth.value = 900; document.getElementById('max-width-val').textContent = '900px'; }
            if (fontFamily) fontFamily.value = '';
            applyTypography();
            saveSettings();
        });
    }

    // ================================================================
    //  FILE SYSTEM
    // ================================================================

    async function openFileFromDisk() {
        // Try File System Access API
        if ('showOpenFilePicker' in window) {
            try {
                var handles = await window.showOpenFilePicker({
                    types: [
                        { description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown'] } },
                        { description: 'Text', accept: { 'text/plain': ['.txt', '.text'] } }
                    ],
                    multiple: false
                });
                var handle = handles[0];
                var file = await handle.getFile();
                var text = await file.text();
                createDocument(file.name, text, handle, { lockTitle: true });
                showStatus('Opened: ' + file.name);
                return;
            } catch (e) {
                if (e.name === 'AbortError') return;
            }
        }
        // Fallback: file input
        document.getElementById('file-input').click();
    }

    async function saveFileToDisk() {
        var doc = getActiveDocument();
        if (!doc) return;

        // If we have a file handle, save directly
        if (doc.fileHandle) {
            try {
                var writable = await doc.fileHandle.createWritable();
                await writable.write(doc.content);
                await writable.close();
                showStatus('Saved: ' + doc.title);
                return;
            } catch (e) { /* fall through */ }
        }

        // Try File System Access API for Save As
        if ('showSaveFilePicker' in window) {
            try {
                var handle = await window.showSaveFilePicker({
                    suggestedName: doc.title || 'document.md',
                    types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }]
                });
                var writable = await handle.createWritable();
                await writable.write(doc.content);
                await writable.close();
                doc.fileHandle = handle;
                showStatus('Saved: ' + doc.title);
                return;
            } catch (e) {
                if (e.name === 'AbortError') return;
            }
        }

        // Fallback: download
        downloadFile(doc.content, doc.title || 'document.md', 'text/markdown');
    }

    function uploadFile() {
        document.getElementById('file-input').click();
    }

    function handleFileInput(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
            createDocument(file.name, ev.target.result, null, { lockTitle: true });
            showStatus('Opened: ' + file.name);
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    function downloadFile(content, filename, mimeType) {
        var blob = new Blob([content], { type: mimeType || 'text/plain' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function downloadMarkdown() {
        var doc = getActiveDocument();
        if (!doc) return;
        var content = doc.content || '';
        if (!hasAttributionLink(content)) {
            content = content.replace(/\s*$/, '') + '\n\n---\n\n' + ATTRIBUTION_LINK + '\n';
        }
        downloadFile(content, doc.title || 'document.md', 'text/markdown');
    }

    // ================================================================
    //  DRAG & DROP
    // ================================================================

    function setupDragDrop() {
        var counter = 0;
        appEl.addEventListener('dragenter', function (e) {
            e.preventDefault();
            counter++;
            appEl.classList.add('drag-over');
        });
        appEl.addEventListener('dragleave', function (e) {
            e.preventDefault();
            counter--;
            if (counter === 0) appEl.classList.remove('drag-over');
        });
        appEl.addEventListener('dragover', function (e) {
            e.preventDefault();
        });
        appEl.addEventListener('drop', function (e) {
            e.preventDefault();
            counter = 0;
            appEl.classList.remove('drag-over');
            var files = e.dataTransfer.files;
            if (files.length > 0) {
                var file = files[0];
                if (/\.(md|markdown|txt|text)$/i.test(file.name)) {
                    var reader = new FileReader();
                    reader.onload = function (ev) {
                        createDocument(file.name, ev.target.result, null, { lockTitle: true });
                        showStatus('Opened: ' + file.name);
                    };
                    reader.readAsText(file);
                }
            }
        });
    }

    // ================================================================
    //  EXPORT
    // ================================================================

    function getRenderedHTML() {
        var doc = getActiveDocument();
        if (!doc) return '';
        return renderMarkdown(doc.content);
    }

    function getExportCSS() {
        // Collect computed CSS variables
        var cs = getComputedStyle(document.documentElement);
        return `
            body {
                font-family: ${cs.getPropertyValue('--preview-font-body')};
                font-size: ${cs.getPropertyValue('--preview-font-size')};
                line-height: ${cs.getPropertyValue('--preview-line-height')};
                color: ${cs.getPropertyValue('--preview-text')};
                background: ${cs.getPropertyValue('--preview-bg')};
                max-width: ${cs.getPropertyValue('--preview-max-width')};
                margin: 0 auto;
                padding: 40px 32px;
            }
            h1, h2, h3, h4, h5, h6 {
                font-family: ${cs.getPropertyValue('--preview-font-heading')};
                color: ${cs.getPropertyValue('--preview-heading')};
                margin-top: 1.5em; margin-bottom: 0.6em; font-weight: 600;
            }
            h1 { font-size: 2em; border-bottom: 1px solid ${cs.getPropertyValue('--preview-border')}; padding-bottom: 0.3em; }
            h2 { font-size: 1.5em; border-bottom: 1px solid ${cs.getPropertyValue('--preview-border')}; padding-bottom: 0.25em; }
            h3 { font-size: 1.25em; }
            a { color: ${cs.getPropertyValue('--preview-link')}; text-decoration: none; }
            code { font-family: ${cs.getPropertyValue('--preview-font-code')}; background: ${cs.getPropertyValue('--preview-code-bg')}; padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.875em; }
            pre { background: ${cs.getPropertyValue('--preview-code-bg')}; padding: 16px; border-radius: 8px; overflow-x: auto; }
            pre code { background: transparent; padding: 0; font-size: 13px; }
            blockquote { border-left: 4px solid ${cs.getPropertyValue('--preview-blockquote-border')}; padding: 0.5em 1em; color: ${cs.getPropertyValue('--preview-blockquote-text')}; margin: 0 0 1em; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
            th, td { border: 1px solid ${cs.getPropertyValue('--preview-table-border')}; padding: 8px 14px; text-align: left; }
            th { background: ${cs.getPropertyValue('--preview-table-stripe')}; font-weight: 600; }
            hr { border: none; height: 2px; background: ${cs.getPropertyValue('--preview-hr')}; margin: 1.5em 0; }
            img { max-width: 100%; height: auto; }
            ul, ol { padding-left: 2em; }
            .callout { padding: 12px 16px; border-radius: 8px; border-left: 4px solid; margin-bottom: 1em; }
            .callout-note { background: #ddf4ff; border-color: #0969da; }
            .callout-tip { background: #dafbe1; border-color: #1a7f37; }
            .callout-warning { background: #fff8c5; border-color: #bf8700; }
            .callout-important { background: #ffebe9; border-color: #cf222e; }
            .callout-caution { background: #fff1e5; border-color: #bc4c00; }
            .callout-title { font-weight: 600; margin-bottom: 6px; }
            .code-block { border: 1px solid ${cs.getPropertyValue('--preview-border')}; border-radius: 8px; overflow: hidden; margin-bottom: 1em; }
            .code-header { display: flex; justify-content: space-between; padding: 6px 12px; background: rgba(0,0,0,0.03); border-bottom: 1px solid ${cs.getPropertyValue('--preview-border')}; font-size: 12px; }
            .copy-btn { display: none; }
            .task-list-item { list-style: none; margin-left: -1.5em; }
            .task-list-item input { margin-right: 0.5em; }
        `;
    }

    function exportHTML() {
        var doc = getActiveDocument();
        if (!doc) return;
        var html = getRenderedHTML();
        var fullHtml = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
            + '<title>' + escapeHtml(doc.title) + '</title>\n'
            + '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">\n'
            + '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">\n'
            + '<style>' + getExportCSS() + '</style>\n'
            + '</head>\n<body>\n' + html + '\n</body>\n</html>';
        downloadFile(fullHtml, (doc.title || 'document').replace(/\.md$/i, '') + '.html', 'text/html');
        showStatus('Exported HTML');
    }

    function exportPDF() {
        var doc = getActiveDocument();
        if (!doc) return;
        if (typeof html2pdf === 'undefined') {
            showStatus('PDF exporter unavailable');
            return;
        }

        var marginInput = window.prompt('PDF margin in mm (single value for all sides)', '12');
        var margin = parseInt(marginInput || '12', 10);
        if (isNaN(margin) || margin < 0) margin = 12;

        var orientationInput = window.prompt('PDF orientation: portrait or landscape', 'portrait');
        var orientation = (orientationInput || 'portrait').toLowerCase() === 'landscape' ? 'landscape' : 'portrait';

        var paperInput = window.prompt('Paper size: a4, letter, legal', 'a4');
        var paper = (paperInput || 'a4').toLowerCase();
        if (['a4', 'letter', 'legal'].indexOf(paper) === -1) paper = 'a4';

        var html = renderMarkdown(doc.content, { hideAttributionInApp: true });
        var wrapper = document.createElement('div');
        wrapper.className = 'markdown-body';
        wrapper.style.maxWidth = 'none';
        wrapper.style.padding = '0';
        wrapper.innerHTML = html;
        postProcessPreview(wrapper);

        html2pdf().set({
            margin: margin,
            filename: (doc.title || 'document').replace(/\.md$/i, '') + '.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: paper, orientation: orientation }
        }).from(wrapper).save().then(function () {
            showStatus('Exported PDF');
        }).catch(function () {
            showStatus('PDF export failed');
        });
    }

    function exportPrint() {
        // Make sure preview is up to date
        var doc = getActiveDocument();
        if (!doc) return;
        previewContentEl.innerHTML = renderMarkdown(doc.content);
        postProcessPreview(previewContentEl);
        setTimeout(function () { window.print(); }, 200);
    }

    function exportEmbed() {
        var html = getRenderedHTML();
        var snippet = '<div class="markdown-body" style="' +
            'font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; ' +
            'font-size: 16px; line-height: 1.6; color: #1f2328; max-width: 900px; margin: 0 auto; padding: 20px;">\n'
            + html + '\n</div>';
        var modal = document.getElementById('embed-modal');
        document.getElementById('embed-code').value = snippet;
        modal.classList.add('open');
    }

    async function downloadSkillFileFromWorkspace() {
        var skillFiles = ['skill.zip'];
        var downloaded = 0;

        function directLinkDownload(filename) {
            var link = document.createElement('a');
            link.href = filename;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        for (var i = 0; i < skillFiles.length; i++) {
            var filename = skillFiles[i];
            try {
                var response = await fetch(filename, { cache: 'no-store' });
                if (response.ok) {
                    var content = await response.text();
                    downloadFile(content, filename, 'text/markdown');
                    downloaded++;
                } else {
                    directLinkDownload(filename);
                    downloaded++;
                }
            } catch (e) {
                directLinkDownload(filename);
                downloaded++;
            }
            // Small delay between downloads so the browser does not block them
            if (i < skillFiles.length - 1) {
                await new Promise(function (resolve) { setTimeout(resolve, 300); });
            }
        }

        showStatus('Downloaded ' + downloaded + ' skill file' + (downloaded !== 1 ? 's' : ''));
    }

    function handleExport(type) {
        switch (type) {
            case 'html': exportHTML(); break;
            case 'pdf': exportPDF(); break;
            case 'print': exportPrint(); break;
            case 'embed': exportEmbed(); break;
            case 'md': downloadMarkdown(); break;
        }
    }

    // ================================================================
    //  UI - DROPDOWNS
    // ================================================================

    function setupDropdowns() {
        // Toggle dropdown on button click
        document.querySelectorAll('[data-dropdown]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var menuId = btn.getAttribute('data-dropdown');
                var dropdown = btn.closest('.dropdown');
                var isOpen = dropdown.classList.contains('open');

                // Close all
                document.querySelectorAll('.dropdown.open').forEach(function (d) { d.classList.remove('open'); });

                if (!isOpen) dropdown.classList.add('open');
            });
        });

        // Close dropdowns on outside click
        document.addEventListener('click', function () {
            document.querySelectorAll('.dropdown.open').forEach(function (d) { d.classList.remove('open'); });
        });

        // Prevent click inside menu from closing
        document.querySelectorAll('.dropdown-menu').forEach(function (menu) {
            menu.addEventListener('click', function (e) {
                // Only stop propagation for panels (typography), not regular menus
                if (menu.classList.contains('dropdown-panel')) {
                    e.stopPropagation();
                }
            });
        });
    }

    // ================================================================
    //  UI - MODALS
    // ================================================================

    function setupModals() {
        // Close modal
        document.querySelectorAll('.modal-close').forEach(function (btn) {
            btn.addEventListener('click', function () {
                btn.closest('.modal-overlay').classList.remove('open');
            });
        });
        document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) overlay.classList.remove('open');
            });
        });

        // Drawer pages
        var menuOverlay = document.getElementById('app-menu-overlay');
        if (menuOverlay) {
            var closeMenu = function () { menuOverlay.classList.remove('open'); };
            var closeBtn = document.getElementById('app-menu-close');
            if (closeBtn) closeBtn.addEventListener('click', closeMenu);

            menuOverlay.addEventListener('click', function (e) {
                if (e.target === menuOverlay) closeMenu();
            });

            document.querySelectorAll('.drawer-nav-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var page = btn.getAttribute('data-page');
                    document.querySelectorAll('.drawer-nav-btn').forEach(function (b) {
                        var active = b === btn;
                        b.classList.toggle('active', active);
                        b.setAttribute('aria-selected', active ? 'true' : 'false');
                    });
                    document.querySelectorAll('.drawer-page').forEach(function (panel) {
                        panel.classList.toggle('active', panel.getAttribute('data-page') === page);
                    });
                });
            });

            var skillBtn = document.getElementById('download-skill-btn');
            if (skillBtn) {
                skillBtn.addEventListener('click', function () {
                    downloadSkillFileFromWorkspace();
                });
            }
        }

        // Copy embed code
        var copyEmbedBtn = document.getElementById('copy-embed-btn');
        if (copyEmbedBtn) {
            copyEmbedBtn.addEventListener('click', function () {
                var textarea = document.getElementById('embed-code');

                function markCopied() {
                    copyEmbedBtn.textContent = 'Copied!';
                    setTimeout(function () { copyEmbedBtn.textContent = 'Copy to Clipboard'; }, 2000);
                }

                function fallbackCopy() {
                    textarea.select();
                    try {
                        document.execCommand('copy');
                        markCopied();
                    } catch (_) {
                        showStatus('Copy failed. Please copy manually.');
                    }
                }

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(textarea.value).then(markCopied).catch(fallbackCopy);
                    return;
                }

                fallbackCopy();
            });
        }
    }

    // ================================================================
    //  UI - COPY CODE BUTTON (event delegation)
    // ================================================================

    function setupCopyButtons() {
        document.addEventListener('click', function (e) {
            if (e.target.classList.contains('copy-btn')) {
                var codeBlock = e.target.closest('.code-block');
                if (!codeBlock) return;
                var code = codeBlock.querySelector('code');
                if (!code) return;

                function markCopied() {
                    e.target.textContent = 'Copied!';
                    e.target.classList.add('copied');
                    setTimeout(function () {
                        e.target.textContent = 'Copy';
                        e.target.classList.remove('copied');
                    }, 2000);
                }

                function fallbackCopy() {
                    var fallback = document.createElement('textarea');
                    fallback.value = code.textContent;
                    fallback.style.position = 'fixed';
                    fallback.style.opacity = '0';
                    document.body.appendChild(fallback);
                    fallback.focus();
                    fallback.select();
                    try {
                        document.execCommand('copy');
                        markCopied();
                    } catch (_) {
                        showStatus('Copy failed. Please copy manually.');
                    }
                    document.body.removeChild(fallback);
                }

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(code.textContent).then(markCopied).catch(fallbackCopy);
                    return;
                }

                fallbackCopy();
            }
        });
    }

    function setupPreviewAnchorNavigation() {
        document.addEventListener('click', function (e) {
            var anchor = e.target && e.target.closest ? e.target.closest('a') : null;
            if (!anchor) return;

            var inPreview = previewContentEl && previewContentEl.contains(anchor);
            var inInline = inlineDocEditorEl && inlineDocEditorEl.contains(anchor);
            if (!inPreview && !inInline) return;

            var href = anchor.getAttribute('href') || '';
            if (!href) return;

            var resolved;
            try {
                resolved = new URL(href, window.location.href);
            } catch (_) {
                return;
            }

            var isSameOrigin = resolved.origin === window.location.origin;
            var isAppPath = resolved.pathname === '/app' || resolved.pathname === '/app/';
            if (!isSameOrigin || !isAppPath || !resolved.hash) return;

            var targetId = resolved.hash.slice(1);
            if (!targetId) return;

            var targetEl = document.getElementById(targetId);
            if (!targetEl) return;

            e.preventDefault();

            var scrollContainer = inInline ? inlineEditorEl : previewPanelEl;
            if (!scrollContainer) return;

            var containerRect = scrollContainer.getBoundingClientRect();
            var targetRect = targetEl.getBoundingClientRect();
            var targetTop = scrollContainer.scrollTop + (targetRect.top - containerRect.top) - 20;
            scrollContainer.scrollTo({
                top: Math.max(0, targetTop),
                behavior: 'smooth'
            });

            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', resolved.pathname + resolved.hash);
            }
        });
    }

    // ================================================================
    //  EDITOR GUTTER (Line Numbers)
    // ================================================================

    function setupEditorGutter() {
        if (cmEditor) return;
        if (!editorEl || !editorEl.parentElement) return;

        var gutterEl = document.getElementById('editor-gutter');
        if (!gutterEl) {
            gutterEl = document.createElement('div');
            gutterEl.id = 'editor-gutter';
            editorEl.parentElement.insertBefore(gutterEl, editorEl);
        }

        function updateLineNumbers() {
            var lines = editorEl.value.split('\n').length;
            var html = '';
            for (var i = 1; i <= lines; i++) {
                html += '<div class="gutter-line">' + i + '</div>';
            }
            gutterEl.innerHTML = html;
        }

        function syncGutterScroll() {
            gutterEl.scrollTop = editorEl.scrollTop;
        }

        updateLineNumbers();
        editorEl.addEventListener('input', updateLineNumbers);
        editorEl.addEventListener('scroll', syncGutterScroll);
    }

    // ================================================================
    //  KEYBOARD SHORTCUTS & CODE EDITOR FEATURES
    // ================================================================

    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function (e) {
            var isCtrl = e.ctrlKey || e.metaKey;

            if (isCtrl && e.key === 's') {
                e.preventDefault();
                saveFileToDisk();
            }
            else if (isCtrl && e.key === 'o') {
                e.preventDefault();
                openFileFromDisk();
            }
            else if (isCtrl && e.key === 'n') {
                e.preventDefault();
                createDocument('Untitled.md', '');
            }
            else if (isCtrl && e.key === 'b' && isEditorFocused()) {
                e.preventDefault();
                wrapSelection('**', '**');
            }
            else if (isCtrl && e.key === 'i' && isEditorFocused()) {
                e.preventDefault();
                wrapSelection('*', '*');
            }
            else if (isCtrl && e.key === 'k' && isEditorFocused()) {
                e.preventDefault();
                wrapSelection('[', '](url)');
            }
            else if (isCtrl && e.key === '`' && isEditorFocused()) {
                e.preventDefault();
                wrapSelection('`', '`');
            }
            else if (isCtrl && e.key === '~' && isEditorFocused()) {
                e.preventDefault();
                wrapSelection('~~', '~~');
            }
            else if (isCtrl && e.key === '\'' && isEditorFocused()) {
                e.preventDefault();
                wrapSelection('> ', ''); // Blockquote
            }
        });

        if (cmEditor) {
            cmEditor.setOption('extraKeys', Object.assign({}, cmEditor.getOption('extraKeys') || {}, {
                'Tab': function (cm) { cm.execCommand('indentMore'); },
                'Shift-Tab': function (cm) { cm.execCommand('indentLess'); }
            }));
            return;
        }

        // Advanced editor features
        editorEl.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                handleTabKey(e.shiftKey);
            } else if (document.activeElement === editorEl) {
                var start = editorEl.selectionStart;
                var value = editorEl.value;
                var char = e.key;

                // Auto-close brackets in code/inline code contexts (simple heuristic)
                if (char === '[' && shouldAutoBracket(value, start)) {
                    e.preventDefault();
                    insertAndPosition('[', ']');
                } else if (char === '{' && shouldAutoBracket(value, start)) {
                    e.preventDefault();
                    insertAndPosition('{', '}');
                } else if (char === '(' && shouldAutoBracket(value, start)) {
                    e.preventDefault();
                    insertAndPosition('(', ')');
                } else if (char === '"' || char === "'") {
                    if (isInCodeContext(value, start)) {
                        e.preventDefault();
                        insertAndPosition(char, char);
                    }
                }
            }
        });
    }

    function handleTabKey(shiftKey) {
        if (cmEditor) {
            cmEditor.execCommand(shiftKey ? 'indentLess' : 'indentMore');
            if (editorEl) editorEl.value = cmEditor.getValue();
            updatePreview();
            return;
        }

        var start = editorEl.selectionStart;
        var end = editorEl.selectionEnd;
        var value = editorEl.value;
        var indent = '    ';

        if (start === end) {
            // No selection: indent single line or outdent if Shift
            if (shiftKey) {
                var lineStart = value.lastIndexOf('\n', start - 1) + 1;
                if (value.substring(lineStart, start).match(/^    /)) {
                    editorEl.value = value.substring(0, lineStart) + value.substring(lineStart + 4);
                    editorEl.selectionStart = editorEl.selectionEnd = Math.max(lineStart, start - 4);
                }
            } else {
                editorEl.value = value.substring(0, start) + indent + value.substring(end);
                editorEl.selectionStart = editorEl.selectionEnd = start + 4;
            }
        } else {
            // Selection: indent or outdent multiple lines
            var lineStart = value.lastIndexOf('\n', start - 1) + 1;
            var lineEnd = value.indexOf('\n', end);
            if (lineEnd === -1) lineEnd = value.length;
            var selection = value.substring(lineStart, lineEnd);

            if (shiftKey) {
                var outdented = selection.replace(/^    /gm, '');
                editorEl.value = value.substring(0, lineStart) + outdented + value.substring(lineEnd);
                editorEl.selectionStart = lineStart;
                editorEl.selectionEnd = lineStart + outdented.length;
            } else {
                var indented = selection.replace(/^/gm, indent);
                editorEl.value = value.substring(0, lineStart) + indented + value.substring(lineEnd);
                editorEl.selectionStart = lineStart;
                editorEl.selectionEnd = lineStart + indented.length;
            }
        }

        updatePreview();
    }

    function shouldAutoBracket(value, start) {
        if (start === 0) return false;
        var char = value[start - 1];
        return /[\s([\]\n,:]/.test(char) || value.substring(start - 4, start) === '    ';
    }

    function isInCodeContext(value, start) {
        // Simple heuristic: check if we're inside backticks or a code block
        var before = value.substring(0, start);
        var backtickCount = (before.match(/`/g) || []).length;
        return backtickCount % 2 === 1 || /^\s*```/.test(before);
    }

    function insertAndPosition(open, close) {
        if (cmEditor) {
            var selections = cmEditor.listSelections();
            cmEditor.operation(function () {
                for (var i = selections.length - 1; i >= 0; i--) {
                    var range = selections[i];
                    var from = range.from();
                    var to = range.to();
                    var selected = cmEditor.getRange(from, to) || 'text';
                    cmEditor.replaceRange(open + selected + close, from, to);
                }
            });
            if (editorEl) editorEl.value = cmEditor.getValue();
            updatePreview();
            return;
        }

        var start = editorEl.selectionStart;
        var end = editorEl.selectionEnd;
        var value = editorEl.value;
        var selected = value.substring(start, end) || 'text';
        editorEl.value = value.substring(0, start) + open + selected + close + value.substring(end);
        editorEl.selectionStart = start + open.length;
        editorEl.selectionEnd = start + open.length + selected.length;
        editorEl.focus();
        updatePreview();
    }

    function wrapSelection(before, after) {
        if (cmEditor) {
            var selections = cmEditor.listSelections();
            cmEditor.operation(function () {
                for (var i = selections.length - 1; i >= 0; i--) {
                    var range = selections[i];
                    var from = range.from();
                    var to = range.to();
                    var selected = cmEditor.getRange(from, to) || 'text';
                    cmEditor.replaceRange(before + selected + after, from, to);
                }
            });
            if (editorEl) editorEl.value = cmEditor.getValue();
            cmEditor.focus();
            updatePreview();
            return;
        }

        var start = editorEl.selectionStart;
        var end = editorEl.selectionEnd;
        var value = editorEl.value;
        var selected = value.substring(start, end) || 'text';
        editorEl.value = value.substring(0, start) + before + selected + after + value.substring(end);
        editorEl.selectionStart = start + before.length;
        editorEl.selectionEnd = start + before.length + selected.length;
        editorEl.focus();
        updatePreview();
    }

    // ================================================================
    //  EVENT WIRING
    // ================================================================

    function wireEvents() {
        // Mode switcher
        document.querySelectorAll('.mode-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                setMode(btn.getAttribute('data-mode'));
            });
        });

        // Sync scroll toggle
        var syncBtn = document.getElementById('sync-scroll-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', function () {
                state.syncScroll = !state.syncScroll;
                syncBtn.classList.toggle('active', state.syncScroll);
                saveSettings();
            });
        }

        // App menu toggle (header left icon)
        var menuBtn = document.getElementById('sidebar-toggle');
        if (menuBtn) {
            menuBtn.addEventListener('click', function () {
                var menu = document.getElementById('app-menu-overlay');
                if (menu) menu.classList.add('open');
            });
        }

        // TOC toggle moved to tab bar
        var tocToggleBtn = document.getElementById('toc-toggle-btn');
        if (tocToggleBtn) {
            tocToggleBtn.addEventListener('click', function () {
                state.sidebarOpen = !state.sidebarOpen;
                applyTOCVisibility();
                refreshLayoutSoon();
                saveSettings();
            });
        }

        // TOC close
        var tocClose = document.getElementById('toc-close');
        if (tocClose) {
            tocClose.addEventListener('click', function () {
                state.sidebarOpen = false;
                applyTOCVisibility();
                refreshLayoutSoon();
                saveSettings();
            });
        }

        var onWindowResize = debounce(function () {
            applyTOCVisibility();
            refreshLayoutSoon();
        }, 80);

        window.addEventListener('resize', function () {
            onWindowResize();
        });

        // Appearance menu
        document.querySelectorAll('#appearance-menu .dropdown-item').forEach(function (btn) {
            btn.addEventListener('click', function () {
                setAppearance(btn.getAttribute('data-appearance'));
                btn.closest('.dropdown').classList.remove('open');
            });
        });

        // Listen for system theme changes
        var darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
        var onSchemeChange = function () {
            if (state.appearance === 'system') applyAppearance();
        };
        if (darkMedia.addEventListener) {
            darkMedia.addEventListener('change', onSchemeChange);
        } else if (darkMedia.addListener) {
            darkMedia.addListener(onSchemeChange);
        }

        // Theme menu
        document.querySelectorAll('#theme-menu .dropdown-item').forEach(function (btn) {
            btn.addEventListener('click', function () {
                setTheme(btn.getAttribute('data-theme'));
                btn.closest('.dropdown').classList.remove('open');
            });
        });

        // File menu
        document.getElementById('new-doc-btn').addEventListener('click', function () {
            createDocument('Untitled.md', '');
            this.closest('.dropdown').classList.remove('open');
        });
        document.getElementById('open-file-btn').addEventListener('click', function () {
            openFileFromDisk();
            this.closest('.dropdown').classList.remove('open');
        });
        document.getElementById('save-file-btn').addEventListener('click', function () {
            saveFileToDisk();
            this.closest('.dropdown').classList.remove('open');
        });
        document.getElementById('upload-file-btn').addEventListener('click', function () {
            uploadFile();
            this.closest('.dropdown').classList.remove('open');
        });
        document.getElementById('download-md-btn').addEventListener('click', function () {
            downloadMarkdown();
            this.closest('.dropdown').classList.remove('open');
        });

        // Export menu
        document.querySelectorAll('#export-menu .dropdown-item[data-export]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                handleExport(btn.getAttribute('data-export'));
                btn.closest('.dropdown').classList.remove('open');
            });
        });

        // New tab button
        document.getElementById('new-tab-btn').addEventListener('click', function () {
            createDocument('Untitled.md', '');
        });

        // File input
        document.getElementById('file-input').addEventListener('change', handleFileInput);

        // Editor input fallback (CodeMirror attaches its own change listener)
        if (!cmEditor) {
            editorEl.addEventListener('input', updatePreview);
        }
    }

    // ================================================================
    //  INITIALIZATION
    // ================================================================

    async function init() {
        // Cache DOM references
        editorEl = document.getElementById('editor');
        previewPanelEl = document.getElementById('preview-panel');
        previewContentEl = document.getElementById('preview-content');
        tocNavEl = document.getElementById('toc-nav');
        tabsContainerEl = document.getElementById('tabs-container');
        docStatsEl = document.getElementById('doc-stats');
        tocSidebarEl = document.getElementById('toc-sidebar');
        mainContentEl = document.getElementById('main-content');
        inlineEditorEl = document.getElementById('inline-editor');
        appEl = document.getElementById('app');

        // Configure libraries
        configureMarked();
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });
        }

        // Load settings
        var settings = loadSettings();
        if (settings.theme) state.theme = settings.theme;
        if (settings.mode) state.mode = settings.mode;
        if (settings.appearance) state.appearance = settings.appearance;
        if (settings.syncScroll !== undefined) state.syncScroll = settings.syncScroll;
        if (settings.sidebarOpen !== undefined) state.sidebarOpen = settings.sidebarOpen;
        if (settings.splitRatio !== undefined) state.splitRatio = settings.splitRatio;
        if (settings.typography) {
            state.typography = Object.assign(state.typography, settings.typography);
        }

        // Apply settings
        setTheme(state.theme);
        applyAppearance();
        applyTypography();

        // Update UI controls to reflect settings
        var syncBtn = document.getElementById('sync-scroll-btn');
        if (syncBtn) syncBtn.classList.toggle('active', state.syncScroll);
        applyTOCVisibility();

        // Restore typography controls
        var fsr = document.getElementById('font-size-range');
        if (fsr) { fsr.value = state.typography.fontSize; document.getElementById('font-size-val').textContent = state.typography.fontSize + 'px'; }
        var lhr = document.getElementById('line-height-range');
        if (lhr) { lhr.value = state.typography.lineHeight; document.getElementById('line-height-val').textContent = state.typography.lineHeight; }
        var mwr = document.getElementById('max-width-range');
        if (mwr) { mwr.value = state.typography.maxWidth; document.getElementById('max-width-val').textContent = state.typography.maxWidth + 'px'; }
        var ffs = document.getElementById('font-family-select');
        if (ffs && state.typography.fontFamily) ffs.value = state.typography.fontFamily;

        // Load documents from IndexedDB
        try {
            var docs = await dbGetAll();
            if (docs && docs.length > 0) {
                state.documents = docs.map(function (d) {
                    return { id: d.id, title: d.title, content: d.content, lastModified: d.lastModified, fileHandle: null, isDirty: false, lockTitle: !!d.lockTitle };
                });

                // Restore active doc
                if (settings.activeDocId && state.documents.find(function (d) { return d.id === settings.activeDocId; })) {
                    state.activeDocId = settings.activeDocId;
                } else {
                    state.activeDocId = state.documents[0].id;
                }
            }
        } catch (e) {
            console.warn('Could not load documents from IndexedDB:', e);
        }

        // If no documents, create welcome document
        if (state.documents.length === 0) {
            var doc = {
                id: generateId(),
                title: 'Welcome.md',
                content: DEFAULT_CONTENT,
                lastModified: Date.now(),
                fileHandle: null,
                isDirty: false
            };
            state.documents.push(doc);
            state.activeDocId = doc.id;
            dbPut({ id: doc.id, title: doc.title, content: doc.content, lastModified: doc.lastModified, lockTitle: doc.lockTitle });
        }

        // Load active document into editor
        var activeDoc = getActiveDocument();
        if (activeDoc) {
            setEditorValue(activeDoc.content);
        }

        // Upgrade textarea to CodeMirror for advanced code editor features.
        setupCodeEditor();
        applyAppearance();
        if (activeDoc) {
            setEditorValue(activeDoc.content);
        }

        // Setup everything
        wireEvents();
        setupDropdowns();
        setupModals();
        setupCopyButtons();
        setupPreviewAnchorNavigation();
        setupKeyboardShortcuts();
        setupEditorGutter();
        setupTypography();
        setupSyncScroll();
        setupDivider();
        setupDragDrop();
        setupUnloadGuard();

        // Apply mode
        setMode(state.mode);

        // Render tabs and preview
        renderTabs();
        updatePreview();
        updateDocStats();

        // Setup TOC tracking
        setupTOCTracking();
        refreshLayoutSoon();
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
