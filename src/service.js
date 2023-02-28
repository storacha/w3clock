import * as Server from '@ucanto/server'
import * as ClockCaps from './capabilities.js'
import * as Clock from './durable-clock.js'

/**
 * @param {{ clockNamespace: import('@cloudflare/workers-types').DurableObjectNamespace }} conf
 * @returns {import('./types').Service}
 */
export function service ({ clockNamespace }) {
  return {
    clock: {
      follow: Server.provide(
        ClockCaps.follow,
        async ({ capability, invocation }) => {
          const clock = capability.with
          const target = capability.nb.clk ?? capability.with
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
          const target = capability.nb.clk ?? capability.with
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
