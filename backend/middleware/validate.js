/**
 * Zod request body validation middleware factory.
 * Validates req.body against the given schema.
 * On success, replaces req.body with the parsed + coerced data.
 * On failure, returns 400 with field-level errors.
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };
}
