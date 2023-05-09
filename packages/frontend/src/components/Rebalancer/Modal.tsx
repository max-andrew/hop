import React, { useState, useEffect } from 'react'
import { ethers, BigNumber, Contract, Transaction } from 'ethers'
import { TransactionResponse } from '@ethersproject/abstract-provider'
import { useWeb3Context } from 'src/contexts/Web3Context'
import { useApp } from 'src/contexts/AppContext'
import { useSelectedNetwork } from 'src/hooks'
import { reactAppNetwork } from 'src/config'
import { usePoolStats } from 'src/pages/Pools/usePoolStats'
import { networkIdToSlug, networkSlugToId } from 'src/utils/networks'

import Typography from '@material-ui/core/Typography'
import Modal from 'src/components/modal/Modal'
import { Footer } from 'src/components/Rebalancer/Footer'
import { NetworkSelectionSection } from 'src/components/Rebalancer/Sections/NetworkSelection'
import { UnstakeWithdrawSection } from 'src/components/Rebalancer/Sections/UnstakeWithdraw'
import { UnwrapSection } from 'src/components/Rebalancer/Sections/Unwrap'
import { BridgeSection } from 'src/components/Rebalancer/Sections/Bridge'
import { BridgingStatusSection } from 'src/components/Rebalancer/Sections/BridgingStatus'
import { WrapSection } from 'src/components/Rebalancer/Sections/Wrap'
import { DepositSection } from 'src/components/Rebalancer/Sections/Deposit'
import { StakeSection } from 'src/components/Rebalancer/Sections/Stake'

interface RebalancerModalProps {
  showRebalancerModal: boolean
  setShowRebalancerModal: (showRebalancerModal: boolean) => void
  poolStats: any
}

