/**
 * Shared by the live evaluation path and its collaborators so all of them
 * can signal "the live path isn't available" without an import cycle.
 * Consumers keep importing it from ./live, which re-exports it.
 */
export class LiveUnavailableError extends Error {}
