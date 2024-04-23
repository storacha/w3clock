import { Signer, Proof, DID, Principal, ConnectionView, Block } from '@ucanto/interface'
import { EventView } from '@web3-storage/pail/clock/api'
import { Service } from '../api'

export interface InvocationConfig {
  /**
   * Signing authority that is issuing the UCAN invocation(s).
   */
  issuer: Signer
  /**
   * The principal delegated to in the current UCAN.
   */
  audience?: Principal
  /**
   * The resource the invocation applies to.
   */
  with: DID
  /**
   * Proof(s) the issuer has the capability to perform the action.
   */
  proofs: Proof[]
}

export interface Connectable<T> {
  connection?: ConnectionView<Service<T>>
}

export interface RequestOptions<T> extends Connectable<T> {}

export interface FollowOptions<T> extends RequestOptions<T> {
  /**
   * Clock event issuer.
   */
  issuer?: DID
  /**
   * Target clock.
   */
  with?: DID
}

export interface AdvanceOptions<T> extends RequestOptions<T> {
  /**
   * Event blocks that may help the service to advance the clock. This are
   * optional because event blocks _should_ be made available to fetch directly
   * from the IPFS network.
   */
  blocks?: Block<EventView<any>>[]
}
