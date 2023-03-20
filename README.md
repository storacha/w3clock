# w3clock

<p>
  <a href="https://github.com/web3-storage/freeway/actions/workflows/release.yml"><img alt="GitHub Workflow Status" src="https://img.shields.io/github/actions/workflow/status/web3-storage/w3clock/test.yml?branch=main&style=for-the-badge" /></a>
  <a href="https://standardjs.com"><img alt="StandardJS Code Style" src="https://img.shields.io/badge/code_style-standard-brightgreen.svg?style=for-the-badge" /></a>
  <a href="https://discord.com/channels/806902334369824788/864892166470893588"><img src="https://img.shields.io/badge/chat-discord?style=for-the-badge&logo=discord&label=discord&logoColor=ffffff&color=7389D8" /></a>
  <a href="https://github.com/web3-storage/w3clock/blob/main/LICENSE.md"><img alt="License: Apache-2.0 OR MIT" src="https://img.shields.io/badge/LICENSE-Apache--2.0%20OR%20MIT-yellow?style=for-the-badge" /></a>
</p>


UCAN based merkle clock implementation.

## Background

Merkle clocks are a method of recording events with partial order. This repo implements a method of managing merkle clocks with UCANs.

### Capabilities

#### `clock/advance`

Advance the clock by adding a new event.

#### `clock/head`

Get the current clock head.

#### `clock/follow`

Follow advances made by an event issuer to a clock.

#### `clock/following`

TBD

#### `clock/unfollow`

TBD
