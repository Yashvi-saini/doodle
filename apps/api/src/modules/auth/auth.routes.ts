import {
  AppleSignInBody,
  AuthSession,
  AuthTokens,
  GoogleSignInBody,
  GuestSignInBody,
  RefreshBody,
} from '@doodle/shared';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { notImplemented } from '../../lib/errors.js';

export const authRoutes: FastifyPluginCallbackZod = (app, _options, done) => {
  app.post('/guest', { schema: { body: GuestSignInBody, response: { 200: AuthSession } } }, () => {
    throw notImplemented('Guest sign-in');
  });

  app.post(
    '/google',
    { schema: { body: GoogleSignInBody, response: { 200: AuthSession } } },
    () => {
      throw notImplemented('Google sign-in');
    },
  );

  app.post('/apple', { schema: { body: AppleSignInBody, response: { 200: AuthSession } } }, () => {
    throw notImplemented('Apple sign-in');
  });

  app.post('/refresh', { schema: { body: RefreshBody, response: { 200: AuthTokens } } }, () => {
    throw notImplemented('Token refresh');
  });

  done();
};
