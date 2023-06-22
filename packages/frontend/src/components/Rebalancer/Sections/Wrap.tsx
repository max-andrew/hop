import React, { useState } from 'react'
import { ethers } from 'ethers'
import * as addresses from '@hop-protocol/core/addresses'
import { Addresses } from '@hop-protocol/core/addresses'
import Button from 'src/components/buttons/Button'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'
import { StatusMessage } from 'src/components/Rebalancer/Sections/Subsections/StatusMessage'

interface WrapSectionProps {
  reactAppNetwork: string
  networksMatch: boolean
  checkConnectedNetworkId: (networkId: number) => Promise<boolean>
  connectedNetworkId: number | undefined
  networkSlugToId: (networkSlug: string) => number
  chainSlug: string
  tokenSymbol: string
  numberOfBridgedTokensReceived: string
  signer: ethers.Signer
  isNativeToken: (chainSlug: string, tokenSymbol: string) => boolean
  goToNextSection: () => void
  getHumanErrorMessage: (errorMessage: Error) => string
}

export function WrapSection(props: WrapSectionProps) {
  const {
    reactAppNetwork,
    networksMatch,
    checkConnectedNetworkId,
    connectedNetworkId,
    networkSlugToId,
    chainSlug,
    tokenSymbol,
    numberOfBridgedTokensReceived,
    signer,
    isNativeToken,
    goToNextSection,
    getHumanErrorMessage
  } = props

  const [isTransacting, setIsTransacting] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  async function wrap(amountToWrap: string) {
    const contractAddress = (addresses as any)?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
    const abi = ["function deposit() payable"]
    const contract = new ethers.Contract(contractAddress, abi, signer)
    const gasLimit = await contract.estimateGas.deposit({ value: amountToWrap })

    return await contract.deposit({ value: amountToWrap, gasLimit: gasLimit })
  }

  async function wrapIfNativeToken() {
    if (isNativeToken(chainSlug, tokenSymbol)) {
      try {
        const wrapTx = await wrap(numberOfBridgedTokensReceived)

        await wrapTx.wait()
          .then(() => {
            console.log("Successfully wrapped")
            setStatusMessage("Successfully wrapped")
            setIsTransacting(false)
            goToNextSection()
          })
          .catch((error: Error) => {
            console.error(error)
            setStatusMessage(getHumanErrorMessage(error))
            setIsTransacting(false)
          })
      } catch (error) {
        console.error(error)
        setStatusMessage(getHumanErrorMessage(error as Error))
        setIsTransacting(false)
      }
    } else {
      console.log("Token is ERC20, no wrap necessary")
      setStatusMessage("No wrap necessary")
      setIsTransacting(false)
      goToNextSection()
    }
  }

  return (
    <>
      <SectionHeader title="Wrap" subtitle="Wrap native tokens to deposit" />
      <Button
        highlighted={!isTransacting}
        loading={isTransacting}
        large
        fullWidth
        onClick={() => {
          if (networksMatch) {
            setStatusMessage("Wrapping tokens")
            setIsTransacting(true)
            wrapIfNativeToken()
          } else {
            connectedNetworkId && checkConnectedNetworkId(networkSlugToId(chainSlug))
          }
        }}>
        { networksMatch ? "Wrap" : "Switch Networks" }
      </Button>
      <StatusMessage message={statusMessage} />
    </>
  )
}
