import React, { useState } from 'react'
import { ethers, BigNumber, Signer } from 'ethers'
import { TransactionResponse } from '@ethersproject/abstract-provider'
import * as addresses from '@hop-protocol/core/addresses'
import saddleSwapAbi from '@hop-protocol/core/abi/generated/Swap.json'
import Button from 'src/components/buttons/Button'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'
import { StatusMessage } from 'src/components/Rebalancer/Sections/Subsections/StatusMessage'

interface DepositSectionProps {
  reactAppNetwork: string
  networksMatch: boolean
  checkConnectedNetworkId: (networkId: number) => Promise<boolean>
  connectedNetworkId: number | undefined
  networkSlugToId: (networkSlug: string) => number
  chainSlug: string
  tokenSymbol: string
  numberOfBridgedTokensReceived: string
  signer: Signer
  approveToken: (tokenAddress: string, spenderAddress: string, amount: string) => Promise<TransactionResponse | undefined>
  getDeadline: (confirmTimeMinutes: number) => number
  getHumanErrorMessage: (error: Error) => string
  goToNextSection: () => void
}

export function DepositSection(props: DepositSectionProps) {
  const reactAppNetwork = props.reactAppNetwork
  const networksMatch = props.networksMatch
  const checkConnectedNetworkId = props.checkConnectedNetworkId
  const connectedNetworkId = props.connectedNetworkId
  const networkSlugToId = props.networkSlugToId
  const chainSlug = props.chainSlug
  const tokenSymbol = props.tokenSymbol
  const numberOfBridgedTokensReceived = props.numberOfBridgedTokensReceived
  const signer = props.signer
  const approveToken = props.approveToken
  const getDeadline = props.getDeadline
  const getHumanErrorMessage = props.getHumanErrorMessage
  const goToNextSection = props.goToNextSection

  const [isTransacting, setIsTransacting] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  // deposit tokens
  async function addLiquidity() {
    const canonicalTokenContractAddress = (addresses as any)?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
    const saddleSwapContractAddress = (addresses as any)?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2SaddleSwap

    // approve canonical token spending
    try {
      const approveTx = await approveToken(canonicalTokenContractAddress, saddleSwapContractAddress, numberOfBridgedTokensReceived)
      if (typeof approveTx !== "undefined") {
        await approveTx.wait()
          .then(() => {
            console.log("Approved successfully")
            setStatusMessage("Approved successfully")
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

    const swapContract = new ethers.Contract(saddleSwapContractAddress, saddleSwapAbi, signer)
    const minToMint = BigNumber.from(numberOfBridgedTokensReceived)
      .mul(7)
      .div(10)
      .toString()
    const deadline = getDeadline(4)

    try {
      console.log("numberOfBridgedTokensReceived", numberOfBridgedTokensReceived)
      const gasLimit = await swapContract.estimateGas.addLiquidity(["9714612474161344754", 0], minToMint, deadline)
      const depositTx = await swapContract.addLiquidity(["9714612474161344754", 0],  minToMint, deadline, { gasLimit: gasLimit })
      
      await depositTx.wait()
        .then((tokensReceived: string) => {
          console.log("Successfully deposited tokens")
          setStatusMessage("Successfully deposited tokens")
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
      <SectionHeader title="Deposit" subtitle="Add tokens to the pool" />
      <Button
        highlighted={!isTransacting}
        loading={isTransacting}
        large
        fullWidth
        onClick={() => {
          if (networksMatch) {
            setIsTransacting(true)
            addLiquidity()
          } else {
            connectedNetworkId && checkConnectedNetworkId(networkSlugToId(chainSlug))
          }
        }}>
        { networksMatch ? "Deposit" : "Switch Networks" }
      </Button>
      <StatusMessage message={statusMessage} />
    </>
  )
}
