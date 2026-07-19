import type { Rule } from '../../rule';

import { serverInfoName } from './init/server-info-name';
import { serverInfoVersion } from './init/server-info-version';

import { toolsListAvailable } from './discovery/tools-list';
import { toolsHaveNames } from './discovery/tools-have-names';
import { toolsHaveInputSchema } from './discovery/tools-have-input-schema';
import { toolNamesUnique } from './discovery/tool-names-unique';
import { resourcesListAvailable } from './discovery/resources-list';
import { resourcesHaveUri } from './discovery/resources-have-uri';
import { promptsListAvailable } from './discovery/prompts-list';
import { promptsHaveNames } from './discovery/prompts-have-names';

import { unknownMethod } from './errors/unknown-method';
import { unknownTool } from './errors/unknown-tool';
import { toolInvalidParams } from './errors/tool-invalid-params';
import { unknownResource } from './errors/unknown-resource';
import { errorObjectShape } from './errors/error-object-shape';

import { httpSessionIdValid } from './transport/http-session-id-valid';

// Re-export individual rules so fixture-pair tests can reference them by name.
export {
  serverInfoName,
  serverInfoVersion,
  toolsListAvailable,
  toolsHaveNames,
  toolsHaveInputSchema,
  toolNamesUnique,
  resourcesListAvailable,
  resourcesHaveUri,
  promptsListAvailable,
  promptsHaveNames,
  unknownMethod,
  unknownTool,
  toolInvalidParams,
  unknownResource,
  errorObjectShape,
  httpSessionIdValid,
};

/** All rules for spec version 2025-11-25, in reporting order. */
export const rules2025_11_25: readonly Rule[] = [
  // initialization
  serverInfoName,
  serverInfoVersion,
  // discovery
  toolsListAvailable,
  toolsHaveNames,
  toolsHaveInputSchema,
  toolNamesUnique,
  resourcesListAvailable,
  resourcesHaveUri,
  promptsListAvailable,
  promptsHaveNames,
  // error-semantics
  unknownMethod,
  unknownTool,
  toolInvalidParams,
  unknownResource,
  errorObjectShape,
  // transport
  httpSessionIdValid,
];
