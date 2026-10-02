import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import type { InkStroke } from '../ink';
import { DrawingCanvasView } from '@/components/document/DrawingCanvasView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    drawingCanvas: {
      insertDrawingCanvas: () => ReturnType;
    };
  }
}

/**
 * Word's Drawing Canvas: a block the Draw tab's pens write into.
 *
 * Ink is a node in the document rather than an overlay over the page, and that
 * is the whole design. The answer a candidate submits is the document's JSON,
 * so a drawing that is not in the document is a drawing that is not in the
 * answer — it would survive the session and nothing else. As a node it is
 * saved, undone, copied, serialised and marked by the same machinery as every
 * other block.
 *
 * `atom: true` because its content is the strokes attribute, not child nodes:
 * the cursor must not be able to get inside it, and Backspace at its edge must
 * remove the canvas rather than one stroke of it.
 */
export const DrawingCanvas = Node.create({
  name: 'drawingCanvas',
  group: 'block',
  atom: true,
  draggable: false,
  selectable: true,

  addAttributes() {
    return {
      strokes: {
        default: [] as InkStroke[],
        // Stored as a JSON string in the DOM so a canvas survives a copy to
        // the clipboard and back, where only attributes travel.
        parseHTML: (element) => {
          try {
            const raw = element.getAttribute('data-strokes');
            return raw ? (JSON.parse(raw) as InkStroke[]) : [];
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => ({ 'data-strokes': JSON.stringify(attributes.strokes ?? []) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-drawing-canvas]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-drawing-canvas': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawingCanvasView);
  },

  addCommands() {
    return {
      insertDrawingCanvas:
        () =>
        ({ commands, state }) =>
          /*
           * Explicitly *after* the selection, never over it.
           *
           * A canvas is an atom, so clicking one selects the node — and
           * `insertContent` replaces the selection, which meant that inserting
           * a second canvas deleted the first one and every stroke in it. The
           * candidate's drawing is their answer; Insert must never be a way to
           * lose it.
           */
          commands.insertContentAt(state.selection.to, { type: this.name, attrs: { strokes: [] } }),
    };
  },
});
