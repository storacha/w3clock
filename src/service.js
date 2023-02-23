import * as Server from '@ucanto/server'
import * as ClockCapability from './capabilities.js'
import * as Clock from './durable-clock.js'

/**
 * @param {{ clockNamespace: import('@cloudflare/workers-types').DurableObjectNamespace }} conf
 */
export function service ({ clockNamespace }) {
  return {
    clock: {
      follow: Server.provide(
        ClockCapability.follow,
        async ({ capability, invocation }) => {
          const clock = capability.with
          const target = capability.nb.clk ?? capability.with
          const emitter = capability.nb.iss ?? invocation.issuer.did()
          // @ts-expect-error
          return await Clock.follow(clockNamespace, clock, target, emitter)
        }
      ),
      unfollow: Server.provide(
        ClockCapability.unfollow,
        async ({ capability, invocation }) => {
          const clock = capability.with
          const target = capability.nb.clk ?? capability.with
          const emitter = capability.nb.iss ?? invocation.issuer.did()
          // @ts-expect-error
          return await Clock.unfollow(clockNamespace, clock, target, emitter)
        }
      ),
      following: Server.provide(
        ClockCapability.following,
        async ({ capability }) => {
          // @ts-expect-error
          return await Clock.following(clockNamespace, capability.with)
        }
      ),
      advance: Server.provide(
        ClockCapability.advance,
        async ({ capability }) => {
          // @ts-expect-error
          return await Clock.advance(clockNamespace, capability.with, capability.nb.event)
        }
      ),
      head: Server.provide(
        ClockCapability.head,
        async ({ capability }) => {
          // @ts-expect-error
          return await Clock.head(clockNamespace, capability.with)
        }
      )
    }
  }
}
