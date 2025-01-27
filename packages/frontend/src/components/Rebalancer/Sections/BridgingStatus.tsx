import React, { useState, useEffect } from 'react'
import { ethers, BigNumber } from 'ethers'
import { networkIdToSlug } from 'src/utils/networks'
import { transferTimes } from 'src/config'
import Button from 'src/components/buttons/Button'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'
import { StatusMessage } from 'src/components/Rebalancer/Sections/Subsections/StatusMessage'

interface BridgingStatusSectionProps {
  reactAppNetwork: string
  networkSlugToId: (networkSlug: string) => number
  chainSlug: string
  tokenSymbol: string
  provider: ethers.providers.Provider | undefined
  bridgeTxHash: string
  setNumberOfBridgedTokensReceived: (numberOfBridgedTokensReceived: string) => void
  connectedNetworkId: number | undefined
  bridgedFromNetworkId: number
  destinationNetworkId: number
  changeNetwork: (newChainId: number) => Promise<boolean>
  isNativeToken: (chainSlug: string, tokenSymbol: string) => boolean
  goToNextSection: () => void
  skipNextSection: () => void
  getHumanErrorMessage: (error: Error) => string
  getDeadline: (confirmTimeMinutes: number) => number
}

export function BridgingStatusSection(props: BridgingStatusSectionProps) {
  const {
    reactAppNetwork,
    networkSlugToId,
    chainSlug,
    tokenSymbol,
    provider,
    bridgeTxHash,
    setNumberOfBridgedTokensReceived,
    connectedNetworkId,
    bridgedFromNetworkId,
    destinationNetworkId,
    changeNetwork,
    isNativeToken,
    goToNextSection,
    skipNextSection,
    getHumanErrorMessage,
    getDeadline
  } = props

  const [isTransacting, setIsTransacting] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  const [networksMatch, setNetworksMatch] = useState<boolean>(false)

  // listen for the right chain connection
  useEffect(() => {
    if (connectedNetworkId === destinationNetworkId && connectedNetworkId === networkSlugToId(chainSlug)) {
      setNetworksMatch(true)
    } else {
      setNetworksMatch(false)
    }
  }, [connectedNetworkId])

  async function setBridgedTokenData(bondTxHash: string) {
    const bondTxReceipt = await provider?.getTransactionReceipt(bondTxHash)
    let tokensReceived: string

    if (typeof bondTxReceipt?.logs !== "undefined") {
      tokensReceived = BigNumber.from(bondTxReceipt.logs[11].data).toString()
      console.log("Bridged token balance:", tokensReceived)
      setNumberOfBridgedTokensReceived(tokensReceived)
    } else {
      console.log("Could not get bond data")
    }
  }

  async function checkBridgeStatusAndGetBondHash() {
    const pollingIntervalInSeconds = 10

    const bridgeStatusURL: string = `https://api.hop.exchange/v1/transfer-status?transactionHash=${bridgeTxHash}&network=${reactAppNetwork}`

    console.log(bridgeStatusURL)

    const endpointDeadline = getDeadline(2)

    // poll the API endpoint for a couple minutes before determining if the URL is valid
    let data
    while (getDeadline(0) < endpointDeadline) {
      const response = await fetch(bridgeStatusURL)
      data = await response.json()
      if (typeof data.bonded !== "undefined") {
        break
      }
    }

    if (typeof data.error !== "undefined") {
      console.log("Error checking bridge status")
      return
    }

    let waitInMinutes: number = 10
    if (connectedNetworkId && bridgedFromNetworkId !== 0 && typeof (transferTimes as any)?.[networkIdToSlug(bridgedFromNetworkId)][chainSlug] !== "undefined") {
      waitInMinutes = (transferTimes as any)?.[networkIdToSlug(bridgedFromNetworkId)][chainSlug]
    }

    console.log(`Setting deadline for ${waitInMinutes} minutes`)
    const bridgeTransactionDeadline = getDeadline(waitInMinutes)

    while (getDeadline(0) < bridgeTransactionDeadline) {
      const response = await fetch(bridgeStatusURL)
      const data = await response.json()

      if (data.bonded) {
        const bondHash = data.bondTransactionHash
        console.log("Successfully bridged tokens with hash:", bondHash)
        return bondHash
      } else {
        console.log("Could not yet confirm successful bridging, rechecking with transaction hash:", bridgeTxHash)
      }

      await new Promise(resolve => setTimeout(resolve, 1000 * pollingIntervalInSeconds))
    }
    console.log("Unable to confirm successful bridge transaction")
  }

  async function setBridgeData() {
    setStatusMessage("Checking bridge, this may take a few minutes")
    try {
      const bondTxHash = await checkBridgeStatusAndGetBondHash()
      await setBridgedTokenData(bondTxHash)
      setIsTransacting(false)
      setStatusMessage("Successfully got bridge data")

      if (isNativeToken(chainSlug, tokenSymbol)) {
        console.log("Wrap required")
        goToNextSection()
      } else {
        console.log("Wrap not required")
        skipNextSection()
      }
    } catch (error) {
      console.error(error)
      setStatusMessage("Unable to confirm successful bridge transaction")
      setIsTransacting(false)
    }
  }

  function switchNetwork() {
    setStatusMessage("Switching networks")
    changeNetwork(destinationNetworkId)
      .then(response => {
        if (response) {
          setStatusMessage("Switched networks")
          setIsTransacting(false)
          setNetworksMatch(true)
        } else {
          setStatusMessage("Error: Could not switch networks")
          setIsTransacting(false)
        }
      })
      .catch(error => {
          console.error(error)
          setStatusMessage(getHumanErrorMessage(error))
          setIsTransacting(false)
      })
  }

  return (
    <>
      <SectionHeader title="Bridge status" subtitle="Check if your bridge transaction was successful" />
      <Button
        highlighted={!isTransacting}
        loading={isTransacting}
        large
        fullWidth
        onClick={() => {
          setIsTransacting(true)
          if (networksMatch) {
            setBridgeData()
          } else {
            switchNetwork()
          }
        }}>
        { networksMatch ? "Check Bridge Status" : "Switch Networks" }
      </Button>
      <StatusMessage message={statusMessage} />
    </>
  )
}
