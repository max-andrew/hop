import React, { useState } from 'react'
import { ethers } from 'ethers'
import * as addresses from '@hop-protocol/core/addresses'
import { hopStakingRewardsContracts } from 'src/config/addresses'
import { stakingRewardsAbi } from '@hop-protocol/core/abi'
import Button from 'src/components/buttons/Button'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'
import { StatusMessage } from 'src/components/Rebalancer/Sections/Subsections/StatusMessage'

export function StakeSection(props) {
  const reactAppNetwork = props.reactAppNetwork
  const chainSlug = props.chainSlug
  const tokenSymbol = props.tokenSymbol
  const signer = props.signer
  const gasLimit = props.gasLimit
  const address = props.address
  const getHumanErrorMessage = props.getHumanErrorMessage
  const approveToken = props.approveToken
  const close = props.close

  const [isTransacting, setIsTransacting] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  async function stake() {
    const lpTokenContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2SaddleLpToken
    const stakingContractAddress = hopStakingRewardsContracts?.[reactAppNetwork]?.[chainSlug]?.[tokenSymbol]

    const balanceOfAbi = ["function balanceOf(address account) view returns (uint256)"]
    const lpTokenContract = new ethers.Contract(lpTokenContractAddress, balanceOfAbi, signer)

    let balance: string = "0"

    // get balance of LP token
    try {
      balance = await lpTokenContract.balanceOf(address?.address)
      balance = balance.toString()
      console.log("LP token balance:", balance)
    } catch (error) {
      console.error(error)
      return
    }

    // approve LP token spending
    try {
      const approveTx = await approveToken(lpTokenContractAddress, stakingContractAddress, balance)
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
      setStatusMessage(getHumanErrorMessage(error))
      setIsTransacting(false)
      return
    }

    // stake LP tokens
    const stakingContract = new ethers.Contract(stakingContractAddress, stakingRewardsAbi, signer)

    try {
      const stakeTx = await stakingContract.stake(balance, { gasLimit: gasLimit })
      await stakeTx.wait()
        .then(() => {
          console.log("Staked successfully")
          setStatusMessage("Approved successfully")
          setIsTransacting(false)
          close()
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

  return (
    <>
      <SectionHeader title="Stake" subtitle="Stake your LP tokens for extra yield" />
      <Button
        highlighted={!isTransacting}
        loading={isTransacting}
        large
        fullWidth
        onClick={() => {
          setIsTransacting(true)
          stake()
        }}>
        Stake
      </Button>
      <StatusMessage message={statusMessage} />
    </>
  )
}
