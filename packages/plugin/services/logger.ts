interface LogEntry {
  level: 'info' | 'error' | 'warn' | 'debug';
  message: string;
  timestamp: number;
  details?: string;
}

/**
 * Safely stringify objects, handling circular references
 */
function safeStringify(obj: any, maxDepth = 3): string {
  const seen = new WeakSet<object>();
  return safeStringifyInternal(obj, seen, maxDepth, 0);
}

/**
 * Internal function to handle circular references by tracking seen objects
 */
function safeStringifyInternal(obj: any, seen: WeakSet<object>, maxDepth: number, currentDepth: number): string {
  if (currentDepth > maxDepth) {
    return '[Max Depth Reached]';
  }

  // Handle primitives
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);

  // Handle functions
  if (typeof obj === 'function') {
    return `[Function: ${obj.name || 'anonymous'}]`;
  }

  // Handle objects
  if (typeof obj === 'object') {
    // Check for circular reference
    if (seen.has(obj)) {
      return '[Circular Reference]';
    }

    // Add to seen set
    seen.add(obj);

    try {
      // Try regular JSON.stringify first (fast path for non-circular objects)
      return JSON.stringify(obj);
    } catch (error: any) {
      // If JSON.stringify fails, use custom handler
      try {
        // Handle arrays
        if (Array.isArray(obj)) {
          const items = obj.slice(0, 10).map(item =>
            safeStringifyInternal(item, seen, maxDepth, currentDepth + 1)
          );
          const suffix = obj.length > 10 ? ` ... (${obj.length - 10} more)` : '';
          return `[${items.join(', ')}${suffix}]`;
        }

        // Handle plain objects
        const keys = Object.keys(obj).slice(0, 10);
        const pairs = keys.map(key => {
          const value = safeStringifyInternal(obj[key], seen, maxDepth, currentDepth + 1);
          return `"${key}": ${value}`;
        });
        const suffix = Object.keys(obj).length > 10 ? ` ... (${Object.keys(obj).length - 10} more keys)` : '';
        return `{${pairs.join(', ')}${suffix}}`;
      } catch (innerError: any) {
        return `[Object: ${obj.constructor?.name || 'Object'}]`;
      }
    }
  }

  return String(obj);
}

class LoggerService {
  private isEnabled = false;
  private logs: LogEntry[] = [];
  private maxLogs = 100; // Keep last 100 logs

  configure(enabled: boolean) {
    this.isEnabled = enabled;
  }

  private addLog(level: LogEntry['level'], message: string, details?: string) {
    if (!this.isEnabled) return;

    this.logs.push({
      level,
      message,
      timestamp: Date.now(),
      details,
    });

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  info(...messages: any[]) {
    const message = messages.map(m => typeof m === 'string' ? m : safeStringify(m)).join(' ');
    this.addLog('info', message);
    console.info(...messages);
  }

  error(...messages: any[]) {
    const message = messages.map(m => typeof m === 'string' ? m : safeStringify(m)).join(' ');
    this.addLog('error', message);
    console.error(...messages);
  }

  warn(...messages: any[]) {
    const message = messages.map(m => typeof m === 'string' ? m : safeStringify(m)).join(' ');
    this.addLog('warn', message);
    console.warn(...messages);
  }

  debug(...messages: any[]) {
    const message = messages.map(m => typeof m === 'string' ? m : safeStringify(m)).join(' ');
    this.addLog('debug', message);
    console.debug(...messages);
  }

  getLogs(): LogEntry[] {
    return [...this.logs]; // Return a copy to prevent mutation
  }

  clearLogs() {
    this.logs = [];
  }
}

export const logger = new LoggerService();