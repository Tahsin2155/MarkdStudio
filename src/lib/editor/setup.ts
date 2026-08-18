import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

/**
 * Theme tuned to match MarkdStudio's existing brand blue (--brand,
 * #0969da in light mode). Deliberately reads from the app's real CSS
 * custom properties (--bg, --fg, --bg-muted, --fg-muted, --brand — all
 * defined in app.css, themed for light/dark there) rather than a
 * separate --cm-* var namespace: an earlier version of this file used
 * `var(--cm-bg, #ffffff)`-style fallbacks that LOOKED themeable but
 * pointed at custom properties nothing ever actually defined, so every
 * one of them silently fell through to its hardcoded light-only
 * fallback in both themes — the editor pane (the primary place someone
 * actually types) never changed with dark mode at all. Caught by
 * grep-sweeping every component for hardcoded hex after a screenshot
 * surfaced a similar, smaller version of this same bug in the landing
 * page's hero mockup.
 *
 * Note: EditorView.theme() accepts a second { dark: boolean } option
 * that tells CodeMirror's own darkTheme facet whether a dark theme is
 * active — some CodeMirror extensions branch on that facet internally.
 * Not passed here since none of the extensions this app currently uses
 * (lineNumbers, highlightActiveLine, highlightActiveLineGutter, history,
 * the markdown language package) read it, confirmed by grepping for
 * `darkTheme` across this app's own code and the codemirror packages it
 * depends on directly. Worth revisiting if a future extension is added
 * that does care — right now CodeMirror always believes it's in a light
 * theme regardless of the page's actual theme, which is harmless today
 * but not strictly correct.
 */
const brandTheme = EditorView.theme({
	'&': {
		fontSize: '14px',
		height: '100%',
		backgroundColor: 'var(--bg)',
		color: 'var(--fg)'
	},
	'.cm-content': {
		fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
		padding: '16px 0',
		caretColor: 'var(--brand)'
	},
	'.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--brand)' },
	// These previously used a fixed rgba(9, 105, 218, ...) — the light-mode
	// brand blue's RGB values hardcoded directly, with no theme awareness
	// at all (not even the broken var(--cm-*) pattern the rest of this
	// theme had). Selection/active-line highlights need to stay visible
	// against both a white and a near-black background, so a translucent
	// wash of --brand only works if --brand itself changes with theme
	// (it does, see app.css) AND the opacity is low enough not to fight
	// either background — kept the same opacity values as before since
	// they were already tuned reasonably for this purpose, just swapped
	// the fixed color for the themed one.
	'&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
		backgroundColor: 'color-mix(in srgb, var(--brand) 15%, transparent)'
	},
	'.cm-gutters': {
		backgroundColor: 'var(--bg-muted)',
		color: 'var(--fg-muted)',
		border: 'none'
	},
	'.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--brand) 6%, transparent)' },
	'.cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--brand) 10%, transparent)' },
	'&.cm-editor.cm-focused': { outline: 'none' }
});

export function createEditorExtensions(onChange: (value: string) => void): Extension[] {
	return [
		lineNumbers(),
		highlightActiveLine(),
		highlightActiveLineGutter(),
		history(),
		keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
		markdown({ base: markdownLanguage, codeLanguages: languages }),
		brandTheme,
		EditorView.lineWrapping,
		EditorView.updateListener.of((update) => {
			if (update.docChanged) {
				onChange(update.state.doc.toString());
			}
		})
	];
}

export function createEditorState(doc: string, onChange: (value: string) => void): EditorState {
	return EditorState.create({
		doc,
		extensions: createEditorExtensions(onChange)
	});
}
