import {
  type AckResult,
  type ClientEventName,
  clientEvents,
  type ClientPayload,
  type ErrorBody,
} from '@doodle/shared';
import type { z } from 'zod';
import { toErrorBody } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import type { GameSocket } from './types.js';

type EventDef<E extends ClientEventName> = (typeof clientEvents)[E];

export type AckData<E extends ClientEventName> =
  EventDef<E> extends { ack: infer A extends z.ZodType } ? z.infer<A> : void;

type Listener = (payload: unknown, ack: unknown) => void;
interface UntypedSocket {
  on(event: string, listener: Listener): void;
}

export function handle<E extends ClientEventName>(
  socket: GameSocket,
  logger: Logger,
  event: E,
  handler: (payload: ClientPayload<E>) => Promise<AckData<E>>,
): void {
  const schema: z.ZodType = clientEvents[event].payload;
  const log = logger.child({ event, userId: socket.data.user.userId });

  const run = async (raw: unknown, ack: unknown) => {
    const reply = typeof ack === 'function' ? (ack as (result: AckResult<unknown>) => void) : null;
    const fail = (error: ErrorBody) => {
      if (reply) {
        reply({ ok: false, error });
      } else {
        socket.emit('server:error', error);
      }
    };

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      fail({ code: 'VALIDATION', message: 'Invalid payload', details: parsed.error.issues });
      return;
    }

    try {
      const data = await handler(parsed.data as ClientPayload<E>);
      reply?.({ ok: true, data });
    } catch (error) {
      fail(toErrorBody(error, log));
    }
  };

  (socket as unknown as UntypedSocket).on(event, (raw, ack) => {
    void run(raw, ack);
  });
}
