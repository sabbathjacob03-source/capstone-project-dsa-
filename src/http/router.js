import { DomainError } from '../domain/errors.js';

function parsePattern(pattern) {
  if (typeof pattern !== 'string' || !pattern.startsWith('/')) {
    throw new DomainError('VALIDATION', 'Route paths must start with "/"');
  }
  if (pattern !== '/' && pattern.endsWith('/')) {
    throw new DomainError('VALIDATION', 'Route paths must not end with "/"');
  }

  return pattern === '/' ? [] : pattern.slice(1).split('/').map((segment) => {
    if (segment.startsWith(':')) {
      const name = segment.slice(1);
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
        throw new DomainError('VALIDATION', `Invalid route parameter: ${segment}`);
      }
      return { parameter: name };
    }
    return { literal: segment };
  });
}

export class Router {
  #routes = [];

  add(method, pattern, handler) {
    if (typeof method !== 'string' || method.trim() === '') {
      throw new DomainError('VALIDATION', 'Route method is required');
    }
    if (typeof handler !== 'function') {
      throw new DomainError('VALIDATION', 'Route handler must be a function');
    }
    const normalizedMethod = method.toUpperCase();
    const segments = parsePattern(pattern);
    this.#routes.push({ method: normalizedMethod, segments, handler });
    return this;
  }

  match(method, pathname) {
    if (typeof method !== 'string' || typeof pathname !== 'string' || !pathname.startsWith('/')) {
      return undefined;
    }
    const actualSegments = pathname === '/' ? [] : pathname.slice(1).split('/');

    for (const route of this.#routes) {
      if (route.method !== method.toUpperCase() || route.segments.length !== actualSegments.length) {
        continue;
      }

      const params = {};
      let matched = true;
      for (let index = 0; index < route.segments.length; index += 1) {
        const expected = route.segments[index];
        let actual;
        try {
          actual = decodeURIComponent(actualSegments[index]);
        } catch {
          throw new DomainError('VALIDATION', 'Path contains invalid URL encoding');
        }

        if ('parameter' in expected) {
          if (actual === '') {
            matched = false;
            break;
          }
          params[expected.parameter] = actual;
        } else if (expected.literal !== actual) {
          matched = false;
          break;
        }
      }

      if (matched) return { handler: route.handler, params };
    }
    return undefined;
  }
}

export function createRouter() {
  return new Router();
}
