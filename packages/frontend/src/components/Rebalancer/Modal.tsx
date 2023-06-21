import React, { useState, useEffect } from 'react'
import { ethers, BigNumber, Contract, Transaction } from 'ethers'
import * as hopMetadata from '@hop-protocol/core/metadata'
import { TransactionResponse } from '@ethersproject/abstract-provider'
import { useWeb3Context } from 'src/contexts/Web3Context'
import { useApp } from 'src/contexts/AppContext'
import { useSelectedNetwork } from 'src/hooks'
import { reactAppNetwork } from 'src/config'
import { usePoolStats } from 'src/pages/Pools/usePoolStats'
import { networkIdToSlug, networkSlugToId } from 'src/utils/networks'

import Typography from '@material-ui/core/Typography'
import Modal from 'src/components/modal/Modal'
import { Footer } from 'src/components/Rebalancer/Sections/Footer'
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
  sortedChainsWithAPRData: [chainSlug: string, totalApr: number, poolApr: number][]
  stakingRewards: { [key: string]: string }[]
}

export function RebalancerModal(props: RebalancerModalProps) {
  const { showRebalancerModal, setShowRebalancerModal, sortedChainsWithAPRData, stakingRewards } = props

  const { address, provider, onboard, connectedNetworkId, checkConnectedNetworkId } = useWeb3Context()
  const signer = provider?.getSigner()

  const { selectedBridge } = useApp()
  const tokenSymbol = selectedBridge?.getTokenSymbol() ?? ""

  const { selectedNetwork, selectSourceNetwork } = useSelectedNetwork({ l2Only: true })
  const chainSlug: string = selectedNetwork?.slug ?? ""

  const defaultRewardTokenSymbol = stakingRewards?.[0]?.rewardTokenSymbol !== "undefined" ? stakingRewards[0].rewardTokenSymbol : "HOP"
  const [selectedRewardTokenSymbol, setSelectedRewardTokenSymbol] = useState<string>(defaultRewardTokenSymbol)
  const [destinationNetworkId, setDestinationNetworkId] = useState<number>(chainSlug === "optimism" ? networkSlugToId("arbitrum") : networkSlugToId("optimism"))
  
  const [erc20PositionBalance, setERC20PositionBalance] = useState<string>("")
  const [hTokenPositionBalance, setHTokenPositionBalance] = useState<string>("")
  const [bridgeTxHash, setBridgeTxHash] = useState<string>("")
  const [numberOfBridgedTokensReceived, setNumberOfBridgedTokensReceived] = useState<string>("")
  
  const [bridgedFromNetworkId, setBridgedFromNetworkId] = useState<number>(0)

  useEffect(() => {
    connectedNetworkId && setBridgedFromNetworkId(connectedNetworkId)
  }, [])

  const [networksMatch, setNetworksMatch] = useState<boolean>(false)

  // listen for the right chain connection
  useEffect(() => {
    if (connectedNetworkId && +connectedNetworkId === +networkSlugToId(chainSlug)) {
      console.log("Networks", +connectedNetworkId, "and", +networkSlugToId(chainSlug), "match")
      setNetworksMatch(true)
      setBridgedFromNetworkId(connectedNetworkId)
    } else {
      setNetworksMatch(false)
    }
  }, [connectedNetworkId, chainSlug])

  const [currentStep, setCurrentStep] = useState<number>(0)


  /* HELPER FUNCTIONS */

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

  function isNativeToken(chainSlug: string, tokenSymbol: string): boolean {
    let adjustedTokenSymbol = tokenSymbol

    if (tokenSymbol === "DAI" && chainSlug === "gnosis") {
      adjustedTokenSymbol = "XDAI"
    }

    return adjustedTokenSymbol === (hopMetadata as any)?.[reactAppNetwork]?.chains?.[chainSlug]?.nativeTokenSymbol
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
    <NetworkSelectionSection goToNextSection={() => setCurrentStep(currentStep + 1)} reactAppNetwork={reactAppNetwork} networksMatch={networksMatch} checkConnectedNetworkId={checkConnectedNetworkId} connectedNetworkId={connectedNetworkId} networkSlugToId={networkSlugToId} chainSlug={chainSlug} tokenSymbol={tokenSymbol} setBridgedFromNetworkId={setBridgedFromNetworkId} destinationNetworkId={destinationNetworkId} setDestinationNetwork={setDestinationNetwork} sortedChainsWithAPRData={sortedChainsWithAPRData} selectedBridge={selectedBridge} selectedRewardTokenSymbol={selectedRewardTokenSymbol} setSelectedRewardTokenSymbol={setSelectedRewardTokenSymbol} defaultRewardTokenSymbol={defaultRewardTokenSymbol} />,
    <UnstakeWithdrawSection goToNextSection={() => setCurrentStep(currentStep + 1)} skipNextSection={() => setCurrentStep(currentStep + 2)} reactAppNetwork={reactAppNetwork} networksMatch={networksMatch} checkConnectedNetworkId={checkConnectedNetworkId} connectedNetworkId={connectedNetworkId} networkSlugToId={networkSlugToId} chainSlug={chainSlug} tokenSymbol={tokenSymbol} signer={signer} address={address} getHumanErrorMessage={getHumanErrorMessage} setERC20PositionBalance={setERC20PositionBalance} setHTokenPositionBalance={setHTokenPositionBalance} setShowRebalancerModal={setShowRebalancerModal} getDeadline={getDeadline} approveToken={approveToken} isNativeToken={isNativeToken} />,
    <UnwrapSection goToNextSection={() => setCurrentStep(currentStep + 1)} reactAppNetwork={reactAppNetwork} networksMatch={networksMatch} checkConnectedNetworkId={checkConnectedNetworkId} connectedNetworkId={connectedNetworkId} networkSlugToId={networkSlugToId} chainSlug={chainSlug} tokenSymbol={tokenSymbol} signer={signer} erc20PositionBalance={erc20PositionBalance} getHumanErrorMessage={getHumanErrorMessage} isNativeToken={isNativeToken} />,
    <BridgeSection goToNextSection={() => setCurrentStep(currentStep + 1)} reactAppNetwork={reactAppNetwork} networksMatch={networksMatch} checkConnectedNetworkId={checkConnectedNetworkId} connectedNetworkId={connectedNetworkId} networkSlugToId={networkSlugToId} chainSlug={chainSlug} tokenSymbol={tokenSymbol} destinationNetworkId={destinationNetworkId} signer={signer} address={address} getHumanErrorMessage={getHumanErrorMessage} erc20PositionBalance={erc20PositionBalance} setBridgeTxHash={setBridgeTxHash} getDeadline={getDeadline} approveToken={approveToken} selectedBridge={selectedBridge} />,
    <BridgingStatusSection goToNextSection={() => setCurrentStep(currentStep + 1)} skipNextSection={() => setCurrentStep(currentStep + 2)} reactAppNetwork={reactAppNetwork} connectedNetworkId={connectedNetworkId} networkSlugToId={networkSlugToId} chainSlug={chainSlug} tokenSymbol={tokenSymbol} provider={provider} bridgedFromNetworkId={bridgedFromNetworkId} destinationNetworkId={destinationNetworkId} changeNetwork={changeNetwork} bridgeTxHash={bridgeTxHash} setNumberOfBridgedTokensReceived={setNumberOfBridgedTokensReceived} getHumanErrorMessage={getHumanErrorMessage} getDeadline={getDeadline} isNativeToken={isNativeToken} />,
    <WrapSection goToNextSection={() => setCurrentStep(currentStep + 1)} reactAppNetwork={reactAppNetwork} networksMatch={networksMatch} checkConnectedNetworkId={checkConnectedNetworkId} connectedNetworkId={connectedNetworkId} networkSlugToId={networkSlugToId} chainSlug={chainSlug} tokenSymbol={tokenSymbol} numberOfBridgedTokensReceived={numberOfBridgedTokensReceived} signer={signer} getHumanErrorMessage={getHumanErrorMessage} isNativeToken={isNativeToken} />,
    <DepositSection goToNextSection={() => setCurrentStep(currentStep + 1)} reactAppNetwork={reactAppNetwork} networksMatch={networksMatch} checkConnectedNetworkId={checkConnectedNetworkId} connectedNetworkId={connectedNetworkId} networkSlugToId={networkSlugToId} chainSlug={chainSlug} tokenSymbol={tokenSymbol} numberOfBridgedTokensReceived={numberOfBridgedTokensReceived} signer={signer} approveToken={approveToken} getDeadline={getDeadline} getHumanErrorMessage={getHumanErrorMessage} />,
    <StakeSection goToNextSection={() => setCurrentStep(0)} close={() => setShowRebalancerModal(false)} reactAppNetwork={reactAppNetwork} networksMatch={networksMatch} checkConnectedNetworkId={checkConnectedNetworkId} connectedNetworkId={connectedNetworkId} networkSlugToId={networkSlugToId} chainSlug={chainSlug} tokenSymbol={tokenSymbol} signer={signer} address={address} getHumanErrorMessage={getHumanErrorMessage} approveToken={approveToken} selectedRewardTokenSymbol={selectedRewardTokenSymbol} />
  ]

  return showRebalancerModal
    ? <Modal onClose={() => {
        setCurrentStep(0)
        setShowRebalancerModal(false)
      }}>
        { rebalanceSections[currentStep] }
        <Footer currentStep={currentStep} totalSteps={rebalanceSections.length} />
      </Modal>
    : <></>
}
