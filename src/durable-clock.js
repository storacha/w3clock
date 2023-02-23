import * as Clock from '@alanshaw/pail/clock.js'
import { parse } from 'multiformats/link'
import { GatewayBlockFetcher } from './block.js'

/**
 * @typedef {{ method: string, args: any[] }} MethodCall
 * @typedef {import('@ucanto/interface').DID} EmitterDID DID of an clock event emitter (usually an agent).
 * @typedef {import('@ucanto/interface').DID} ClockDID DID of a merkle clock.
 * @typedef {Map<ClockDID, Set<EmitterDID>>} Followings Event emitters that this clock is following (and the associated clock DID they are contributing to).
 * @typedef {Map<ClockDID, Set<EmitterDID>>} Subscribers Clocks that want to receive advances made to this clock.
 */

const KEY_FOLLOWING = 'following'
const KEY_SUBSCRIBERS = 'subscribers'
const KEY_HEAD = 'head'
const API_METHODS = ['follow', 'unfollow', 'following', 'subscribe', 'unsubscribe', 'subscribers', 'advance', 'head']

/** @type {import('@cloudflare/workers-types').DurableObject} */
export class DurableClock {
  #state
  #fetcher

  /**
   * @param {import('@cloudflare/workers-types').DurableObjectState} state
   * @param {import('./bindings').Environment} env
   */
  constructor (state, env) {
    this.#state = state
    this.#fetcher = new GatewayBlockFetcher(env.GATEWAY_URL, env.BLOCK_CACHE_SIZE ? parseInt(env.BLOCK_CACHE_SIZE) : undefined)
  }

  /** @param {Request} request */
  async fetch (request) {
    const body = /** @type {MethodCall} */ (await request.json())
    if (!API_METHODS.includes(body.method)) throw new Error(`invalid method: ${body.method}`)
    if (!this[body.method]) throw new Error(`not implemented: ${body.method}`)
    const res = await this[body.method](...body.args)
    return new Response(res && JSON.stringify(res))
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
        followings.set(target, emitters)
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

  /** @returns {Promise<import('@alanshaw/pail/clock').EventLink<any>[]>} */
  async #head () {
    // TODO: keep sync'd copy in memory
    /** @type {string[]} */
    const head = (await this.#state.storage.get(KEY_HEAD)) ?? []
    return head.map(h => parse(h))
  }

  /** @param {import('@alanshaw/pail/clock').EventLink<any>[]} head */
  async #setHead (head) {
    await this.#state.storage.put(KEY_HEAD, head.map(h => String(h)))
  }

  async head () {
    return (await this.#head()).map(h => String(h))
  }

  /**
   * @param {ClockDID} target Target clock to advance.
   * @param {EmitterDID} emitter Event emitter (usually an agent) who emits the events.
   * @param {import('@alanshaw/pail/clock').EventLink<any>} event
   */
  async advance (target, emitter, event) {
    /** @type {Followings} */
    const followings = (await this.#state.storage.get(KEY_FOLLOWING)) ?? new Map()
    const emitters = followings.get(target)
    if (!emitters || !emitters.has(emitter)) return
    return await this.#state.blockConcurrencyWhile(async () => {
      const head = (await Clock.advance(this.#fetcher, await this.#head(), event))
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
  const body = JSON.stringify({ method: 'follow', args: [target, emitter] })
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
  const body = JSON.stringify({ method: 'unfollow', args: [target, emitter] })
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
  const body = JSON.stringify({ method: 'following', args: [] })
  const res = await stub.fetch('http://localhost', { method: 'POST', body })
  const data = /** @type {Array<[ClockDID, EmitterDID[]]>} */ (await res.json())
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
  const body = JSON.stringify({ method: 'subscribe', args: [subscriber, emitter] })
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
  const body = JSON.stringify({ method: 'unsubscribe', args: [subscriber, emitter] })
  await stub.fetch('http://localhost', { method: 'POST', body })
}

/**
 * @param {import('@cloudflare/workers-types').DurableObjectNamespace} clockNamespace Durable Object API
 * @param {ClockDID} clock Clock to get subscribers for.
 * @returns {Promise<Subscribers>}
 */
async function subscribers (clockNamespace, clock) {
  const stub = clockNamespace.get(clockNamespace.idFromName(clock))
  const body = JSON.stringify({ method: 'subscribers', args: [] })
  const res = await stub.fetch('http://localhost', { method: 'POST', body })
  const data = /** @type {Array<[ClockDID, EmitterDID[]]>} */ (await res.json())
  return new Map(data.map(([k, v]) => [k, new Set(v)]))
}

/**
 * @param {import('@cloudflare/workers-types').DurableObjectNamespace} clockNamespace Durable Object API
 * @param {ClockDID} clock Clock we want the head of.
 * @returns {Promise<import('@alanshaw/pail/clock').EventLink<any>[]>}
 */
export async function head (clockNamespace, clock) {
  const stub = clockNamespace.get(clockNamespace.idFromName(clock))
  const body = JSON.stringify({ method: 'head', args: [] })
  const res = await stub.fetch('http://localhost', { method: 'POST', body })
  const data = /** @type {string[]} */ (await res.json())
  return data.map(s => parse(s))
}

/**
 * Advance the clock with the passed event, created by the passed agent.
 *
 * @param {import('@cloudflare/workers-types').DurableObjectNamespace} clockNamespace Durable Object API
 * @param {ClockDID} clock Clock to advance.
 * @param {EmitterDID} emitter Agent that is emitting events that contribute to the target.
 * @param {import('@alanshaw/pail/clock').EventLink<any>} event Event to advance the clock with.
 * @returns {Promise<import('@alanshaw/pail/clock').EventLink<any>[]>}
 */
export async function advance (clockNamespace, clock, emitter, event) {
  return advanceAnyClock(clockNamespace, clock, clock, emitter, event)
}

/**
 * @param {import('@cloudflare/workers-types').DurableObjectNamespace} clockNamespace Durable Object API
 * @param {ClockDID} clock The clock that this event should advance.
 * @param {ClockDID} target The clock targetted by events emitted by emitter.
 * @param {EmitterDID} emitter Agent that is emitting events that contribute to the target.
 * @param {import('@alanshaw/pail/clock').EventLink<any>} event Event to advance the clock with.
 * @returns {Promise<import('@alanshaw/pail/clock').EventLink<any>[]>}
 */
async function advanceAnyClock (clockNamespace, clock, target, emitter, event) {
  const stub = clockNamespace.get(clockNamespace.idFromName(clock))
  const body = JSON.stringify({ method: 'advance', args: [target, emitter, event.toString()] })
  const res = await stub.fetch('http://localhost', { method: 'POST', body })
  const data = /** @type {string[]} */ (await res.json())

  // advance subscribers of this clock
  if (clock === target) {
    const others = await subscribers(clockNamespace, clock)
    for (const [clock, emitters] of others) {
      if (emitters.has(emitter)) {
        await advanceAnyClock(clockNamespace, clock, target, emitter, event)
      }
    }
  }

  return data.map(s => parse(s))
}
