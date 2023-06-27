import { describe, it } from 'mocha'
import assert from 'assert'
import { Signer } from '@ucanto/principal/ed25519'
import { DurableClock, follow, following, unfollow } from '../../src/worker/durable-clock.js'
import { MockState, MockStorage, MockNamespace } from '../helpers/durable-objects.js'

describe('DurableClock', () => {
  it('follows', async () => {
    const sundial = await Signer.generate()
    const alice = await Signer.generate()

    const namespace = new MockNamespace()
    const id = namespace.idFromName(sundial.did())
    const storage = new MockStorage()
    const state = new MockState(id, storage)
    const obj = new DurableClock(state, { DEBUG: 'true', PRIVATE_KEY: 'secret', CLOCK: namespace })
    namespace.set(id, obj)

    await follow(namespace, sundial.did(), sundial.did(), alice.did())

    const followings = await following(namespace, sundial.did())
    assert.equal(followings.size, 1)
    const emitters = followings.get(sundial.did())
    assert(emitters)
    assert.equal(emitters.size, 1)
    assert(emitters.has(alice.did()))
  })

  it('follows a different clock', async () => {
    const sundial = await Signer.generate()
    const hourglass = await Signer.generate()
    const alice = await Signer.generate()

    const namespace = new MockNamespace()
    const clockID = namespace.idFromName(sundial.did())
    const clockStorage = new MockStorage()
    const clockState = new MockState(clockID, clockStorage)
    const clockObj = new DurableClock(clockState, { DEBUG: 'true', PRIVATE_KEY: 'secret', CLOCK: namespace })
    namespace.set(clockID, clockObj)

    // need a target DO for subscribing
    const targetID = namespace.idFromName(hourglass.did())
    const targetStorage = new MockStorage()
    const targetState = new MockState(targetID, targetStorage)
    const targetObj = new DurableClock(targetState, { DEBUG: 'true', PRIVATE_KEY: 'secret', CLOCK: namespace })
    namespace.set(targetID, targetObj)

    await follow(namespace, sundial.did(), hourglass.did(), alice.did())

    const followings = await following(namespace, sundial.did())
    assert.equal(followings.size, 1)
    const emitters = followings.get(hourglass.did())
    assert(emitters)
    assert.equal(emitters.size, 1)
    assert(emitters.has(alice.did()))
  })

  it('unfollows', async () => {
    const sundial = await Signer.generate()
    const alice = await Signer.generate()

    const namespace = new MockNamespace()
    const id = namespace.idFromName(sundial.did())
    const storage = new MockStorage()
    const state = new MockState(id, storage)
    const obj = new DurableClock(state, { DEBUG: 'true', PRIVATE_KEY: 'secret', CLOCK: namespace })
    namespace.set(id, obj)

    await follow(namespace, sundial.did(), sundial.did(), alice.did())

    let followings = await following(namespace, sundial.did())
    assert.equal(followings.size, 1)
    let emitters = followings.get(sundial.did())
    assert(emitters)
    assert.equal(emitters.size, 1)
    assert(emitters.has(alice.did()))

    await unfollow(namespace, sundial.did(), sundial.did(), alice.did())

    followings = await following(namespace, sundial.did())
    assert.equal(followings.size, 0)
    emitters = followings.get(sundial.did())
    assert(!emitters)
  })

  it('unfollows a different clock', async () => {
    const sundial = await Signer.generate()
    const hourglass = await Signer.generate()
    const alice = await Signer.generate()

    const namespace = new MockNamespace()
    const clockID = namespace.idFromName(sundial.did())
    const clockStorage = new MockStorage()
    const clockState = new MockState(clockID, clockStorage)
    const clockObj = new DurableClock(clockState, { DEBUG: 'true', PRIVATE_KEY: 'secret', CLOCK: namespace })
    namespace.set(clockID, clockObj)

    // need a target DO for subscribing
    const targetID = namespace.idFromName(hourglass.did())
    const targetStorage = new MockStorage()
    const targetState = new MockState(targetID, targetStorage)
    const targetObj = new DurableClock(targetState, { DEBUG: 'true', PRIVATE_KEY: 'secret', CLOCK: namespace })
    namespace.set(targetID, targetObj)

    await follow(namespace, sundial.did(), hourglass.did(), alice.did())

    let followings = await following(namespace, sundial.did())
    assert.equal(followings.size, 1)
    let emitters = followings.get(hourglass.did())
    assert(emitters)
    assert.equal(emitters.size, 1)
    assert(emitters.has(alice.did()))

    await unfollow(namespace, sundial.did(), hourglass.did(), alice.did())

    followings = await following(namespace, sundial.did())
    assert.equal(followings.size, 0)
    emitters = followings.get(sundial.did())
    assert(!emitters)
  })
  it('should handle multi-user clock advancement and fetch', async () => {
    const alice = await Signer.generate()
    const bob = await Signer.generate()
    const carol = await Signer.generate()

    const namespaceAlice = new MockNamespace()
    const namespaceBob = new MockNamespace()
    const namespaceCarol = new MockNamespace()

    const idAlice = namespaceAlice.idFromName(alice.did())
    const idBob = namespaceBob.idFromName(bob.did())
    const idCarol = namespaceCarol.idFromName(carol.did())

    const storageAlice = new MockStorage()
    const storageBob = new MockStorage()
    const storageCarol = new MockStorage()

    const stateAlice = new MockState(idAlice, storageAlice)
    const stateBob = new MockState(idBob, storageBob)
    const stateCarol = new MockState(idCarol, storageCarol)

    const clockAlice = new DurableClock(stateAlice, { DEBUG: 'true', PRIVATE_KEY: alice.did(), CLOCK: namespaceAlice })
    const clockBob = new DurableClock(stateBob, { DEBUG: 'true', PRIVATE_KEY: bob.did(), CLOCK: namespaceBob })
    const clockCarol = new DurableClock(stateCarol, { DEBUG: 'true', PRIVATE_KEY: carol.did(), CLOCK: namespaceCarol })

    namespaceAlice.set(idAlice, clockAlice)
    namespaceBob.set(idBob, clockBob)
    namespaceCarol.set(idCarol, clockCarol)

    // Advance Alice's clock
    const eventAlice = await invoke(alice, clockAlice, 'clock/advance')
    assert(eventAlice)

    // Advance Bob's clock with a reference to Alice's event
    const eventBob = await invoke(bob, clockBob, 'clock/advance', eventAlice)
    assert(eventBob)

    // Advance Carol's clock with a reference to Bob's event
    const eventCarol = await invoke(carol, clockCarol, 'clock/advance', eventBob)
    assert(eventCarol)

    // Alice, Bob, and Carol fetch the current head of their clocks
    const headAlice = await invoke(alice, clockAlice, 'clock/head')
    const headBob = await invoke(bob, clockBob, 'clock/head')
    const headCarol = await invoke(carol, clockCarol, 'clock/head')

    // Validate the heads
    assert(headAlice)
    assert(headBob)
    assert(headCarol)

    // Validate that each clock head points to the correct event
    assert.deepEqual(headAlice, await fetchClockEvent(eventAlice))
    assert.deepEqual(headBob, await fetchClockEvent(eventBob))
    assert.deepEqual(headCarol, await fetchClockEvent(eventCarol))

    // Validate that each user can fetch the others' updates
    assert.deepEqual(await invoke(alice, clockAlice, 'clock/head', eventBob), await fetchClockEvent(eventBob))
    assert.deepEqual(await invoke(bob, clockBob, 'clock/head', eventCarol), await fetchClockEvent(eventCarol))
    assert.deepEqual(await invoke(carol, clockCarol, 'clock/head', eventAlice), await fetchClockEvent(eventAlice))
  })
  it('throws error when stub.fetch fails', async () => {
    const sundial = await Signer.generate()
    const alice = await Signer.generate()

    const namespace = new MockNamespace()
    const id = namespace.idFromName(sundial.did())
    const storage = new MockStorage()
    const state = new MockState(id, storage)
    const obj = new DurableClock(state, { DEBUG: 'true', PRIVATE_KEY: 'secret', CLOCK: namespace })
    namespace.set(id, obj)

    // Use our stub function to replace obj.fetch with a function that throws an error
    const restoreFetch = stub(obj, 'fetch', () => { throw new Error('Fetch failed') })

    let error = null
    try {
      await follow(namespace, sundial.did(), sundial.did(), alice.did())
    } catch (e) {
      error = e
    }

    restoreFetch() // restore the original fetch method

    assert(error, 'Expected an error to be thrown')
    assert.equal(error.message, 'Fetch failed')
  })
})

function stub (obj, method, fn) {
  const original = obj[method]
  obj[method] = fn
  return () => { obj[method] = original } // return a restore function
}

async function invoke (user, clock, command, event) {
  switch (command) {
    case 'clock/advance':
      // Assuming 'advance' method exists on clock object and takes user and event as arguments
      return await clock.advance(user, event)
    case 'clock/head':
      // Assuming 'head' method exists on clock object and takes user and event as arguments
      return await clock.head(user, event)
    default:
      throw new Error(`Invalid command: ${command}`)
  }
}

async function fetchClockEvent (event) {
  // Assuming this function fetches and returns the clock event, based on the 'event' parameter
  // You should replace this implementation with your own
  return event
}
