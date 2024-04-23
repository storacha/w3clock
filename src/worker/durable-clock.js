import * as Clock from '@web3-storage/pail/clock'
import { parse } from 'multiformats/link'
import * as cbor from '@ipld/dag-cbor'
import { GatewayBlockFetcher, LRUBlockstore, MemoryBlockstore, MultiBlockFetcher, withCache } from './block.js'

/**
 * @typedef {{ method: string, args: any[] }} MethodCall
 * @typedef {import('../service').EmitterDID} EmitterDID DID of an clock event emitter (usually an agent).
 * @typedef {import('../service').ClockDID} ClockDID DID of a merkle clock.
 * @typedef {Map<ClockDID, Set<EmitterDID>>} Followings Event emitters that this clock is following (and the associated clock DID they are contributing to).
 * @typedef {Map<ClockDID, Set<EmitterDID>>} Subscribers Clocks that want to receive advances made to this clock.
 * @typedef {'follow'|'unfollow'|'following'|'subscribe'|'unsubscribe'|'subscribers'|'advance'|'head'} DurableClockAPIMethod
 */

const KEY_FOLLOWING = 'following'
const KEY_SUBSCRIBERS = 'subscribers'
const KEY_HEAD = 'head'
/** @type {DurableClockAPIMethod[]} */
const API_METHODS = ['follow', 'unfollow', 'following', 'subscribe', 'unsubscribe', 'subscribers', 'advance', 'head']

/** @type {import('@cloudflare/workers-types').DurableObject} */
export class DurableClock {
  #state
  #fetcher
  #cache

  /**
   * @param {import('@cloudflare/workers-types').DurableObjectState} state
   * @param {import('./types').Environment} env
   */
  constructor (state, env) {
    this.#state = state
    this.#cache = new LRUBlockstore(env.BLOCK_CACHE_SIZE ? parseInt(env.BLOCK_CACHE_SIZE) : undefined)
    this.#fetcher = new GatewayBlockFetcher(env.GATEWAY_URL)
  }

  /**
   * @param {import('@cloudflare/workers-types').Request} request
   * @returns {Promise<import('@cloudflare/workers-types').Response>}
   */
  async fetch (request) {
    const body = /** @type {MethodCall} */ (cbor.decode(new Uint8Array(await request.arrayBuffer())))
    const method = API_METHODS.find(m => m === body.method)
    if (!method) throw new Error(`invalid method: ${body.method}`)
    if (typeof this[method] !== 'function') throw new Error(`not implemented: ${method}`)
    const res = await this[method](...body.args)
    // @ts-expect-error
    return new Response(res && cbor.encode(res))
  }

