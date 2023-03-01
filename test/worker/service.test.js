import { describe, it, beforeEach } from 'mocha'
import assert from 'assert'
import { Miniflare } from 'miniflare'
import { Signer } from '@ucanto/principal/ed25519'
import * as ClockCaps from '../../src/capabilities.js'
import { miniflareConnection } from '../helpers/ucanto.js'

describe('UCAN service', () => {
  /** @type {Signer.EdSigner} */
  let svc
  /** @type {Miniflare} */
  let mf
  /** @type {import('@ucanto/interface').Connection<import('../src/worker/types').Service>} */
  let conn

  beforeEach(async () => {
    svc = await Signer.generate()

    mf = new Miniflare({
      wranglerConfigPath: true,
      wranglerConfigEnv: 'test',
      modules: true,
      bindings: { PRIVATE_KEY: Signer.format(svc) }
    })

    conn = miniflareConnection(mf, svc)
  })

  it('follows', async () => {
    const clock = await Signer.generate()
    const alice = await Signer.generate()

    // give alice access to issue follows to the clock
    const proof = await ClockCaps.follow.delegate({
      issuer: clock,
      audience: alice,
      with: clock.did()
    })

    const res = await ClockCaps.follow
      .invoke({
        issuer: alice,
        audience: svc,
        with: clock.did(),
        proofs: [proof]
      })
      .execute(conn)

    assert(!res.error)
  })
})
