import * as Server from '@ucanto/server'
import * as CAR from '@ucanto/transport/car'
import * as CBOR from '@ucanto/transport/cbor'
import * as ClockCaps from '../capabilities.js'
import * as Clock from './durable-clock.js'

/**
 * @template T
 * @param {Server.Verifier} signer
 * @param {import('../service').Service<T>} service
 */
export function createServer (signer, service) {
  return Server.create({
    id: signer,
    encoder: CBOR,
    decoder: CAR,
    service,
    catch: err => console.error(err)
  })
}

/**
 * @template T
 * @param {{ clockNamespace: import('@cloudflare/workers-types').DurableObjectNamespace }} conf
 * @returns {import('../service').Service<T>}
 */
export function createService ({ clockNamespace }) {
  return {
    clock: {
      follow: Server.provide(
        ClockCaps.follow,
        async ({ capability, invocation }) => {
          const clock = capability.with
          const target = capability.nb.with ?? capability.with
          const emitter = capability.nb.iss ?? invocation.issuer.did()
          // @ts-expect-error
          await Clock.follow(clockNamespace, clock, target, emitter)
          return {}
        }
      ),
      unfollow: Server.provide(
        ClockCaps.unfollow,
        async ({ capability, invocation }) => {
          const clock = capability.with
          const target = capability.nb.with ?? capability.with
          const emitter = capability.nb.iss ?? invocation.issuer.did()
          // @ts-expect-error
          await Clock.unfollow(clockNamespace, clock, target, emitter)
          return {}
        }
      ),
      following: Server.provide(
        ClockCaps.following,
        async ({ capability }) => {
          // @ts-expect-error
          const followings = await Clock.following(clockNamespace, capability.with)
          return [...followings.entries()].map(([k, v]) => [k, [...v.values()]])
        }
      ),
      advance: Server.provide(
        ClockCaps.advance,
        async ({ capability }) => {
          // @ts-expect-error
          return await Clock.advance(clockNamespace, capability.with, capability.nb.event)
        }
      ),
      head: Server.provide(
        ClockCaps.head,
        async ({ capability }) => {
          // @ts-expect-error
          return await Clock.head(clockNamespace, capability.with)
        }
      )
    }
  }
}