  /**
   * @param {ClockDID} target Clock to follow.
   * @param {EmitterDID} emitter Event emitter (usually an agent) who emits the events.
   */
  async follow (target, emitter) {
    // TODO: maybe we could preload this into memory and update both?
    return await this.#state.blockConcurrencyWhile(async () => {
      /** @type {Followings} */
      const followings = (await this.#state.storage.get(KEY_FOLLOWING)) ?? new Map()
      const emitters = followings.get(target) ?? new Set()
      if (!emitters.has(emitter)) {
        emitters.add(emitter)
        followings.set(target, emitters)
        await this.#state.storage.put(KEY_FOLLOWING, followings)
      }
    })
  }

  /**
   * @param {ClockDID} target
   * @param {EmitterDID} emitter
   */
  async unfollow (target, emitter) {
    return await this.#state.blockConcurrencyWhile(async () => {
      /** @type {Followings} */
      const followings = (await this.#state.storage.get(KEY_FOLLOWING)) ?? new Map()
      const emitters = followings.get(target) ?? new Set()
      if (emitters.has(emitter)) {
        emitters.delete(emitter)
        if (emitters.size) {
          followings.set(target, emitters)
        } else {
          followings.delete(target)
        }
        await this.#state.storage.put(KEY_FOLLOWING, followings)
      }
    })
  }

  /** @returns {Promise<Array<[ClockDID, EmitterDID[]]>>} */
  async following () {
    /** @type {Followings} */
    const follows = (await this.#state.storage.get(KEY_FOLLOWING)) ?? new Map()
    return [...follows.entries()].map(([k, v]) => [k, [...v.values()]])
  }

  /**
   * Subscribe to recieve advances made to this clock by the passed emitter.
   * @param {ClockDID} subscriber Subscriber clock.
   * @param {EmitterDID} emitter Event emitter.
   */
  async subscribe (subscriber, emitter) {
    return await this.#state.blockConcurrencyWhile(async () => {
      // TODO: fail if this clock is not following emitter?
      /** @type {Subscribers} */
      const subscribers = (await this.#state.storage.get(KEY_SUBSCRIBERS)) ?? new Map()
      const emitters = subscribers.get(subscriber) ?? new Set()
      if (!emitters.has(emitter)) {
        emitters.add(emitter)
        subscribers.set(subscriber, emitters)
        await this.#state.storage.put(KEY_SUBSCRIBERS, subscribers)
      }
    })
  }

  /**
   * @param {ClockDID} subscriber
   * @param {EmitterDID} emitter
   */
  async unsubscribe (subscriber, emitter) {
    return await this.#state.blockConcurrencyWhile(async () => {
      /** @type {Subscribers} */
      const subscribers = (await this.#state.storage.get(KEY_SUBSCRIBERS)) ?? new Map()
      const emitters = subscribers.get(subscriber) ?? new Set()
      if (emitters.has(emitter)) {
        emitters.delete(emitter)
        subscribers.set(subscriber, emitters)
        await this.#state.storage.put(KEY_SUBSCRIBERS, subscribers)
      }
    })
  }

  /** @returns {Promise<Array<[ClockDID, EmitterDID[]]>>} */
  async subscribers () {
    /** @type {Subscribers} */
    const subscribers = (await this.#state.storage.get(KEY_SUBSCRIBERS)) ?? new Map()
    return [...subscribers.entries()].map(([k, v]) => [k, [...v.values()]])
  }

  /** @param {import('@web3-storage/pail/clock/api').EventLink<any>[]} head */
  async #setHead (head) {
    await this.#state.storage.put(KEY_HEAD, head.map(h => String(h)))
  }

  /** @returns {Promise<import('@web3-storage/pail/clock/api').EventLink<any>[]>} */
  async head () {
    // TODO: keep sync'd copy in memory
    /** @type {string[]} */
    const head = (await this.#state.storage.get(KEY_HEAD)) ?? []
    return head.map(h => parse(h))
  }

  /**
   * @param {import('@web3-storage/pail/clock/api').EventLink<any>} event
   * @param {import('@web3-storage/pail/clock/api').EventBlockView<import('@web3-storage/pail/clock/api').EventView<any>>[]} [blocks]
   */
  async advance (event, blocks) {
    return await this.#state.blockConcurrencyWhile(async () => {
      const fetcher = withCache(
        blocks?.length
          ? new MultiBlockFetcher(new MemoryBlockstore(blocks), this.#fetcher)
          : this.#fetcher,
        this.#cache
      )
      const head = (await Clock.advance(fetcher, await this.head(), event))
      await this.#setHead(head)
      return head
    })
  }
}

/**
 * @param {import('@cloudflare/workers-types').DurableObjectNamespace} clockNamespace Durable Object API
 * @param {ClockDID} clock Clock that should follow events by emitter.
 * @param {ClockDID} target Clock targetted by events emitted by emitter.
 * @param {EmitterDID} emitter Agent that is emitting events that contribute to the target.
 */
export async function follow (clockNamespace, clock, target, emitter) {
  const stub = clockNamespace.get(clockNamespace.idFromName(clock))
  const body = cbor.encode({ method: 'follow', args: [target, emitter] })
  await stub.fetch('http://localhost', { method: 'POST', body })
  if (clock !== target) {
    await subscribe(clockNamespace, target, clock, emitter)
  }
}

/**
 * @param {import('@cloudflare/workers-types').DurableObjectNamespace} clockNamespace Durable Object API
 * @param {ClockDID} clock Clock that should unfollow events by emitter.
 * @param {ClockDID} target Clock targetted by events emitted by emitter.
 * @param {EmitterDID} emitter Agent that is emitting events that contribute to the target.
 */
export async function unfollow (clockNamespace, clock, target, emitter) {
  const stub = clockNamespace.get(clockNamespace.idFromName(clock))
  const body = cbor.encode({ method: 'unfollow', args: [target, emitter] })
  await stub.fetch('http://localhost', { method: 'POST', body })
  if (clock !== target) {
    await unsubscribe(clockNamespace, target, clock, emitter)
  }
}

/**
 * @param {import('@cloudflare/workers-types').DurableObjectNamespace} clockNamespace Durable Object API
 * @param {import('@ucanto/interface').DID} clock Clock to get following emitters for.
 */
export async function following (clockNamespace, clock) {
  const stub = clockNamespace.get(clockNamespace.idFromName(clock))
  const body = cbor.encode({ method: 'following', args: [] })
  const res = await stub.fetch('http://localhost', { method: 'POST', body })
  const data = /** @type {Array<[ClockDID, EmitterDID[]]>} */ (cbor.decode(new Uint8Array(await res.arrayBuffer())))
  return new Map(data.map(([k, v]) => [k, new Set(v)]))
}

/**
 * @param {import('@cloudflare/workers-types').DurableObjectNamespace} clockNamespace Durable Object API
 * @param {ClockDID} clock Clock to add subscription to.
 * @param {ClockDID} subscriber Clock that should recieve events emitted by emitter.
 * @param {EmitterDID} emitter Agent that is emitting events that contribute to clock.
 */
