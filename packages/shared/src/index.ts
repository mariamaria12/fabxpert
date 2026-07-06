// Public entry point for @fabxpert/shared — DTOs, enums, types, Zod schemas,
// utility functions, and the API client layer.
// See docs/architecture.md — packages/shared section — for what goes here.

export { ApiError, configureApiClient } from './api/client';
export { getMe, login, logout } from './api/auth';
export type { MeResponse } from './api/auth';
