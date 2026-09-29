// Express 4 doesn't forward a rejected promise to error-handling middleware
// on its own — wrap every async route handler with this so a thrown/rejected
// error becomes a proper next(err) instead of a hung request.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
