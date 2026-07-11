/**
 * Shared by the live evaluation path and the Pinecone vector store so both
 * can signal "the live path isn't available" without an import cycle.
 * Consumers keep importing it from ./live, which re-exports it.
 */
export class LiveUnavailableError extends Error {}
