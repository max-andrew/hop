import React, { useState, useEffect } from 'react'
import { ethers, BigNumber } from 'ethers'

import * as addresses from '@hop-protocol/core/addresses'
import * as metadata from '@hop-protocol/core/metadata'

import { hopStakingRewardsContracts } from 'src/config/addresses'
import { stakingRewardsAbi } from '@hop-protocol/core/abi'
import saddleSwapAbi from '@hop-protocol/core/abi/generated/Swap.json'

import Button from 'src/components/buttons/Button'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'
import { StatusMessage } from 'src/components/Rebalancer/Sections/Subsections/StatusMessage'

export function UnstakeWithdrawSection(props) {
  const reactAppNetwork = props.reactAppNetwork
  const chainSlug = props.chainSlug
  const tokenSymbol = props.tokenSymbol
  const signer = props.signer
  const getTokensAreStaked = props.getTokensAreStaked
  const erc20PositionBalance = props.erc20PositionBalance
  const goToNextSection = props.goToNextSection
  const gasLimit = props.gasLimit
  const address = props.address
  const approveToken = props.approveToken
  const getDeadline = props.getDeadline
  const getHumanErrorMessage = props.getHumanErrorMessage
  const setERC20PositionBalance = props.setERC20PositionBalance
  const setShowRebalanceModal = props.setShowRebalanceModal

  const stakingContractAddress = hopStakingRewardsContracts?.[reactAppNetwork]?.[chainSlug]?.[tokenSymbol]
  const stakingContract = new ethers.Contract(stakingContractAddress, stakingRewardsAbi, signer)

  const [tokensAreStaked, setTokensAreStaked] = useState<boolean>(true)

  useEffect(() => {
    const stakingContractAddress = hopStakingRewardsContracts?.[reactAppNetwork]?.[chainSlug]?.[tokenSymbol]
    const stakingContract = new ethers.Contract(stakingContractAddress, stakingRewardsAbi, signer)
    
    async function updateStakeStatus(setTokensAreStaked) {
      try {
        getTokensAreStaked(stakingContract)
          .then(response => {
            if (typeof response !== "undefined") {
              setTokensAreStaked(response)
            }
          })
      } catch (error) {
        console.log(error)
      }
    }

    updateStakeStatus(setTokensAreStaked)
  }, [])

  const [isTransacting, setIsTransacting] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  async function unstake() {
    const stakingContractAddress = hopStakingRewardsContracts?.[reactAppNetwork]?.[chainSlug]?.[tokenSymbol]
    const stakingContract = new ethers.Contract(stakingContractAddress, stakingRewardsAbi, signer)

    if (tokensAreStaked) {
      // unstake LP tokens
      setStatusMessage("Unstaking tokens")
      try {
        const stakeTx = await stakingContract.exit({ gasLimit: gasLimit })
        await stakeTx.wait()
          .then(() => {
            console.log("Unstaked successfully")
            setStatusMessage("Unstaked successfully")
            setTokensAreStaked(false)
            setIsTransacting(false)
          })
          .catch(error => {
            console.error(error)
            setStatusMessage(getHumanErrorMessage(error))
            setIsTransacting(false)
          })
      } catch (error) {
        console.error(error)
        setStatusMessage(getHumanErrorMessage(error))
        setIsTransacting(false)
      }
    }
  }

  async function withdrawPosition() {
    const lpTokenContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2SaddleLpToken
    const saddleSwapContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2SaddleSwap

    const balanceOfAbi = ["function balanceOf(address account) view returns (uint256)"]
    const lpTokenContract = new ethers.Contract(lpTokenContractAddress, balanceOfAbi, signer)

    let balance

    // get balance of LP token
    try {
      balance = await lpTokenContract.balanceOf(address?.address)
      balance = balance.toString()

      if (balance === "0") {
        console.log("No tokens to withdraw")
        setStatusMessage("No tokens to withdraw")
        setIsTransacting(false)
        setShowRebalanceModal(false)
        return
      } else {
        console.log("LP token balance:", balance)
      }
    } catch (error) {
      console.error(error)
      setStatusMessage(getHumanErrorMessage(error))
      setIsTransacting(false)
      return
    }

    // approve LP token spending
    setStatusMessage("Approving LP token spending")
    try {
      const approveTx = await approveToken(lpTokenContractAddress, saddleSwapContractAddress, balance)
      if (typeof approveTx !== "undefined") {
        await approveTx.wait()
          .then(() => {
            console.log("Approved successfully")
            setStatusMessage("Approved LP token spending")
            removeLiquidityOneToken(balance)
          })
          .catch(error => {
            console.error(error)
            setStatusMessage(getHumanErrorMessage(error))
            setIsTransacting(false)
          })
      } else {
        setStatusMessage("Could not approve tokens")
        removeLiquidityOneToken(balance)
      }
    } catch (error) {
      console.error(error)
      setStatusMessage(getHumanErrorMessage(error))
      setIsTransacting(false)
    }

    async function removeLiquidityOneToken(amount: string) {
      const swapContract = new ethers.Contract(saddleSwapContractAddress, saddleSwapAbi, signer)

      // adjust for potential difference in decimals between LP tokens and collateral
      const decimals = metadata[reactAppNetwork].tokens[tokenSymbol].decimals
      let minAmountBN: BigNumber = BigNumber.from(balance.toString())
      if (decimals < 18) {
        minAmountBN = minAmountBN.div(10 ** (18 - decimals))
      }
      const minAmount: string = minAmountBN.mul(70).div(100).toString()

      const deadline = getDeadline(2)

      try {
        setStatusMessage("Withdrawing tokens")
        const removeLiquidityTx = await swapContract.removeLiquidityOneToken(amount, 0, minAmount, deadline, { gasLimit: gasLimit })
        await removeLiquidityTx.wait()
          .then(async (removeLiquidityTxReceipt) => {
            if (typeof removeLiquidityTxReceipt !== "undefined") {
              let numberOfTokensWithdrawn: string = removeLiquidityTxReceipt.logs[2].data.toString()
              numberOfTokensWithdrawn = parseInt(numberOfTokensWithdrawn, 16).toString()

              console.log("Successfully withdrew", numberOfTokensWithdrawn, "tokens")
              setStatusMessage("Successfully withdrew tokens")
              setIsTransacting(false)
              setERC20PositionBalance(numberOfTokensWithdrawn)
              goToNextSection()
            } else {
              setIsTransacting(false)
              setStatusMessage("Error: no tokens to withdraw")
              setERC20PositionBalance("0")
            }
          })
          .catch(error => {
            console.error(error)
            setStatusMessage(getHumanErrorMessage(error))
            setIsTransacting(false)
          })
      } catch (error) {
        console.error(error)
        setStatusMessage(getHumanErrorMessage(error))
        setIsTransacting(false)
      }
    }
  }

  return (
    <>
      <SectionHeader title="Unstake & withdraw" subtitle="Withdraw your tokens from the pool" />
      <Button
        highlighted={!isTransacting}
        loading={isTransacting}
        large
        fullWidth
        onClick={() => {
          setIsTransacting(true)
          if (tokensAreStaked) {
            unstake()
          } else {
            withdrawPosition()
          }
        }}>
        { tokensAreStaked ? "Unstake" : "Withdraw" }
      </Button>
      <StatusMessage message={statusMessage} />
    </>
  )
}
