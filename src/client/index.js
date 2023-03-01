import { connect as clientConnect } from '@ucanto/client'
import { CAR, CBOR, HTTP } from '@ucanto/transport'
import * as DID from '@ipld/dag-ucan/did'
import * as ClockCaps from '../capabilities.js'

export const SERVICE_URL = 'http://clock.web3.storage'
export const SERVICE_PRINCIPAL = 'did:web:clock.web3.storage'

/**
 * Instruct a clock to follow the issuer, or optionally a different issuer,
 * contributing to a different clock.
 *
 * @param {import('./types').InvocationConfig} conf
 * @param {import('./types').FollowOptions} [options]
 */
export async function follow ({ issuer, with: resource, proofs, audience }, options) {
  const conn = options.connection ?? connect()
  const result = await ClockCaps.follow
    .invoke({
      issuer,
      audience: audience ?? conn.id,
      with: resource,
      nb: {
        ...(options?.issuer ? { iss: options.issuer } : {}),
        ...(options?.with ? { with: options.with } : {})
      },
      proofs
    })
    .execute(conn)

  if (result.error) {
    throw new Error(`failed ${ClockCaps.follow.can} invocation`, { cause: result })
  }

  return result
}

/**
 * @returns {import('@ucanto/interface').ConnectionView<import('../types').Service>}
 */
export function connect () {
  return clientConnect({
    id: DID.parse(SERVICE_PRINCIPAL),
    encoder: CAR,
    decoder: CBOR,
    channel: HTTP.open({
      url: new URL(SERVICE_URL),
      method: 'POST'
    })
  })
}
