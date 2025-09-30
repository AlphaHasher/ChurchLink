/**
 * Legacy component kept intentionally empty. Sermon deletion now lives inside
 * `EditSermonDialog`. This placeholder remains so older imports fail loudly
 * during compile-time rather than at runtime.
 */

export const DeleteSermonDialog = () => {
    throw new Error('DeleteSermonDialog has been removed. Use EditSermonDialog instead.');
};

export default DeleteSermonDialog;
