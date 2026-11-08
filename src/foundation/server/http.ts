import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import type { ApiErrorBody } from '../shared/types';
import { findUser, type User } from '../shared/users';
import { ApiError } from './errors';

export const USER_HEADER = 'x-keel-user';

/**
 * Demo identity: the client says who it is acting as via a header.
 * There is no real sign-in in this prototype — but every permission check
 * still happens here on the server against that person's role.
 */
export const identify: RequestHandler = (req, res, next) => {
  const user = findUser(req.header(USER_HEADER));
  if (!user) throw new ApiError(401, 'not_signed_in', 'Choose a person on the sign-in screen first.');
  res.locals.user = user;
  next();
};

export function currentUser(res: Response): User {
  return res.locals.user as User;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const body = (code: string, message: string): ApiErrorBody => ({ error: { code, message } });
  if (err instanceof ApiError) {
    res.status(err.status).json(body(err.code, err.message));
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json(body('invalid', 'Request body is not valid JSON.'));
    return;
  }
  console.error(err);
  res.status(500).json(body('server_error', 'Something went wrong on our side. Try again.'));
};
