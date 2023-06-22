import React, { useState } from 'react'
import { ethers, Signer } from 'ethers'
import * as addresses from '@hop-protocol/core/addresses'
import Button from 'src/components/buttons/Button'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'
import { StatusMessage } from 'src/components/Rebalancer/Sections/Subsections/StatusMessage'

interface UnwrapSectionProps {
  reactAppNetwork: string
  networksMatch: boolean
  checkConnectedNetworkId: (networkId: number) => Promise<boolean>
  connectedNetworkId: number | undefined
  networkSlugToId: (networkSlug: string) => number
  chainSlug: string
  tokenSymbol: string
  signer: Signer
  erc20PositionBalance: string
  getHumanErrorMessage: (error: Error) => string
  isNativeToken: (chainSlug: string, tokenSymbol: string) => boolean
  goToNextSection: () => void
}

export function UnwrapSection(props: UnwrapSectionProps) {
  const {
    reactAppNetwork,
    networksMatch,
    checkConnectedNetworkId,
    connectedNetworkId,
    networkSlugToId,
    chainSlug,
    tokenSymbol,
    signer,
    erc20PositionBalance,
    getHumanErrorMessage,
    isNativeToken,
    goToNextSection
  } = props

  const [isTransacting, setIsTransacting] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  async function unwrap(amountToUnwrap: string) {
    const contractAddress = (addresses as any)?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
    const abi = ["function withdraw(uint256 _amount) external returns (bool)"]
    const contract = new ethers.Contract(contractAddress, abi, signer)
    const gasLimit = await contract.estimateGas.withdraw(amountToUnwrap)

    return await contract.withdraw(amountToUnwrap, { gasLimit: gasLimit })
  }

  async function unwrapIfNativeToken() {
    if (isNativeToken(chainSlug, tokenSymbol)) {
      try {
        const unwrapTx = await unwrap(erc20PositionBalance)

        await unwrapTx.wait()
          .then(() => {
            console.log("Successfully unwrapped")
            setStatusMessage("Successfully unwrapped")
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
      console.log("Token is ERC20, no unwrap necessary")
      setStatusMessage("No unwrap necessary")
      setIsTransacting(false)
      goToNextSection()
    }
  }

  return (
    <>
      <SectionHeader title="Unwrap" subtitle="Convert your tokens to the native version" />
      <Button
        highlighted={!isTransacting}
        loading={isTransacting}
        large
        fullWidth
        onClick={() => {
          if (networksMatch) {
            setStatusMessage("Unwrapping tokens")
            setIsTransacting(true)
            unwrapIfNativeToken()
          } else {
            connectedNetworkId && checkConnectedNetworkId(networkSlugToId(chainSlug))
          }
        }}>
        { networksMatch ? "Unwrap" : "Switch Networks" }
      </Button>
      <StatusMessage message={statusMessage} />
    </>
  )
}
