import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

/** Light theme tuned to match MarkdStudio's existing brand blue (#0969da). */
const brandTheme = EditorView.theme({
	'&': {
		fontSize: '14px',
		height: '100%',
		backgroundColor: 'var(--cm-bg, #ffffff)',
		color: 'var(--cm-fg, #1f2328)'
	},
	'.cm-content': {
		fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
		padding: '16px 0',
		caretColor: '#0969da'
	},
	'.cm-cursor, .cm-dropCursor': { borderLeftColor: '#0969da' },
	'&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
		backgroundColor: 'rgba(9, 105, 218, 0.15)'
	},
	'.cm-gutters': {
		backgroundColor: 'var(--cm-gutter-bg, #f6f8fa)',
		color: 'var(--cm-gutter-fg, #6e7781)',
		border: 'none'
	},
	'.cm-activeLine': { backgroundColor: 'rgba(9, 105, 218, 0.06)' },
	'.cm-activeLineGutter': { backgroundColor: 'rgba(9, 105, 218, 0.1)' },
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
