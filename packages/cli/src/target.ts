import type { ConnectTarget } from '@vexyo/core';
import type { Config } from './config';

/** Map the validated config's target onto the core engine's {@link ConnectTarget}. */
export function buildTarget(config: Config): ConnectTarget {
  if (config.target.transport === 'http') {
    return {
      transport: 'http',
      http: { url: config.target.url, headers: config.target.headers },
    };
  }
  return { transport: 'stdio', stdio: config.target };
}