async function subscribe (clockNamespace, clock, subscriber, emitter) {
  const stub = clockNamespace.get(clockNamespace.idFromName(clock))
  const body = cbor.encode({ method: 'subscribe', args: [subscriber, emitter] })
  await stub.fetch('http://localhost', { method: 'POST', body })
}

/**
 * @param {import('@cloudflare/workers-types').DurableObjectNamespace} clockNamespace Durable Object API
 * @param {ClockDID} clock Clock to remove subscription from.
 * @param {ClockDID} subscriber Current subscription clock.
 * @param {EmitterDID} emitter Agent that is emitting events that contribute to clock.
 */
async function unsubscribe (clockNamespace, clock, subscriber, emitter) {
  const stub = clockNamespace.get(clockNamespace.idFromName(clock))
  const body = cbor.encode({ method: 'unsubscribe', args: [subscriber, emitter] })
  await stub.fetch('http://localhost', { method: 'POST', body })
}

/**
 * @param {import('@cloudflare/workers-types').DurableObjectNamespace} clockNamespace Durable Object API
 * @param {ClockDID} clock Clock to get subscribers for.
 * @returns {Promise<Subscribers>}
 */
async function subscribers (clockNamespace, clock) {
  const stub = clockNamespace.get(clockNamespace.idFromName(clock))
  const body = cbor.encode({ method: 'subscribers', args: [] })
  const res = await stub.fetch('http://localhost', { method: 'POST', body })
  const data = /** @type {Array<[ClockDID, EmitterDID[]]>} */ (cbor.decode(new Uint8Array(await res.arrayBuffer())))
  return new Map(data.map(([k, v]) => [k, new Set(v)]))
}

/**
 * @param {import('@cloudflare/workers-types').DurableObjectNamespace} clockNamespace Durable Object API
 * @param {ClockDID} clock Clock we want the head of.
 * @returns {Promise<import('@web3-storage/pail/clock/api').EventLink<any>[]>}
 */
export async function head (clockNamespace, clock) {
  const stub = clockNamespace.get(clockNamespace.idFromName(clock))
  const body = cbor.encode({ method: 'head', args: [] })
  const res = await stub.fetch('http://localhost', { method: 'POST', body })
  return cbor.decode(new Uint8Array(await res.arrayBuffer()))
}

/**
 * Advance the clock with the passed event, created by the passed agent.
 *
 * @param {import('@cloudflare/workers-types').DurableObjectNamespace} clockNamespace Durable Object API
 * @param {ClockDID} clock Clock to advance.
 * @param {EmitterDID} emitter Agent that is emitting events that contribute to the target.
 * @param {import('@web3-storage/pail/clock/api').EventLink<any>} event Event to advance the clock with.
 * @param {import('multiformats').Block<import('@web3-storage/pail/clock/api').EventView<any>>[]} [blocks] Provided event blocks to advance the clock with.
 * @returns {Promise<import('@web3-storage/pail/clock/api').EventLink<any>[]>}
 */
export async function advance (clockNamespace, clock, emitter, event, blocks) {
  return advanceAnyClock(clockNamespace, clock, clock, emitter, event, blocks)
}

/**
 * @param {import('@cloudflare/workers-types').DurableObjectNamespace} clockNamespace Durable Object API
 * @param {ClockDID} clock The clock that this event should advance.
 * @param {ClockDID} target The clock targetted by events emitted by emitter.
 * @param {EmitterDID} emitter Agent that is emitting events that contribute to the target.
 * @param {import('@web3-storage/pail/clock/api').EventLink<any>} event Event to advance the clock with.
 * @param {import('multiformats').Block<import('@web3-storage/pail/clock/api').EventView<any>>[]} [blocks] Provided event blocks to advance the clock with.
 * @returns {Promise<import('@web3-storage/pail/clock/api').EventLink<any>[]>}
 */
async function advanceAnyClock (clockNamespace, clock, target, emitter, event, blocks = []) {
  const stub = clockNamespace.get(clockNamespace.idFromName(clock))
  const body = cbor.encode({
    method: 'advance',
    args: [event, blocks.map(b => ({ cid: b.cid, bytes: b.bytes }))]
  })
  const res = await stub.fetch('http://localhost', { method: 'POST', body })
  const data = /** @type {import('@web3-storage/pail/clock/api').EventLink<any>[]} */ (cbor.decode(new Uint8Array(await res.arrayBuffer())))

  // advance subscribers of this clock
  if (clock === target) {
    const others = await subscribers(clockNamespace, clock)
    for (const [clock, emitters] of others) {
      if (emitters.has(emitter)) {
        await advanceAnyClock(clockNamespace, clock, target, emitter, event)
      }
    }
  }

  return data
}
