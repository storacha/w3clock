# w3clock

<p>
  <a href="https://github.com/web3-storage/freeway/actions/workflows/release.yml"><img alt="GitHub Workflow Status" src="https://img.shields.io/github/actions/workflow/status/web3-storage/freeway/test.yml?branch=main&style=for-the-badge" /></a>
  <a href="https://standardjs.com"><img alt="StandardJS Code Style" src="https://img.shields.io/badge/code_style-standard-brightgreen.svg?style=for-the-badge" /></a>
  <a href="https://discord.com/channels/806902334369824788/864892166470893588"><img src="https://img.shields.io/badge/chat-discord?style=for-the-badge&logo=discord&label=discord&logoColor=ffffff&color=7389D8" /></a>
  <a href="https://github.com/web3-storage/freeway/blob/main/LICENSE.md"><img alt="License: Apache-2.0 OR MIT" src="https://img.shields.io/badge/LICENSE-Apache--2.0%20OR%20MIT-yellow?style=for-the-badge" /></a>
</p>


UCAN based merkle clock implementation.

## Background

Merkle clocks are a method of recording events with partial order. This repo implements a method of managing merkle clocks with UCANs.

### Capabilities

#### `clock/follow`

Follow advances made by an event issuer to a clock.

Any actor can create an event to add to a clock, but how can access be restricted to a specific group?

Access control is implemented by instructing a clock to follow events created by an issuer.

After a successful invocation, any `clock/advance` invocations made by an issuer the clock is following will be permitted.

#### `clock/following`

TBD
