import { connect as clientConnect } from '@ucanto/client'
import { CAR, HTTP } from '@ucanto/transport'
import * as DID from '@ipld/dag-ucan/did'
import * as ClockCaps from '../capabilities.js'

export * from './api.js'
export * from '../service.js'

export const SERVICE_URL = 'https://clock.web3.storage'
export const SERVICE_PRINCIPAL = 'did:web:clock.web3.storage'

/**
 * Advance the clock by adding an event.
 *
 * @template T
 * @param {import('./api').InvocationConfig} conf
 * @param {import('@web3-storage/pail/clock/api').EventLink<T>} event
 * @param {import('./api').AdvanceOptions<T>} [options]
 */
export async function advance ({ issuer, with: resource, proofs, audience }, event, options) {
  const conn = options?.connection ?? connect()
  const facts = options?.blocks ? [Object.fromEntries(options.blocks.map(b => [b.cid.toString(), b.cid]))] : []
  const invocation = ClockCaps.advance
    .invoke({
      issuer,
      audience: audience ?? conn.id,
      with: resource,
      nb: { event },
      proofs,
      facts
    })

  for (const block of options?.blocks ?? []) {
    invocation.attach(block)
  }

  return invocation.execute(conn)
}

/**
 * Retrieve the clock head.
 *
 * @template T
 * @param {import('./api').InvocationConfig} conf
 * @param {import('./api').RequestOptions<T>} [options]
 */
export async function head ({ issuer, with: resource, proofs, audience }, options) {
  const conn = options?.connection ?? connect()
  return await ClockCaps.head
    .invoke({
      issuer,
      audience: audience ?? conn.id,
      with: resource,
      proofs
    })
    .execute(conn)
}

// /**
//  * Instruct a clock to follow the issuer, or optionally a different issuer,
//  * contributing to a different clock.
//  *
//  * @template T
//  * @param {import('./api').InvocationConfig} conf
//  * @param {import('./api').FollowOptions<T>} [options]
//  */
// export async function follow ({ issuer, with: resource, proofs, audience }, options) {
//   const conn = options?.connection ?? connect()
//   const result = await ClockCaps.follow
//     .invoke({
//       issuer,
//       audience: audience ?? conn.id,
//       with: resource,
//       nb: {
//         ...(options?.issuer ? { iss: options.issuer } : {}),
//         ...(options?.with ? { with: options.with } : {})
//       },
//       proofs
//     })
//     .execute(conn)

//   if (result.error) {
//     throw new Error(`failed ${ClockCaps.follow.can} invocation`, { cause: result })
//   }

//   return result
// }

/**
 * @template T
 * @param {object} [options]
 * @param {import('@ucanto/interface').Principal} [options.servicePrincipal]
 * @param {URL} [options.serviceURL]
 * @returns {import('@ucanto/interface').ConnectionView<import('../service').Service<T>>}
 */
export function connect (options) {
  const url = options?.serviceURL ?? new URL(SERVICE_URL)
  return clientConnect({
    id: options?.servicePrincipal ?? DID.parse(SERVICE_PRINCIPAL),
    codec: CAR.outbound,
    channel: HTTP.open({ url, method: 'POST' })
  })
}
