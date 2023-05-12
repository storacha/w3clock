import { capability, URI, Link, Schema } from '@ucanto/validator'

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
  with: URI.match({ protocol: 'did:' })
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
  })
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
  })
})

/**
 * List the agents this clock is following advances from.
 */
export const following = capability({
  can: 'clock/following',
  with: URI.match({ protocol: 'did:' })
})

/**
 * List the CIDs of the events at the head of this clock.
 */
export const head = capability({
  can: 'clock/head',
  with: URI.match({ protocol: 'did:' })
})

/**
 * Advance the clock by adding an event.
 */
export const advance = capability({
  can: 'clock/advance',
  with: URI.match({ protocol: 'did:' }),
  nb: Schema.struct({
    event: Link.match({ version: 1 })
  })
})