export function RebalancerModal(props: RebalancerModalProps) {
  const showRebalancerModal = props.showRebalancerModal
  const setShowRebalancerModal = props.setShowRebalancerModal
  const poolStats = props.poolStats

  const { address, provider, onboard, connectedNetworkId, checkConnectedNetworkId } = useWeb3Context()
  const signer = provider?.getSigner()

  const { selectedBridge } = useApp()
  const tokenSymbol = selectedBridge?.getTokenSymbol() ?? ""

  const { selectedNetwork, selectSourceNetwork } = useSelectedNetwork({ l2Only: true })
  const chainSlug: string = selectedNetwork?.slug ?? ""

  const [networksWithYields, setNetworksWithYields] = useState<[string, number, string][]>([])
  useEffect(() => { setNetworksWithYields(getNetworksWithYields()) }, [poolStats])

  const [destinationNetworkId, setDestinationNetworkId] = useState<number>(chainSlug === "optimism" ? networkSlugToId("arbitrum") : networkSlugToId("optimism"))
  // set default to highest APR network
  useEffect(() => {
    if (typeof networksWithYields !== "undefined" && currentStep === 0) {
      // exclude the source network
      const potentialDestinationNetworkIds: number[] = networksWithYields.reduce((acc: number[], network) => {
        if (network[0] !== chainSlug) {
          acc.push(networkSlugToId(network[0]))
        }
        return acc
      }, [])

      setDestinationNetworkId(potentialDestinationNetworkIds[0])
    }
  }, [networksWithYields])

  const [erc20PositionBalance, setERC20PositionBalance] = useState<string>("")
  const [bridgeTxHash, setBridgeTxHash] = useState<string>("")
  const [numberOfBridgedTokensReceived, setNumberOfBridgedTokensReceived] = useState<string>("")
  
  const [bridgedFromNetworkId, setBridgedFromNetworkId] = useState<number>(0)

  useEffect(() => {
    connectedNetworkId && setBridgedFromNetworkId(connectedNetworkId)
  }, [])

  const [currentStep, setCurrentStep] = useState<number>(0)


  /* HELPER FUNCTIONS */

  // get an array of potential networks, sorted by descending yield
  function getNetworksWithYields(): [string, number, string][] {
    try {
      const allNetworks = poolStats
      const chainNames = allNetworks ? Object.keys(allNetworks) : []

      const chainsWithTotalAPR = chainNames.reduce((acc: [string, number, string][], chain: string) => {
        // if APR data is undefined, break
        if (typeof allNetworks?.[chain]?.[tokenSymbol]?.totalApr === "undefined") {
          return acc
        }

        // include chain only if there is APR
        if (allNetworks[chain][tokenSymbol].totalApr > 0) {
          acc.push([chain, allNetworks[chain][tokenSymbol].totalApr, allNetworks[chain][tokenSymbol].totalAprFormatted])
        }

        return acc
      }, [])

      // sort chains by APR
      const chainsSortedByAPR = sortTuplesDescending(chainsWithTotalAPR)

      return chainsSortedByAPR
    } catch (error) {
      console.error(error)

      return []
    }

    function sortTuplesDescending(tupleArray: [string, number, string][]): [string, number, string][] {
      return tupleArray.sort((a, b) => b[1] - a[1])
    }
  }

  async function changeNetwork(newChainId: number): Promise<boolean> {
    try {
      const event = { target: { value: networkIdToSlug(newChainId) } }
      selectSourceNetwork(event as React.ChangeEvent<{ value: any }>)
      return await checkConnectedNetworkId(newChainId)
    } catch (error) {
      console.error(error)
      return false
    }
  }

  async function getTokensAreStaked(stakingContract: Contract): Promise<boolean | undefined> {
    // check if any tokens are staked
    try {
      let stakedBalance: string = await stakingContract.balanceOf(address?.address)
      stakedBalance = stakedBalance.toString()

      if (stakedBalance === "0") {
        console.log("No tokens staked, no unstake necessary")
        return false
      } else {
        console.log("Staked token balance:", stakedBalance)
        return true
      }
    } catch (error) {
      console.error(error)
      return undefined
    }
  }

  async function approveToken(tokenAddress: string, spenderAddress: string, amount: string): Promise<TransactionResponse | undefined> {
    const allowanceAndApproveAbi = ["function allowance(address owner, address spender) public view returns (uint256)", "function approve(address spender, uint256 amount) external returns (bool)"]
    const tokenContract = new ethers.Contract(tokenAddress, allowanceAndApproveAbi, signer)

    // get the current allowance for the token and spender
    let currentAllowance = await tokenContract.allowance(address?.address, spenderAddress)
    currentAllowance = currentAllowance.toString()

    const currentAllowanceBN = BigNumber.from(currentAllowance)
    const amountBN = BigNumber.from(amount)

    console.log(currentAllowanceBN.toString(), amountBN.toString())

    // check if the current allowance is less than the required amount
    if (currentAllowanceBN.lt(amountBN)) {
      console.log("Allowance is less than amount, approving higher limit")
      // approve LP token spending
      const gasLimit = await tokenContract.estimateGas.approve(spenderAddress, amount)
      return tokenContract.approve(spenderAddress, amount, { gasLimit: gasLimit })
    } else {
      console.log("Allowance is equal to or greater than amount, no approval necessary")
    }
  }

  // use yields and user input to determine the destination chain
  function setDestinationNetwork(chainSlug: string) {
    const destinationId = networkSlugToId(chainSlug)

    setDestinationNetworkId(destinationId)

    console.log("Destination network ID set to:", destinationId)
  }

  function getDeadline(confirmTimeMinutes: number): number {
    const currentTime = Math.floor(Date.now() / 1000)
    const deadline = currentTime + (confirmTimeMinutes * 60)
    return deadline
  }

  function getHumanErrorMessage(error: Error): string {
    return "Error: " + error?.message.split(" (action=")[0].split(" [ See: ")[0]
  }


  const rebalanceSections = !signer
  ? [<Typography variant="h4">Error finding wallet</Typography>]
  : [
    <NetworkSelectionSection goToNextSection={() => setCurrentStep(currentStep + 1)} checkConnectedNetworkId={checkConnectedNetworkId} chainSlug={chainSlug} connectedNetworkId={connectedNetworkId} setBridgedFromNetworkId={setBridgedFromNetworkId} destinationNetworkId={destinationNetworkId} setDestinationNetwork={setDestinationNetwork} networksWithYields={networksWithYields} />,
    <UnstakeWithdrawSection goToNextSection={() => setCurrentStep(currentStep + 1)} reactAppNetwork={reactAppNetwork} chainSlug={chainSlug} tokenSymbol={tokenSymbol} signer={signer} getTokensAreStaked={getTokensAreStaked} address={address} getHumanErrorMessage={getHumanErrorMessage} setERC20PositionBalance={setERC20PositionBalance} setShowRebalancerModal={setShowRebalancerModal} getDeadline={getDeadline} approveToken={approveToken} />,
    <UnwrapSection goToNextSection={() => setCurrentStep(currentStep + 1)} reactAppNetwork={reactAppNetwork} chainSlug={chainSlug} tokenSymbol={tokenSymbol} signer={signer} erc20PositionBalance={erc20PositionBalance} getHumanErrorMessage={getHumanErrorMessage} />,
    <BridgeSection goToNextSection={() => setCurrentStep(currentStep + 1)} reactAppNetwork={reactAppNetwork} chainSlug={chainSlug} tokenSymbol={tokenSymbol} destinationNetworkId={destinationNetworkId} signer={signer} getTokensAreStaked={getTokensAreStaked} address={address} getHumanErrorMessage={getHumanErrorMessage} erc20PositionBalance={erc20PositionBalance} setBridgeTxHash={setBridgeTxHash} getDeadline={getDeadline} approveToken={approveToken}  />,
    <BridgingStatusSection goToNextSection={() => setCurrentStep(currentStep + 1)} reactAppNetwork={reactAppNetwork} chainSlug={chainSlug} provider={provider} connectedNetworkId={connectedNetworkId} bridgedFromNetworkId={bridgedFromNetworkId} destinationNetworkId={destinationNetworkId} changeNetwork={changeNetwork} bridgeTxHash={bridgeTxHash} setNumberOfBridgedTokensReceived={setNumberOfBridgedTokensReceived} getHumanErrorMessage={getHumanErrorMessage} getDeadline={getDeadline} />,
    <WrapSection goToNextSection={() => setCurrentStep(currentStep + 1)} reactAppNetwork={reactAppNetwork} chainSlug={chainSlug} tokenSymbol={tokenSymbol} numberOfBridgedTokensReceived={numberOfBridgedTokensReceived} signer={signer} getHumanErrorMessage={getHumanErrorMessage} />,
    <DepositSection goToNextSection={() => setCurrentStep(currentStep + 1)} reactAppNetwork={reactAppNetwork} chainSlug={chainSlug} tokenSymbol={tokenSymbol} numberOfBridgedTokensReceived={numberOfBridgedTokensReceived} signer={signer} approveToken={approveToken} getDeadline={getDeadline} getHumanErrorMessage={getHumanErrorMessage} />,
    <StakeSection close={() => setShowRebalancerModal(false)} reactAppNetwork={reactAppNetwork} chainSlug={chainSlug} tokenSymbol={tokenSymbol} signer={signer} address={address} getHumanErrorMessage={getHumanErrorMessage} approveToken={approveToken} />
  ]

  return showRebalancerModal
    ? <Modal onClose={() => setShowRebalancerModal(false)}>
        { rebalanceSections[currentStep] }
        <Footer currentStep={currentStep} totalSteps={rebalanceSections.length} />
      </Modal>
    : <></>
}
