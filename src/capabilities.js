import { capability, URI, Link, Failure, Schema } from '@ucanto/validator'
import { sha256 } from 'multiformats/hashes/sha2'
import * as cbor from '@ipld/dag-cbor'

/**
 * @typedef {import('@ucanto/interface').InferInvokedCapability<typeof top>} Top
 * @typedef {import('@ucanto/interface').InferInvokedCapability<typeof clock>} Clock
 * @typedef {import('@ucanto/interface').InferInvokedCapability<typeof follow>} ClockFollow
 * @typedef {import('@ucanto/interface').InferInvokedCapability<typeof unfollow>} ClockUnfollow
 * @typedef {import('@ucanto/interface').InferInvokedCapability<typeof following>} ClockFollowing
 * @typedef {import('@ucanto/interface').InferInvokedCapability<typeof advance>} ClockAdvance
 * @typedef {import('@ucanto/interface').InferInvokedCapability<typeof head>} ClockHead
 */

export const clock = capability({
  can: 'clock/*',
  with: URI.match({ protocol: 'did:' }),
  derives: equalWith
})

/**
 * Follow advances made by an agent to a clock.
 */
export const follow = clock.derive({
  to: capability({
    can: 'clock/follow',
    with: URI.match({ protocol: 'did:' }),
    nb: Schema.struct({
      iss: URI.match({ protocol: 'did:' }).optional(),
      with: URI.match({ protocol: 'did:' }).optional()
    }),
    derives: equalWith
  }),
  derives: equalWith
})

/**
 * Stop following advances made by an agent to a clock.
 */
export const unfollow = clock.derive({
  to: capability({
    can: 'clock/unfollow',
    with: URI.match({ protocol: 'did:' }),
    nb: Schema.struct({
      iss: URI.match({ protocol: 'did:' }).optional(),
      with: URI.match({ protocol: 'did:' }).optional()
    }),
    derives: equalWith
  }),
  derives: equalWith
})

/**
 * List the agents this clock is following advances from.
 */
export const following = clock.derive({
  to: capability({
    can: 'clock/following',
    with: URI.match({ protocol: 'did:' }),
    derives: equalWith
  }),
  derives: equalWith
})

/**
 * List the CIDs of the events at the head of this clock.
 */
export const head = clock.derive({
  to: capability({
    can: 'clock/head',
    with: URI.match({ protocol: 'did:' }),
    derives: equalWith
  }),
  derives: equalWith
})

/**
 * Advance the clock by adding an event.
 */
export const advance = clock.derive({
  to: capability({
    can: 'clock/advance',
    with: URI.match({ protocol: 'did:' }),
    nb: Schema.struct({
      event: Link.match({ code: cbor.code, algorithm: sha256.code, version: 1 })
    }),
    derives: equalWith
  }),
  derives: equalWith
})

/**
 * Checks that `with` on claimed capability is the same as `with`
 * in delegated capability. Note this will ignore `can` field.
 *
 * @param {import('@ucanto/interface').ParsedCapability} child
 * @param {import('@ucanto/interface').ParsedCapability} parent
 */
export function equalWith (child, parent) {
  return child.with === parent.with || new Failure(`Can not derive ${child.can} with ${child.with} from ${parent.with}`)
}
