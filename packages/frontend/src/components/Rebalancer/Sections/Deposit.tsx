import React, { useState } from 'react'
import { ethers, BigNumber } from 'ethers'
import * as addresses from '@hop-protocol/core/addresses'
import saddleSwapAbi from '@hop-protocol/core/abi/generated/Swap.json'
import Button from 'src/components/buttons/Button'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'
import { StatusMessage } from 'src/components/Rebalancer/Sections/Subsections/StatusMessage'

export function DepositSection(props) {
  const [isTransacting, setIsTransacting] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  const goToNextSection = props.goToNextSection
  const reactAppNetwork = props.reactAppNetwork
  const chainSlug = props.chainSlug
  const tokenSymbol = props.tokenSymbol
  const numberOfBridgedTokensReceived = props.numberOfBridgedTokensReceived
  const signer = props.signer
  const gasLimit = props.gasLimit
  const approveToken = props.approveToken
  const getDeadline = props.getDeadline
  const tokensAreStaked = props.tokensAreStaked

  // deposit tokens
  async function addLiquidity() {
    const canonicalTokenContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
    const saddleSwapContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2SaddleSwap

    console.log(numberOfBridgedTokensReceived)

    // approve canonical token spending
    try {
      const approveTx = await approveToken(canonicalTokenContractAddress, saddleSwapContractAddress, numberOfBridgedTokensReceived)
      if (typeof approveTx !== "undefined") {
        await approveTx.wait()
          .then(() => {
            console.log("Approved successfully")
          })
          .catch(error => console.error(error))
      }
    } catch (error) {
      console.error(error)
      return
    }

    const swapContract = new ethers.Contract(saddleSwapContractAddress, saddleSwapAbi, signer)
    const minToMint = BigNumber.from(numberOfBridgedTokensReceived)
      .mul(7)
      .div(10)
      .toString()
    const deadline = getDeadline(4)

    try {
      const depositTx = await swapContract.addLiquidity([numberOfBridgedTokensReceived, 0],  minToMint, deadline, { gasLimit: gasLimit * 2 })
      await depositTx.wait()
        .then((tokensReceived) => {
          console.log("Successfully deposited tokens")
        })
        .catch(error => console.error(error))
    } catch (error) {
      console.error(error)
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
          setIsTransacting(true)
          if (tokensAreStaked) {
            console.log("tokens are staked")
            // unstake()
          } else {
            // withdrawPosition()
            console.log("tokens are not staked")
          }
        }}>
        Deposit
      </Button>
      <StatusMessage message={statusMessage} />
    </>
  )
}
