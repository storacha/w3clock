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
  /** @type {import('@ucanto/interface').Connection<import('../../src/types').Service>} */
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

  it('unfollows', async () => {
    const clock = await Signer.generate()
    const alice = await Signer.generate()

    // give alice access to issue follows/unfollows to the clock
    const proofs = [
      await ClockCaps.follow.delegate({
        issuer: clock,
        audience: alice,
        with: clock.did()
      }),
      await ClockCaps.unfollow.delegate({
        issuer: clock,
        audience: alice,
        with: clock.did()
      }),
      await ClockCaps.following.delegate({
        issuer: clock,
        audience: alice,
        with: clock.did()
      })
    ]

    const res0 = await ClockCaps.following
      .invoke({
        issuer: alice,
        audience: svc,
        with: clock.did(),
        proofs
      })
      .execute(conn)

    assert(!res0.error)
    assert(Array.isArray(res0))
    assert.equal(res0.length, 0)

    const res1 = await ClockCaps.follow
      .invoke({
        issuer: alice,
        audience: svc,
        with: clock.did(),
        proofs
      })
      .execute(conn)

    assert(!res1.error)

    const res2 = await ClockCaps.following
      .invoke({
        issuer: alice,
        audience: svc,
        with: clock.did(),
        proofs
      })
      .execute(conn)

    assert(!res2.error)
    assert(Array.isArray(res2))
    assert.equal(res2.length, 1)
    assert.equal(res2[0][0], clock.did())
    assert(Array.isArray(res2[0][1]))
    assert.equal(res2[0][1][0], alice.did())

    const res3 = await ClockCaps.unfollow
      .invoke({
        issuer: alice,
        audience: svc,
        with: clock.did(),
        proofs
      })
      .execute(conn)

    assert(!res3.error)

    const res4 = await ClockCaps.following
      .invoke({
        issuer: alice,
        audience: svc,
        with: clock.did(),
        proofs
      })
      .execute(conn)

    assert(!res4.error)
    assert(Array.isArray(res4))
    assert.equal(res4.length, 0)
  })
})
