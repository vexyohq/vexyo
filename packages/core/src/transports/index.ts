import { connectHttp } from './http';
import { connectStdio } from './stdio';
import type { ConnectedClient, ConnectTarget } from './types';

export { connectStdio } from './stdio';
export { connectHttp } from './http';
export type {
  ConnectedClient,
  ConnectTarget,
  HttpTargetConfig,
  StdioTargetConfig,
  TransportInfo,
} from './types';

/** Connect to a target over whichever transport it declares. */
export function connectTarget(target: ConnectTarget): Promise<ConnectedClient> {
  return target.transport === 'stdio' ? connectStdio(target.stdio) : connectHttp(target.http);
}
