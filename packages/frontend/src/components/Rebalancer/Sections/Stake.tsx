import React, { useState } from 'react'
import { ethers, Signer } from 'ethers'
import { TransactionResponse } from '@ethersproject/abstract-provider'
import * as addresses from '@hop-protocol/core/addresses'
import Address from 'src/models/Address'
import { hopStakingRewardsContracts } from 'src/config/addresses'
import { stakingRewardsAbi } from '@hop-protocol/core/abi'
import Button from 'src/components/buttons/Button'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'
import { StatusMessage } from 'src/components/Rebalancer/Sections/Subsections/StatusMessage'

interface StakeSectionProps {
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
  getHumanErrorMessage: (error: Error) => string
  close: () => void
  goToNextSection: () => void
}

export function StakeSection(props: StakeSectionProps) {
  const reactAppNetwork = props.reactAppNetwork
  const networksMatch = props.networksMatch
  const checkConnectedNetworkId = props.checkConnectedNetworkId
  const connectedNetworkId = props.connectedNetworkId
  const networkSlugToId = props.networkSlugToId
  const chainSlug = props.chainSlug
  const tokenSymbol = props.tokenSymbol
  const signer = props.signer
  const address = props.address
  const getHumanErrorMessage = props.getHumanErrorMessage
  const approveToken = props.approveToken
  const goToNextSection = props.goToNextSection
  const close = props.close

  const [isTransacting, setIsTransacting] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  async function stake() {
    const lpTokenContractAddress = (addresses as any)?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2SaddleLpToken
    const stakingContractAddress = (hopStakingRewardsContracts as any)?.[reactAppNetwork]?.[chainSlug]?.[tokenSymbol]

    const balanceOfAbi = ["function balanceOf(address owner) view returns (uint256)"]
    const lpTokenContract = new ethers.Contract(lpTokenContractAddress, balanceOfAbi, signer)

    let balance: string = "0"

    // get balance of LP token
    try {
      console.dir("Signer:", signer)
      balance = (await lpTokenContract.balanceOf(address?.address)).toString()
      console.log("LP balance:", balance)
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
      setStatusMessage(getHumanErrorMessage(error as Error))
      setIsTransacting(false)
      return
    }

    // stake LP tokens
    const stakingContract = new ethers.Contract(stakingContractAddress, stakingRewardsAbi, signer)

    try {
      const gasLimit = await stakingContract.estimateGas.stake(balance)
      const stakeTx = await stakingContract.stake(balance, { gasLimit: gasLimit })
      
      await stakeTx.wait()
        .then(() => {
          console.log("Staked successfully")
          setStatusMessage("Approved successfully")
          setIsTransacting(false)
          close()
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
      <SectionHeader title="Stake" subtitle="Stake your LP tokens for extra yield" />
      <Button
        highlighted={!isTransacting}
        loading={isTransacting}
        large
        fullWidth
        onClick={() => {
          if (networksMatch) {
            setIsTransacting(true)
            stake()
          } else {
            connectedNetworkId && checkConnectedNetworkId(networkSlugToId(chainSlug))
          }
        }}>
        { networksMatch ? "Stake" : "Switch Networks" }
      </Button>
      <StatusMessage message={statusMessage} />
    </>
  )
}
