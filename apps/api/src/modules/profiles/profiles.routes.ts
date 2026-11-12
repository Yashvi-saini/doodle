import { Profile, PublicProfile, UpdateProfileBody, UsernameParams } from '@doodle/shared';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { notImplemented } from '../../lib/errors.js';

export const profileRoutes: FastifyPluginCallbackZod = (app, _options, done) => {
  app.get('/me', { schema: { response: { 200: Profile } } }, () => {
    throw notImplemented('Reading your profile');
  });

  app.patch('/me', { schema: { body: UpdateProfileBody, response: { 200: Profile } } }, () => {
    throw notImplemented('Updating your profile');
  });

  app.get(
    '/users/:username',
    { schema: { params: UsernameParams, response: { 200: PublicProfile } } },
    () => {
      throw notImplemented('Public profiles');
    },
  );

  done();
};
