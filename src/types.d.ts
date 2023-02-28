import { DurableObjectNamespace } from '@cloudflare/workers-types'
import { Failure, ServiceMethod } from '@ucanto/interface'
import { ClockFollow, ClockUnfollow, ClockFollowing, ClockAdvance, ClockHead } from './capabilities.js'
import { ClockDID, EmitterDID } from './durable-clock.js'
import { EventLink } from '@alanshaw/pail/clock'

export interface Environment {
  DEBUG?: string
  PRIVATE_KEY: string
  GATEWAY_URL?: string
  BLOCK_CACHE_SIZE?: string
  CLOCK: DurableObjectNamespace
}

export interface Context {
  waitUntil (promise: Promise<void>): void
}

export interface Handler<C extends Context = Context, E extends Environment = Environment> {
  (request: Request, env: E, ctx: C): Promise<Response>
}

/**
 * Middleware is a function that returns a handler with a possibly extended
 * context object. The first generic type is the "extended context". i.e. what
 * the context looks like after the middleware is run. The second generic type
 * is the "base context", or in other words the context _required_ by the
 * middleware for it to run. The third type is the environment, which should
 * not be modified.
 */
export interface Middleware<XC extends BC, BC extends Context = Context, E extends Environment = Environment> {
  (h: Handler<XC, E>): Handler<BC, E>
}

export interface Service {
  clock: {
    follow: ServiceMethod<ClockFollow, {}, Failure>
    unfollow: ServiceMethod<ClockUnfollow, {}, Failure>
    following: ServiceMethod<ClockFollowing, Array<[ClockDID, EmitterDID[]]>, Failure>
    advance: ServiceMethod<ClockAdvance, EventLink<any>[], Failure>
    head: ServiceMethod<ClockHead, EventLink<any>[], Failure>
  }
}
