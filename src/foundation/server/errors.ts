export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, 'not_found', `${what} doesn't exist.`);
export const invalid = (message: string) => new ApiError(400, 'invalid', message);
