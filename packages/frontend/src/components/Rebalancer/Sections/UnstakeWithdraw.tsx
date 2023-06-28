import React, { useState, useEffect } from 'react'
import { ethers, BigNumber, Signer, Contract } from 'ethers'
import { TransactionResponse, TransactionReceipt } from '@ethersproject/abstract-provider'

import * as addresses from '@hop-protocol/core/addresses'
import * as metadata from '@hop-protocol/core/metadata'
import Address from 'src/models/Address'

import { stakingRewardsContracts, stakingRewardTokens, hopStakingRewardsContracts } from 'src/config/addresses'
import { stakingRewardsAbi } from '@hop-protocol/core/abi'
import saddleSwapAbi from '@hop-protocol/core/abi/generated/Swap.json'

import Button from 'src/components/buttons/Button'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'
import { StatusMessage } from 'src/components/Rebalancer/Sections/Subsections/StatusMessage'

interface UnstakeWithdrawSectionProps {
  reactAppNetwork: string
  networksMatch: boolean
  checkConnectedNetworkId: (networkId: number) => Promise<boolean>
  connectedNetworkId: number | undefined
  networkSlugToId: (networkSlug: string) => number
  chainSlug: string
  tokenSymbol: string
  signer: Signer
  address: Address | undefined
  approveToken: (tokenAddress: string, spenderAddress: string, amount: string) => Promise<TransactionResponse | undefined>
  getDeadline: (confirmTimeMinutes: number) => number
  setERC20PositionBalance: (erc20PositionBalance: string) => void
  setHTokenPositionBalance: (hTokenPositionBalance: string) => void
  setShowRebalancerModal: (showRebalancerModal: boolean) => void
  getHumanErrorMessage: (error: Error) => string
  isNativeToken: (chainSlug: string, tokenSymbol: string) => boolean
  goToNextSection: () => void
  skipNextSection: () => void
}

