import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * Marks the match Find is currently sitting on.
 *
 * Word's Find and Replace is modeless: the dialog keeps the keyboard while the
 * document stays live, and the match you are on is shown highlighted behind it.
 * A selection alone cannot do that — a browser paints the text selection only
 * in the focused element, so with the caret in the Find box the selection Find
 * had just made was invisible, which is exactly what "find does nothing" looked
 * like.
 *
 * So the range is also decorated. The decoration is cleared as soon as the
 * document changes or the search moves on, and it is not part of the document:
 * nothing here can be submitted, marked, or mistaken for formatting the
 * candidate applied.
 */

export interface SearchRange {
  from: number;
  to: number;
}

export const searchHighlightKey = new PluginKey<DecorationSet>('searchHighlight');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchHighlight: {
      /** Highlights one range, or clears the highlight with `null`. */
      setSearchHighlight: (range: SearchRange | null) => ReturnType;
    };
  }
}

export const SearchHighlight = Extension.create({
  name: 'searchHighlight',

  addCommands() {
    return {
      setSearchHighlight:
        (range) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchHighlightKey, range));
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: searchHighlightKey,

        state: {
          init: () => DecorationSet.empty,
          apply(transaction, current) {
            const range = transaction.getMeta(searchHighlightKey) as SearchRange | null | undefined;

            if (range === null) return DecorationSet.empty;
            if (range) {
              return DecorationSet.create(transaction.doc, [
                Decoration.inline(range.from, range.to, { class: 'search-match' }),
              ]);
            }

            // An edit somewhere else moves the highlight with the text; an edit
            // *through* it would leave a highlight over words nobody searched
            // for, so a changed document drops it.
            return transaction.docChanged ? DecorationSet.empty : current;
          },
        },

        props: {
          decorations(state) {
            return searchHighlightKey.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
