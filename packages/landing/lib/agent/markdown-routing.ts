import { prefersMarkdown } from './accept';
import {
  buildDevelopersMarkdown,
  buildHomeMarkdown,
  buildNotFoundMarkdown,
} from './markdown-content';
import { isKnownPagePath } from './routes';

export type AgentMarkdownRouteResult =
  | { action: 'continue' }
  | { action: 'respond'; body: string; status: number };

export function resolveAgentMarkdownRoute(
  pathname: string,
  acceptHeader: string | null
): AgentMarkdownRouteResult {
  if (!prefersMarkdown(acceptHeader)) {
    return { action: 'continue' };
  }

  if (pathname === '/') {
    return { action: 'respond', body: buildHomeMarkdown(), status: 200 };
  }

  if (pathname === '/developers') {
    return {
      action: 'respond',
      body: buildDevelopersMarkdown(),
      status: 200,
    };
  }

  if (!isKnownPagePath(pathname)) {
    return {
      action: 'respond',
      body: buildNotFoundMarkdown(pathname),
      status: 404,
    };
  }

  return { action: 'continue' };
}
