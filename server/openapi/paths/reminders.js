import { op, jsonBody, idParam } from '../helpers.js';

export function remindersPaths() {
  return {
    '/api/v1/reminders/pending': { get: op({ summary: 'List pending reminders', tag: 'Reminders' }) },
    '/api/v1/reminders/all': { get: op({ summary: 'List all reminders for an entity', tag: 'Reminders', description: 'Returns every non-dismissed reminder for the given entity (calendar events support multiple reminders).' }) },
    '/api/v1/reminders': {
      get: op({ summary: 'List reminders', tag: 'Reminders' }),
      post: op({ summary: 'Create reminder', tag: 'Reminders', stateChanging: true, requestBody: jsonBody(null), description: 'Reminders for `subscription`, `inventory_item`, `inventory_tracked_date` and `pantry_item` are derived from the item itself: the module rewrites them on every change, so setting one here would not survive. Those types are rejected with 400; reading and dismissing them works as for any other reminder.' }),
      put: op({ summary: 'Replace reminder set for an entity', tag: 'Reminders', stateChanging: true, requestBody: jsonBody(null), description: 'Replaces all reminders of an entity with the given `remind_ats` list (deduplicated, max 5). Reminders for `subscription`, `inventory_item`, `inventory_tracked_date` and `pantry_item` are derived from the item itself: the module rewrites them on every change, so setting one here would not survive. Those types are rejected with 400; reading and dismissing them works as for any other reminder.' }),
      delete: op({ summary: 'Delete reminders by filter', tag: 'Reminders', stateChanging: true }),
    },
    '/api/v1/reminders/{id}/dismiss': {
      patch: op({ summary: 'Dismiss reminder', tag: 'Reminders', params: [idParam()], stateChanging: true }),
    },
    '/api/v1/reminders/{id}': {
      delete: op({ summary: 'Delete reminder', tag: 'Reminders', params: [idParam()], stateChanging: true }),
    },
  };
}
