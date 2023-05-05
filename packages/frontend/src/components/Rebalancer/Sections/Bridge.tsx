import React, { useState } from 'react'
import { ethers, BigNumber, Signer, Transaction, Contract } from 'ethers'
import { TransactionResponse } from '@ethersproject/abstract-provider'
import { networkIdToSlug } from 'src/utils/networks'
import * as hopMetadata from '@hop-protocol/core/metadata'
import * as addresses from '@hop-protocol/core/addresses'
import Address from 'src/models/Address'
import L2_AmmWrapperAbi from '@hop-protocol/core/abi/generated/L2_AmmWrapper.json'
import Button from 'src/components/buttons/Button'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'
import { StatusMessage } from 'src/components/Rebalancer/Sections/Subsections/StatusMessage'

interface BridgeSectionProps {
  reactAppNetwork: string
  chainSlug: string
  tokenSymbol: string
  signer: Signer
  gasLimit: number
  getTokensAreStaked: (stakingContract: Contract) => Promise<boolean | undefined>
  address: Address | undefined
  erc20PositionBalance: string
  approveToken: (tokenAddress: string, spenderAddress: string, amount: string) => Promise<TransactionResponse | undefined>
  getDeadline: (confirmTimeMinutes: number) => number
  destinationNetworkId: number
  getHumanErrorMessage: (error: Error) => string
  setBridgeTxHash: (bridgeTxHash: string) => void
  goToNextSection: () => void
}

export function BridgeSection(props: BridgeSectionProps) {
  const reactAppNetwork = props.reactAppNetwork
  const chainSlug = props.chainSlug
  const tokenSymbol = props.tokenSymbol
  const signer = props.signer
  const gasLimit = props.gasLimit
  const getTokensAreStaked = props.getTokensAreStaked
  const address = props.address
  const erc20PositionBalance = props.erc20PositionBalance
  const approveToken = props.approveToken
  const getDeadline = props.getDeadline
  const destinationNetworkId = props.destinationNetworkId
  const getHumanErrorMessage = props.getHumanErrorMessage
  const setBridgeTxHash = props.setBridgeTxHash
  const goToNextSection = props.goToNextSection

  const [isTransacting, setIsTransacting] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  function isNativeToken(chainSlug: string, tokenSymbol: string): boolean {
    return tokenSymbol === (hopMetadata as any)?.[reactAppNetwork]?.chains?.[chainSlug]?.nativeTokenSymbol
  }

  // bridge canonical tokens
  async function swapAndSend() {
    const l2AmmWrapperContractAddress = (addresses as any)?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2AmmWrapper
    const l2AmmWrapperContract = new ethers.Contract(l2AmmWrapperContractAddress, L2_AmmWrapperAbi, signer)
    const canonicalTokenContractAddress = (addresses as any)?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken

    const amount: string = erc20PositionBalance

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
        bonderFee = BigNumber.from(bonderFee).mul(15).div(10).toString() // 1.5x
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
          setStatusMessage("Bridging tokens")
          setIsTransacting(true)
          swapAndSend()
        }}>
        Bridge
      </Button>
      <StatusMessage message={statusMessage} />
    </>
  )
}
