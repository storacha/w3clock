import * as ClockCaps from '../capabilities.js'
import * as Clock from './durable-clock.js'
import { provide } from '../server/index.js'

export { createServer } from '../server/index.js'

/**
 * @template T
 * @param {{ clockNamespace: import('@cloudflare/workers-types').DurableObjectNamespace }} conf
 * @returns {import('../service').Service<T>}
 */
export function createService ({ clockNamespace }) {
  return {
    clock: {
      // follow: provide(
      //   ClockCaps.follow,
      //   async ({ capability, invocation }) => {
      //     const clock = capability.with
      //     const target = capability.nb.with ?? capability.with
      //     const emitter = capability.nb.iss ?? invocation.issuer.did()
      //     // @ts-expect-error
      //     await Clock.follow(clockNamespace, clock, target, emitter)
      //     return {}
      //   }
      // ),
      // unfollow: provide(
      //   ClockCaps.unfollow,
      //   async ({ capability, invocation }) => {
      //     const clock = capability.with
      //     const target = capability.nb.with ?? capability.with
      //     const emitter = capability.nb.iss ?? invocation.issuer.did()
      //     // @ts-expect-error
      //     await Clock.unfollow(clockNamespace, clock, target, emitter)
      //     return {}
      //   }
      // ),
      // following: provide(
      //   ClockCaps.following,
      //   async ({ capability }) => {
      //     // @ts-expect-error
      //     const followings = await Clock.following(clockNamespace, capability.with)
      //     return [...followings.entries()].map(([k, v]) => [k, [...v.values()]])
      //   }
      // ),
      advance: provide(
        ClockCaps.advance,
        async ({ capability, invocation }) => {
          // @ts-expect-error
          return await Clock.advance(clockNamespace, capability.with, invocation.issuer.did(), capability.nb.event)
        }
      ),
      head: provide(
        ClockCaps.head,
        async ({ capability }) => {
          // @ts-expect-error
          return await Clock.head(clockNamespace, capability.with)
        }
      )
    }
  }
}
