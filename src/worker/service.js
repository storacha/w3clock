import { parse } from '@ipld/dag-ucan/did'
import * as dagCBOR from '@ipld/dag-cbor'
import * as ClockCaps from '../capabilities.js'
import * as Clock from './durable-clock.js'
import { provide } from '../server/index.js'

export { createServer } from '../server/index.js'

/**
 * @template T
 * @param {{ clockNamespace: import('@cloudflare/workers-types').DurableObjectNamespace }} conf
 * @returns {import('../api.js').Service<T>}
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
          const event = /** @type {import('@web3-storage/pail/clock/api').EventLink<any>} */ (capability.nb.event)
          const blocks = filterEventBlocks(event, [...invocation.export()])
          const resource = parse(capability.with).did()
          const head = await Clock.advance(clockNamespace, resource, invocation.issuer.did(), event, blocks)
          return { ok: { head } }
        }
      ),
      head: provide(
        ClockCaps.head,
        async ({ capability }) => {
          const resource = parse(capability.with).did()
          const head = await Clock.head(clockNamespace, resource)
          return { ok: { head } }
        }
      )
    }
  }
}

/**
 * @param {import('@web3-storage/pail/clock/api').EventLink<any>} event
 * @param {import('@ucanto/interface').Block[]} blocks
 */
function filterEventBlocks (event, blocks) {
  /** @type {import('@ucanto/interface').Block<import('@web3-storage/pail/clock/api').EventView<any>>[]} */
  const filteredBlocks = []
  const cids = [event]
  while (true) {
    const cid = cids.shift()
    if (!cid) break
    const block = blocks.find(b => b.cid.equals(cid))
    if (!block) continue
    try {
      /** @type {import('@web3-storage/pail/clock/api').EventView<any>} */
      const value = dagCBOR.decode(block.bytes)
      if (!Array.isArray(value.parents)) {
        throw new Error(`invalid merkle clock event: ${cid}`)
      }
      cids.push(...value.parents)
    } catch {}
    filteredBlocks.push(block)
  }
  return filteredBlocks
}
