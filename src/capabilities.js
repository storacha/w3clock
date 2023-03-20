import { capability, URI, Link, Failure, Schema } from '@ucanto/validator'

/**
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
export const follow = capability({
  can: 'clock/follow',
  with: URI.match({ protocol: 'did:' }),
  nb: Schema.struct({
    iss: URI.match({ protocol: 'did:' }).optional(),
    with: URI.match({ protocol: 'did:' }).optional()
  }),
  derives: (claim, proof) => {
    let result = equalCaveat('with', claim, proof)
    if (result !== true) return result
    result = equalCaveat('iss', claim, proof)
    if (result !== true) return result
    return equalWith(claim, proof)
  }
})

/**
 * Stop following advances made by an agent to a clock.
 */
export const unfollow = capability({
  can: 'clock/unfollow',
  with: URI.match({ protocol: 'did:' }),
  nb: Schema.struct({
    iss: URI.match({ protocol: 'did:' }).optional(),
    with: URI.match({ protocol: 'did:' }).optional()
  }),
  derives: (claim, proof) => {
    let result = equalCaveat('with', claim, proof)
    if (result !== true) return result
    result = equalCaveat('iss', claim, proof)
    if (result !== true) return result
    return equalWith(claim, proof)
  }
})

/**
 * List the agents this clock is following advances from.
 */
export const following = capability({
  can: 'clock/following',
  with: URI.match({ protocol: 'did:' }),
  derives: equalWith
})

/**
 * List the CIDs of the events at the head of this clock.
 */
export const head = capability({
  can: 'clock/head',
  with: URI.match({ protocol: 'did:' }),
  derives: equalWith
})

/**
 * Advance the clock by adding an event.
 */
export const advance = capability({
  can: 'clock/advance',
  with: URI.match({ protocol: 'did:' }),
  nb: Schema.struct({
    event: Link.match({ version: 1 })
  }),
  derives: equalWith
})

/**
 * Checks that `nb.<prop>` on claimed capability is the same as `nb.<prop>`
 * in delegated capability.
 *
 * @param {string} prop
 * @param {import('@ucanto/interface').ParsedCapability} claim
 * @param {import('@ucanto/interface').ParsedCapability} proof
 */
function equalCaveat (prop, claim, proof) {
  if (proof.nb[prop] !== claim.nb[prop]) {
    if (proof.nb[prop] == null && claim.nb[prop] != null) {
      return new Failure(`missing nb.${prop} on delegated capability: ${claim.nb[prop]}`)
    } else if (proof.nb[prop] != null && claim.nb[prop] == null) {
      return new Failure(`missing nb.${prop} on claimed capability: ${proof.nb[prop]}`)
    } else {
      return new Failure(`mismatched nb.${prop}: ${claim.nb[prop]} != ${proof.nb[prop]}`)
    }
  }
  return true
}

/**
 * Checks that `with` on claimed capability is the same as `with`
 * in delegated capability. Note this will ignore `can` field.
 *
 * @param {import('@ucanto/interface').ParsedCapability} claim
 * @param {import('@ucanto/interface').ParsedCapability} proof
 */
function equalWith (claim, proof) {
  return claim.with === proof.with || new Failure(`Can not derive ${claim.can} with ${claim.with} from ${proof.with}`)
}
