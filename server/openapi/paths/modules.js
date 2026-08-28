import { jsonBody, op, stringPathParam } from '../helpers.js';

export function modulesPaths() {
  return {
    '/api/v1/modules': {
      get: op({
        summary: 'List installed extension modules',
        tag: 'Modules',
        description: 'Returns discovered third-party modules from the modules directory, including normalized capabilities (widgets, permissions, API prefix) when declared in module.json. Pass `admin=1` as an admin to include disabled and errored modules.',
        responses: {
          200: {
            description: 'Extension modules',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ModulesListResponse' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/InternalServerError' },
        },
      }),
    },
    '/api/v1/modules/{id}': {
      patch: op({
        summary: 'Enable or disable an extension module',
        tag: 'Modules',
        admin: true,
        params: [stringPathParam('id', 'Module ID')],
        stateChanging: true,
        requestBody: jsonBody('#/components/schemas/ModuleEnableRequest'),
        responses: {
          200: {
            description: 'Updated module',
            content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/ExtensionModule' } }, required: ['data'] } } },
          },
          400: { description: 'Invalid request' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { description: 'Module not found' },
          500: { $ref: '#/components/responses/InternalServerError' },
        },
      }),
    },
    '/api/v1/modules/assets/{id}/{assetPath}': {
      get: op({
        summary: 'Get protected extension module asset',
        tag: 'Modules',
        params: [
          stringPathParam('id', 'Module ID'),
          stringPathParam('assetPath', 'Asset path within the module'),
        ],
        responses: {
          200: { description: 'Module asset (JavaScript or CSS)' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { description: 'Module or asset not found' },
          500: { $ref: '#/components/responses/InternalServerError' },
        },
      }),
    },
    '/api/v1/extensions/{moduleId}/{rest}': {
      get: op({
        summary: 'Proxy extension sidecar API (optional)',
        tag: 'Modules',
        description: 'Forwards to a sidecar upstream when `EXTENSION_PROXY_TARGETS` maps the module id to a base URL. Requires module access (`ext:<module-id>`) or a matching API token scope. Direct Traefik routing to `/api/extensions/<module-id>` remains supported without this proxy.',
        params: [
          stringPathParam('moduleId', 'Extension module ID'),
          stringPathParam('rest', 'Path suffix forwarded to the sidecar'),
        ],
        responses: {
          200: { description: 'Upstream response (pass-through)' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { description: 'Extension module not found or not enabled' },
          502: { description: 'Proxy target not configured or upstream unavailable' },
          500: { $ref: '#/components/responses/InternalServerError' },
        },
      }),
    },
  };
}
