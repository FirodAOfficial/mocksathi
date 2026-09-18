'use client';

import { useEditorState, type Editor } from '@tiptap/react';
import type { CapsMode } from './extensions/CharacterFormat';
import type { UnderlineStyle } from './functions/underline';
import type { NormalizedStyleId, ParagraphBorders, TextAlignment } from '@/services/document/types';
import { DEFAULT_FONT_SIZE_PT, currentFontSize, currentParagraphStyle } from './ribbonActions';

/** Everything the ribbon and status bar need in order to render themselves. */
export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  /** Which line the underline drop-down drew, for the button's active style. */
  underlineStyle: UnderlineStyle;
  underlineColor: string | null;
  strike: boolean;
  doubleStrike: boolean;
  caps: CapsMode | null;
  hidden: boolean;
  subscript: boolean;
  superscript: boolean;
  bulletList: boolean;
  orderedList: boolean;
  align: TextAlignment;
  style: NormalizedStyleId;
  fontFamily: string | null;
  fontSize: number;
  color: string | null;
  highlight: string | null;
  lineHeight: number | null;
  lineSpacingMode: 'multiple' | 'atLeast' | 'exactly' | null;
  lineSpacingPt: number | null;
  indentLeft: number | null;
  indentRight: number | null;
  indentFirstLine: number | null;
  spaceBefore: number | null;
  spaceAfter: number | null;
  contextualSpacing: boolean;
  borders: ParagraphBorders | null;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  words: number;
  characters: number;
}

const INITIAL_STATE: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  underlineStyle: 'single',
  underlineColor: null,
  strike: false,
  doubleStrike: false,
  caps: null,
  hidden: false,
  subscript: false,
  superscript: false,
  bulletList: false,
  orderedList: false,
  align: 'left',
  style: 'Normal',
  fontFamily: null,
  fontSize: DEFAULT_FONT_SIZE_PT,
  color: null,
  highlight: null,
  lineHeight: null,
  lineSpacingMode: null,
  lineSpacingPt: null,
  indentLeft: null,
  indentRight: null,
  indentFirstLine: null,
  spaceBefore: null,
  spaceAfter: null,
  contextualSpacing: false,
  borders: null,
  canUndo: false,
  canRedo: false,
  hasSelection: false,
  words: 0,
  characters: 0,
};

interface CharacterCountStorage {
  words: () => number;
  characters: () => number;
}

/**
 * Derives ribbon state from the editor.
 *
 * `useEditorState` subscribes to transactions and re-renders only when the
 * selected slice actually changes, which matters here: a naive subscription
 * would re-render the entire ribbon on every keystroke.
 */
export function useFormatState(editor: Editor | null): FormatState {
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }): FormatState => {
      if (!instance) return INITIAL_STATE;

      const textStyle = instance.getAttributes('textStyle');
      const underline = instance.getAttributes('underline');
      const blockAttributes = instance.isActive('heading')
        ? instance.getAttributes('heading')
        : instance.getAttributes('paragraph');
      const counter = instance.storage.characterCount as CharacterCountStorage | undefined;

      const alignment: TextAlignment = instance.isActive({ textAlign: 'center' })
        ? 'center'
        : instance.isActive({ textAlign: 'right' })
          ? 'right'
          : instance.isActive({ textAlign: 'justify' })
            ? 'justify'
            : 'left';

      return {
        bold: instance.isActive('bold'),
        italic: instance.isActive('italic'),
        underline: instance.isActive('underline'),
        underlineStyle: (underline.style as UnderlineStyle | null) ?? 'single',
        underlineColor: typeof underline.color === 'string' ? underline.color : null,
        strike: instance.isActive('strike'),
        doubleStrike: textStyle.doubleStrike === true,
        caps: (textStyle.caps as CapsMode | undefined) ?? null,
        hidden: textStyle.hidden === true,
        subscript: instance.isActive('subscript'),
        superscript: instance.isActive('superscript'),
        bulletList: instance.isActive('bulletList'),
        orderedList: instance.isActive('orderedList'),
        align: alignment,
        style: currentParagraphStyle(instance),
        fontFamily: typeof textStyle.fontFamily === 'string' ? textStyle.fontFamily : null,
        fontSize: currentFontSize(instance),
        color: typeof textStyle.color === 'string' ? textStyle.color : null,
        highlight: (instance.getAttributes('highlight').color as string | undefined) ?? null,
        lineHeight: typeof blockAttributes.lineHeight === 'number' ? blockAttributes.lineHeight : null,
        lineSpacingMode: (blockAttributes.lineSpacingMode as FormatState['lineSpacingMode']) ?? null,
        lineSpacingPt: typeof blockAttributes.lineSpacingPt === 'number' ? blockAttributes.lineSpacingPt : null,
        indentLeft: typeof blockAttributes.indentLeft === 'number' ? blockAttributes.indentLeft : null,
        indentRight: typeof blockAttributes.indentRight === 'number' ? blockAttributes.indentRight : null,
        indentFirstLine:
          typeof blockAttributes.indentFirstLine === 'number' ? blockAttributes.indentFirstLine : null,
        spaceBefore: typeof blockAttributes.spaceBefore === 'number' ? blockAttributes.spaceBefore : null,
        spaceAfter: typeof blockAttributes.spaceAfter === 'number' ? blockAttributes.spaceAfter : null,
        contextualSpacing: blockAttributes.contextualSpacing === true,
        borders: (blockAttributes.borders as ParagraphBorders | null) ?? null,
        canUndo: instance.can().undo(),
        canRedo: instance.can().redo(),
        hasSelection: !instance.state.selection.empty,
        words: counter?.words() ?? 0,
        characters: counter?.characters() ?? 0,
      };
    },
  });

  return state ?? INITIAL_STATE;
}
