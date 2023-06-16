import React, { useState } from 'react'
import { ethers, BigNumber, Signer, Transaction, Contract } from 'ethers'
import { TransactionResponse } from '@ethersproject/abstract-provider'
import { networkIdToSlug } from 'src/utils/networks'
import useAvailableLiquidity from 'src/pages/Send/useAvailableLiquidity'
import * as hopMetadata from '@hop-protocol/core/metadata'
import * as addresses from '@hop-protocol/core/addresses'
import { HopBridge } from '@hop-protocol/sdk'
import Address from 'src/models/Address'
import L2_AmmWrapperAbi from '@hop-protocol/core/abi/generated/L2_AmmWrapper.json'
import Button from 'src/components/buttons/Button'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'
import { StatusMessage } from 'src/components/Rebalancer/Sections/Subsections/StatusMessage'

interface BridgeSectionProps {
  reactAppNetwork: string
  networksMatch: boolean
  checkConnectedNetworkId: (networkId: number) => Promise<boolean>
  connectedNetworkId: number | undefined
  networkSlugToId: (networkSlug: string) => number
  chainSlug: string
  tokenSymbol: string
  signer: Signer
  getTokensAreStaked: (stakingContract: Contract) => Promise<boolean | undefined>
  address: Address | undefined
  erc20PositionBalance: string
  approveToken: (tokenAddress: string, spenderAddress: string, amount: string) => Promise<TransactionResponse | undefined>
  getDeadline: (confirmTimeMinutes: number) => number
  destinationNetworkId: number
  getHumanErrorMessage: (error: Error) => string
  setBridgeTxHash: (bridgeTxHash: string) => void
  selectedBridge: HopBridge
  goToNextSection: () => void
}

export function BridgeSection(props: BridgeSectionProps) {
  const {
    reactAppNetwork,
    networksMatch,
    checkConnectedNetworkId,
    connectedNetworkId,
    networkSlugToId,
    chainSlug,
    tokenSymbol,
    signer,
    getTokensAreStaked,
    address,
    erc20PositionBalance,
    approveToken,
    getDeadline,
    destinationNetworkId,
    getHumanErrorMessage,
    setBridgeTxHash,
    selectedBridge,
    goToNextSection
  } = props

  const [isTransacting, setIsTransacting] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  // get the bridge liquidity available
  const { availableLiquidity } = useAvailableLiquidity(selectedBridge, chainSlug, networkIdToSlug(destinationNetworkId))

  function isNativeToken(chainSlug: string, tokenSymbol: string): boolean {
    let adjustedTokenSymbol = tokenSymbol

    if (tokenSymbol === "DAI" && chainSlug === "gnosis") {
      adjustedTokenSymbol = "XDAI"
    }

    return adjustedTokenSymbol === (hopMetadata as any)?.[reactAppNetwork]?.chains?.[chainSlug]?.nativeTokenSymbol
  }

  // bridge canonical tokens
  async function swapAndSend() {
    const l2AmmWrapperContractAddress = (addresses as any)?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2AmmWrapper
    const l2AmmWrapperContract = new ethers.Contract(l2AmmWrapperContractAddress, L2_AmmWrapperAbi, signer)
    const canonicalTokenContractAddress = (addresses as any)?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken

    // use whatever amount is less between the position balance and available liquidity
    const amount: string = (availableLiquidity && erc20PositionBalance > availableLiquidity.toString()) ? availableLiquidity.toString() : erc20PositionBalance

    // if not native token, approve token spending
    if (!isNativeToken(chainSlug, tokenSymbol)) {
      try {
        setStatusMessage("Approving spending")

        const approveTx = await approveToken(canonicalTokenContractAddress, l2AmmWrapperContractAddress, amount)
        if (typeof approveTx !== "undefined") {
          await approveTx.wait()
            .then(() => {
              console.log("Approved successfully")
              setStatusMessage("Successfully approved spending")
            })
            .catch(error => {
              console.error(error)
              setStatusMessage(getHumanErrorMessage(error))
              setIsTransacting(false)
            })
        }
      } catch (error) {
        console.error(error)
        setStatusMessage(getHumanErrorMessage(error as Error))
        setIsTransacting(false)
        return
      }
    } else {
      setStatusMessage("No approval necessary")
    }

    const recipient = address?.address
    let bonderFee: string
    const amountOutMin = amount !== null ? BigNumber.from(amount).mul(70).div(100).toString() : "0"
    const deadline = getDeadline(15)
    const destinationAmountOutMin = amountOutMin
    const destinationDeadline = getDeadline(30)

    const destinationNetworkSlug = networkIdToSlug(destinationNetworkId)

    console.log(`Getting bonder fee for bridging ${amount} ${tokenSymbol} from ${chainSlug} to ${destinationNetworkSlug}`)

    try {
      const response = await fetch(`https://api.hop.exchange/v1/quote?amount=${amount}&token=${tokenSymbol}&fromChain=${chainSlug}&toChain=${destinationNetworkSlug}&slippage=0.5`)
      const data = await response.json()
  
      bonderFee = data.bonderFee

      if (reactAppNetwork === "goerli") {
        bonderFee = BigNumber.from(bonderFee).mul(25).div(10).toString() // 2.5x
      }

      console.log("Bonder fee:", bonderFee)
    } catch (error) {
      console.error(error)
      setStatusMessage(getHumanErrorMessage(error as Error))
      setIsTransacting(false)
      return
    }

    let value = "0"
    if (isNativeToken(chainSlug, tokenSymbol)) {
      value = amount
    }
    
    // bridge tokens
    try {
      setStatusMessage("Sending tokens to bridge")

      console.dir(
        "Bridging with parameters:",
        {
          destinationNetworkId,
          recipient,
          amount,
          bonderFee,
          amountOutMin,
          deadline,
          destinationAmountOutMin,
          destinationDeadline,
          value
        }
      )

      const gasLimit = await l2AmmWrapperContract.estimateGas.swapAndSend(
        destinationNetworkId,
        recipient,
        amount,
        bonderFee,
        amountOutMin,
        deadline,
        destinationAmountOutMin,
        destinationDeadline,
        {
          value: value
        }
      )

      const bridgeTx = await l2AmmWrapperContract.swapAndSend(
        destinationNetworkId,
        recipient,
        amount,
        bonderFee,
        amountOutMin,
        deadline,
        destinationAmountOutMin,
        destinationDeadline,
        {
          value: value,
          gasLimit: gasLimit
        }
      )

      setBridgeTxHash(bridgeTx.hash)

      await bridgeTx.wait()
        .then(() => {
          console.log("Successfully sent tokens with hash:", bridgeTx.hash)
          setStatusMessage("Successfully sent tokens")
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
  }

  return (
    <>
      <SectionHeader title="Bridge" subtitle="Send your tokens to the destination network" />
      <Button
        highlighted={!isTransacting}
        loading={isTransacting}
        large
        fullWidth
        onClick={() => {
          if (networksMatch) {
            setStatusMessage("Bridging tokens")
            setIsTransacting(true)
            swapAndSend()
          } else {
            connectedNetworkId && checkConnectedNetworkId(networkSlugToId(chainSlug))
          }
        }}>
        { networksMatch ? "Bridge" : "Switch Networks" }
      </Button>
      <StatusMessage message={statusMessage} />
    </>
  )
}
