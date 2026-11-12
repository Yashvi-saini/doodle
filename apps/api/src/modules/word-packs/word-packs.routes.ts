import {
  AddWordsBody,
  CreateWordPackBody,
  IdParams,
  ListWordPacksQuery,
  UpdateWordPackBody,
  WordPackDetail,
  WordPackList,
} from '@doodle/shared';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { notImplemented } from '../../lib/errors.js';
import type { WordPackService } from './word-packs.service.js';

export const wordPackRoutes: FastifyPluginCallbackZod<{ service: WordPackService }> = (
  app,
  { service },
  done,
) => {
  app.get(
    '/',
    { schema: { querystring: ListWordPacksQuery, response: { 200: WordPackList } } },
    (request) => service.list(request.query),
  );

  app.get('/:id', { schema: { params: IdParams, response: { 200: WordPackDetail } } }, (request) =>
    service.get(request.params.id),
  );

  app.post('/', { schema: { body: CreateWordPackBody, response: { 201: WordPackDetail } } }, () => {
    throw notImplemented('Creating word packs');
  });

  app.patch(
    '/:id',
    { schema: { params: IdParams, body: UpdateWordPackBody, response: { 200: WordPackDetail } } },
    () => {
      throw notImplemented('Updating word packs');
    },
  );

  app.delete('/:id', { schema: { params: IdParams } }, () => {
    throw notImplemented('Deleting word packs');
  });

  app.post(
    '/:id/words',
    { schema: { params: IdParams, body: AddWordsBody, response: { 200: WordPackDetail } } },
    () => {
      throw notImplemented('Adding words');
    },
  );

  done();
};
