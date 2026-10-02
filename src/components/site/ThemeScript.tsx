import { themeBootScript } from '@/theme/theme';

/**
 * Applies the stored colour scheme before the page paints.
 *
 * Without this the browser paints whatever `prefers-color-scheme` says, React
 * hydrates, and only then does the stored override land — a white flash on
 * every navigation for anyone who chose dark, which is the single most
 * noticeable thing a theme switch can get wrong.
 *
 * It is rendered as the first child of `<body>` and runs synchronously there,
 * before any of the markup after it is parsed. `dangerouslySetInnerHTML` is
 * the only way to emit an inline script from JSX; the content is built in
 * `themeBootScript()` from this app's own constants, with nothing from a
 * request, a user or a database anywhere near it.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />;
}
