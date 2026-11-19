// Numbers the server and the phone must agree on. The SQL migration states the first one too.

/** A change larger than this, as JSON, is rejected for good. */
export const MAX_CHANGE_BYTES = 65536;
/** Ops per pull. A full page means there may be more. */
export const PULL_PAGE_SIZE = 500;
/** Ops per push. */
export const PUSH_BATCH_SIZE = 50;
