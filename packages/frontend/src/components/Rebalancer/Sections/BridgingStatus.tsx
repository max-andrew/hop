import React, { useState, useEffect } from 'react'
import { networkSlugToId } from 'src/utils/networks'
import Button from 'src/components/buttons/Button'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'
import { StatusMessage } from 'src/components/Rebalancer/Sections/Subsections/StatusMessage'

export function BridgingStatusSection(props) {
  const reactAppNetwork = props.reactAppNetwork
  const chainSlug = props.chainSlug
  const provider = props.provider
  const bridgeTxHash = props.bridgeTxHash
  const setNumberOfBridgedTokensReceived = props.setNumberOfBridgedTokensReceived
  const connectedNetworkId = props.connectedNetworkId
  const destinationNetworkId = props.destinationNetworkId
  const changeNetwork = props.changeNetwork
  const goToNextSection = props.goToNextSection
  const getHumanErrorMessage = props.getHumanErrorMessage
  const getDeadline = props.getDeadline

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
      tokensReceived = parseInt(bondTxReceipt.logs[11].data, 16).toString()
      console.log("Bridged token balance:", tokensReceived)
      setNumberOfBridgedTokensReceived(tokensReceived)
    } else {
      console.log("Could not get bond data")
    }
  }

  async function checkBridgeStatusAndGetBondHash() {
    const bridgeStatusURL: string = `https://api.hop.exchange/v1/transfer-status?transactionHash=${bridgeTxHash}&network=${reactAppNetwork}`

    const response = await fetch(bridgeStatusURL)
    const data = await response.json()

    if (typeof data.error !== "undefined") {
      console.log("Error checking bridge status")
      return
    }

    const deadline = getDeadline(5)
    const pollingIntervalInSeconds = 10

    while (getDeadline(0) < deadline) {
      const response = await fetch(bridgeStatusURL)
      const data = await response.json()

      if (data.bonded) {
        const bondHash = data.bondTransactionHash
        console.log("Successfully bridged tokens with hash:", bondHash)
        return bondHash
      } else {
        console.log("Could not yet confirm successful bridging, rechecking")
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
      goToNextSection()
    } catch (error) {
      console.error(error)
      setStatusMessage(getHumanErrorMessage(error))
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