export function UnstakeWithdrawSection(props: UnstakeWithdrawSectionProps) {
  const { 
    reactAppNetwork,
    networksMatch,
    checkConnectedNetworkId,
    connectedNetworkId,
    networkSlugToId,
    chainSlug,
    tokenSymbol,
    signer,
    address,
    approveToken,
    getDeadline,
    setERC20PositionBalance,
    setHTokenPositionBalance,
    setShowRebalancerModal,
    getHumanErrorMessage,
    isNativeToken,
    goToNextSection,
    skipNextSection
  } = props

  const [tokensAreStaked, setTokensAreStaked] = useState<boolean>(true)
  const [stakingContractAddress, setStakingContractAddress] = useState<string>("")

  useEffect(() => {
    (async () => {
      try {
        // get the amount staked of each possible rewards token
        let hopStakedBalance: string = ""
        const hopStakingContractAddress = (hopStakingRewardsContracts as any)?.[reactAppNetwork]?.[chainSlug]?.[tokenSymbol]
        if (typeof hopStakingContractAddress !== "undefined") {
          const hopStakingContract = new ethers.Contract(hopStakingContractAddress, stakingRewardsAbi, signer)
          hopStakedBalance = await hopStakingContract.balanceOf(address?.address)
          hopStakedBalance = hopStakedBalance.toString()
        }

        let alternateStakedBalance: string = ""
        const alternateStakingContractAddress = (stakingRewardsContracts as any)?.[reactAppNetwork]?.[chainSlug]?.[tokenSymbol]
        if (typeof alternateStakingContractAddress !== "undefined") {
          const alternateStakingContract = new ethers.Contract(alternateStakingContractAddress, stakingRewardsAbi, signer)
          alternateStakedBalance = await alternateStakingContract.balanceOf(address?.address)
          alternateStakedBalance = alternateStakedBalance.toString()
        }
        
        if (hopStakedBalance > "0") {
          console.log("Hop staked token balance:", hopStakedBalance)
          setTokensAreStaked(true)
          setStakingContractAddress(hopStakingContractAddress)
        } else if (alternateStakedBalance > "0") {
          console.log("Alternate staked token balance:", alternateStakedBalance)
          setTokensAreStaked(true)
          setStakingContractAddress(alternateStakingContractAddress)
        } else {
          console.error("Error finding staked balance")
          setTokensAreStaked(false)
        }
      } catch (error) {
        console.error(error)
      }
    })()
  }, [])

  const [isTransacting, setIsTransacting] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  async function unstake() {
    if (tokensAreStaked && stakingContractAddress !== "") {
      setStatusMessage("Unstaking tokens")
      try {
        const stakingContract = new ethers.Contract(stakingContractAddress, stakingRewardsAbi, signer)

        const gasLimit = await stakingContract.estimateGas.exit()
        const stakeTx = await stakingContract.exit({ gasLimit: gasLimit })
        
        await stakeTx.wait()
          .then(() => {
            console.log("Unstaked successfully")
            setStatusMessage("Unstaked successfully")
            setTokensAreStaked(false)
            setIsTransacting(false)
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
  }

  async function withdrawPosition() {
    const lpTokenContractAddress = (addresses as any)?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2SaddleLpToken
    const saddleSwapContractAddress = (addresses as any)?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2SaddleSwap

    const balanceOfAbi = ["function balanceOf(address account) view returns (uint256)"]
    const lpTokenContract = new ethers.Contract(lpTokenContractAddress, balanceOfAbi, signer)

    let balance: string

    // get balance of LP token
    try {
      balance = await lpTokenContract.balanceOf(address?.address)
      balance = balance.toString()

      if (balance === "0") {
        console.log("No tokens to withdraw")
        setStatusMessage("No tokens to withdraw")
        setIsTransacting(false)
        setShowRebalancerModal(false)
        return
      } else {
        console.log("LP token balance:", balance)
      }
    } catch (error) {
      console.error(error)
      setStatusMessage(getHumanErrorMessage(error as Error))
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
            removeLiquidity(balance)
          })
          .catch(error => {
            console.error(error)
            setStatusMessage(getHumanErrorMessage(error))
            setIsTransacting(false)
          })
      } else {
        setStatusMessage("Could not approve tokens")
        removeLiquidity(balance)
      }
    } catch (error) {
      console.error(error)
      setStatusMessage(getHumanErrorMessage(error as Error))
      setIsTransacting(false)
    }

    async function removeLiquidity(amount: string, withdrawToOne: boolean = true) {
      const swapContract = new ethers.Contract(saddleSwapContractAddress, saddleSwapAbi, signer)

      // adjust for potential difference in decimals between LP tokens and collateral
      const decimals = (metadata as any)[reactAppNetwork].tokens[tokenSymbol].decimals
      let minAmountBN: BigNumber = BigNumber.from(balance.toString())
      if (decimals < 18) {
        minAmountBN = minAmountBN.div(10 ** (18 - decimals))
      }
      const minAmount: string = reactAppNetwork === "goerli" ? minAmountBN.mul(15).div(100).toString() : minAmountBN.mul(70).div(100).toString()

      const deadline = getDeadline(2)

      try {
        setStatusMessage("Withdrawing tokens")

        let gasLimit
        let removeLiquidityTx

        if (withdrawToOne) {
          gasLimit = await swapContract.estimateGas.removeLiquidityOneToken(amount, 0, minAmount, deadline)
          removeLiquidityTx = await swapContract.removeLiquidityOneToken(amount, 0, minAmount, deadline, { gasLimit: gasLimit })
        } else {
          gasLimit = await swapContract.estimateGas.removeLiquidity(amount, [0, 0], deadline)
          removeLiquidityTx = await swapContract.removeLiquidity(amount, [0, 0], deadline, { gasLimit: gasLimit })
        }
        
        await removeLiquidityTx.wait()
          .then(async (removeLiquidityTxReceipt: TransactionReceipt) => {
            if (typeof removeLiquidityTxReceipt !== "undefined") {
              let numberOfERC20TokensWithdrawn: string = "0"
              let numberOfHTokensWithdrawn: string = "0"

              if (withdrawToOne) {
                numberOfERC20TokensWithdrawn = removeLiquidityTxReceipt.logs[2].data.toString()
              } else {
                numberOfERC20TokensWithdrawn = removeLiquidityTxReceipt.logs[0].data.toString()
                numberOfHTokensWithdrawn = removeLiquidityTxReceipt.logs[1].data.toString()
              }

              if (numberOfERC20TokensWithdrawn > "0") {
                console.log("Successfully withdrew", numberOfERC20TokensWithdrawn, "canonical tokens")
              }

              if (numberOfHTokensWithdrawn > "0") {
                console.log("Successfully withdrew", numberOfHTokensWithdrawn, "hTokens")
              }

              setStatusMessage("Successfully withdrew tokens")
              setIsTransacting(false)
              
              setERC20PositionBalance(numberOfERC20TokensWithdrawn)
              setHTokenPositionBalance(numberOfHTokensWithdrawn)

              if (isNativeToken(chainSlug, tokenSymbol)) {
                console.log("Unwrap required")
                goToNextSection()
              } else {
                console.log("Unwrap not required")
                skipNextSection()
              }
            } else {
              setIsTransacting(false)
              setStatusMessage("Error: no tokens to withdraw")
              setERC20PositionBalance("0")
              setHTokenPositionBalance("0")
            }
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
          if (networksMatch) {
            setIsTransacting(true)
            if (tokensAreStaked) {
              unstake()
            } else {
              withdrawPosition()
            }
          } else {
            connectedNetworkId && checkConnectedNetworkId(networkSlugToId(chainSlug))
          }
        }}>
        { networksMatch ? tokensAreStaked ? "Unstake" : "Withdraw" : "Switch Networks" }
      </Button>
      <StatusMessage message={statusMessage} />
    </>
  )
}
