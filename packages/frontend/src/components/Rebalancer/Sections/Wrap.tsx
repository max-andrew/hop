import React, { useState } from 'react'
import { ethers } from 'ethers'
import * as hopMetadata from '@hop-protocol/core/metadata'
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
  goToNextSection: () => void
  getHumanErrorMessage: (errorMessage: Error) => string
}

export function WrapSection(props: WrapSectionProps) {
  const reactAppNetwork = props.reactAppNetwork
  const networksMatch = props.networksMatch
  const checkConnectedNetworkId = props.checkConnectedNetworkId
  const connectedNetworkId = props.connectedNetworkId
  const networkSlugToId = props.networkSlugToId
  const chainSlug = props.chainSlug
  const tokenSymbol = props.tokenSymbol
  const numberOfBridgedTokensReceived = props.numberOfBridgedTokensReceived
  const signer = props.signer
  const goToNextSection = props.goToNextSection
  const getHumanErrorMessage = props.getHumanErrorMessage

  const [isTransacting, setIsTransacting] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  function isNativeToken(chainSlug: string, tokenSymbol: string): boolean {
    let adjustedTokenSymbol = tokenSymbol

    if (tokenSymbol === "DAI" && chainSlug === "gnosis") {
      adjustedTokenSymbol = "XDAI"
    }

    return adjustedTokenSymbol === (hopMetadata as any)?.[reactAppNetwork]?.chains?.[chainSlug]?.nativeTokenSymbol
  }

  async function wrapETH(amountToWrap: string) {
    const wETHContractAddress = (addresses as any)?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
    const wethAbi = ["function deposit() payable"]
    const wethContract = new ethers.Contract(wETHContractAddress, wethAbi, signer)
    const gasLimit = await wethContract.estimateGas.deposit({ value: amountToWrap })

    return await wethContract.deposit({ value: amountToWrap, gasLimit: gasLimit })
  }

  async function wrapDAI(amountToWrap: string) {
    const wDAIContractAddress = (addresses as any)?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
    const wDAIAbi = ["function deposit() payable"]
    const wDAIContract = new ethers.Contract(wDAIContractAddress, wDAIAbi, signer)
    const gasLimit = await wDAIContract.estimateGas.deposit({ value: amountToWrap })

    return wDAIContract.deposit({ value: amountToWrap, gasLimit: gasLimit })
  }

  async function wrapIfNativeToken() {
    if (isNativeToken(chainSlug, tokenSymbol)) {
      try {
        let wrapTx
        if (tokenSymbol === "ETH") {
          wrapTx = await wrapETH(numberOfBridgedTokensReceived)
        } else if (tokenSymbol === "DAI") {
          wrapTx = await wrapDAI(numberOfBridgedTokensReceived)
        } else {
          console.log("Could not identify token to wrap")
          setStatusMessage("Error wrapping token")
          setIsTransacting(false)
          return
        }

        await wrapTx.wait()
          .then(() => {
            console.log("Successfully wrapped ETH")
            setStatusMessage("Successfully wrapped ETH")
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
