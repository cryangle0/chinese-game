export * from './HostBridge';
export * from './HostMessenger';
export * from './HostTypes';
export * from './LaunchContext';
export * from './WebHostAdapter';

import { WebHostAdapter } from './WebHostAdapter';

export const hostAdapter = new WebHostAdapter();
