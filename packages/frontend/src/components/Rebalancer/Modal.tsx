import React, { useState, useEffect } from 'react'

import { ethers, BigNumber, Contract } from 'ethers'

import { useWeb3Context } from 'src/contexts/Web3Context'
import { useApp } from 'src/contexts/AppContext'
import { useSelectedNetwork } from 'src/hooks'
import { reactAppNetwork } from 'src/config'
import { usePoolStats } from 'src/pages/Pools/usePoolStats'
import { networkIdToSlug, networkSlugToId } from 'src/utils/networks'
import * as addresses from '@hop-protocol/core/addresses'
import * as networks from '@hop-protocol/core/networks'
import * as metadata from '@hop-protocol/core/metadata'

import { hopStakingRewardsContracts } from 'src/config/addresses'
import { stakingRewardsAbi } from '@hop-protocol/core/abi'
import saddleSwapAbi from '@hop-protocol/core/abi/generated/Swap.json'
import L2_AmmWrapperAbi from '@hop-protocol/core/abi/generated/L2_AmmWrapper.json'

// import Transaction from 'src/models/Transaction'

import { isDarkMode } from 'src/theme/theme'
import { makeStyles, Theme } from '@material-ui/core/styles'
import { Grid, Box, Typography } from '@material-ui/core'
import Button from 'src/components/buttons/Button'
import Modal from 'src/components/modal/Modal'
import { Footer } from 'src/components/Rebalancer/Footer'
import { NetworkSelectionSection } from 'src/components/Rebalancer/Sections/NetworkSelection'
import { UnstakeWithdrawSection } from 'src/components/Rebalancer/Sections/UnstakeWithdraw'
import { UnwrapSection } from 'src/components/Rebalancer/Sections/Unwrap'


export function RebalanceModal(props) {
  const showRebalanceModal = props.showRebalanceModal
  const setShowRebalanceModal = props.setShowRebalanceModal

  const { address, provider, onboard, connectedNetworkId, checkConnectedNetworkId } = useWeb3Context()
  const signer = provider?.getSigner()

  const gasLimit = 700000

  const { selectedBridge } = useApp()
  const tokenSymbol = selectedBridge?.getTokenSymbol() ?? ""

  const { selectedNetwork, selectSourceNetwork } = useSelectedNetwork({ l2Only: true })
  const chainSlug: string = selectedNetwork?.slug ?? ""

  const { poolStats } = usePoolStats()
  const [networksWithYields, setNetworksWithYields] = useState<[string, number, string][]>([])
  useEffect(() => { setNetworksWithYields(getNetworksWithYields()) }, [poolStats])

  const [destinationNetworkId, setDestinationNetworkId] = useState<number>(chainSlug === "optimism" ? networkSlugToId("arbitrum") : networkSlugToId("optimism"))
  // set default to highest APR network
  useEffect(() => {
    if (typeof networksWithYields !== "undefined") {
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
  const [bondTxHash, setBondTxHash] = useState<string>("")
  const [numberOfBridgedTokensReceived, setNumberOfBridgedTokensReceived] = useState<string>("")

  const [currentStep, setCurrentStep] = useState<number>(0)
  const rebalanceSections = [
    <NetworkSelectionSection goToNextSection={() => setCurrentStep(currentStep + 1)} checkConnectedNetworkId={checkConnectedNetworkId} chainSlug={chainSlug} connectedNetworkId={connectedNetworkId} destinationNetworkId={destinationNetworkId} setDestinationNetwork={setDestinationNetwork} networksWithYields={networksWithYields} />,
    <UnstakeWithdrawSection goToNextSection={() => setCurrentStep(currentStep + 1)} reactAppNetwork={reactAppNetwork} chainSlug={chainSlug} tokenSymbol={tokenSymbol} signer={signer} gasLimit={gasLimit} getTokensAreStaked={getTokensAreStaked} address={address} approveToken={approveToken} getDeadline={getDeadline} getHumanErrorMessage={getHumanErrorMessage} setERC20PositionBalance={setERC20PositionBalance} setShowRebalanceModal={setShowRebalanceModal} />,
    <UnwrapSection goToNextSection={() => setCurrentStep(currentStep + 1)} reactAppNetwork={reactAppNetwork} chainSlug={chainSlug} tokenSymbol={tokenSymbol} signer={signer} gasLimit={gasLimit} erc20PositionBalance={erc20PositionBalance} getHumanErrorMessage={getHumanErrorMessage} />,
    <p>End</p>
  ]


  /* REBALANCE FUNCTIONS */

  // bridge canonical tokens
  async function swapAndSend() {
    const l2AmmWrapperContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2AmmWrapper
    const l2AmmWrapperContract = new ethers.Contract(l2AmmWrapperContractAddress, L2_AmmWrapperAbi, signer)
    const canonicalTokenContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken

    const amount: string = erc20PositionBalance

    // approve LP token spending
    try {
      const approveTx = await approveToken(canonicalTokenContractAddress, l2AmmWrapperContractAddress, amount)
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
      return
    }

    let value = "0"
    if (tokenSymbol === "ETH" || (tokenSymbol === "DAI" && chainSlug === "gnosis")) {
      value = amount
    }
    
    // bridge tokens
    try {
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
        .then(() => console.log("Successfully sent tokens"))
        .catch(error => console.error(error))
    } catch (error) {
      console.error(error)
    }
  }

  async function checkBridgeStatusAndSetBondHash() {
    const bridgeStatusURL: string = `https://api.hop.exchange/v1/transfer-status?transactionHash=${bridgeTxHash}&network=${reactAppNetwork}`

    const response = await fetch(bridgeStatusURL)
    const data = await response.json()

    if (typeof data.error !== "undefined") {
      console.log("Error checking bridge status")
      return
    }

    const deadline = getDeadline(3)
    const pollingIntervalInSeconds = 10

    while (getDeadline(0) < deadline) {
      const response = await fetch(bridgeStatusURL)
      const data = await response.json()

      if (data.bonded) {
        const bondHash = data.bondTransactionHash

        setBondTxHash(bondHash)
        console.log("Successfully bridged tokens with hash:", bondHash)
        return
      } else {
        console.log("Could not yet confirm successful bridging, rechecking")
      }

      await new Promise(resolve => setTimeout(resolve, 1000 * pollingIntervalInSeconds))
    }
    console.log("Unable to confirm successful bridge transaction")
  }

  /* CHANGE NETWORK */

  async function setBridgedTokenData() {
    const bondTxReceipt = await provider?.getTransactionReceipt(bondTxHash)
    let tokensReceived: string

    if (typeof bondTxReceipt?.logs !== "undefined") {
      tokensReceived = parseInt(bondTxReceipt.logs[11].data, 16).toString()
      console.log("Bridged token balance:", tokensReceived)
      setNumberOfBridgedTokensReceived(tokensReceived)
    } else {
      console.log("Could not get bond data")
    }
  }

  // wrap if ETH or DAI on Gnosis
  async function wrapIfNativeToken() {
    if (tokenSymbol === "ETH") {
      try {
        const wrapTx = await wrapETH(numberOfBridgedTokensReceived)
        await wrapTx.wait()
          .then(() => console.log("Successfully wrapped ETH"))
          .catch(error => console.error(error))
      } catch (error) {
        console.error(error)
      }
    } else if (tokenSymbol === "DAI" && chainSlug === "gnosis") {
      const wDAIContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
      const wDAIAbi = ["function deposit() payable"]

      const wDAIContract = new ethers.Contract(wDAIContractAddress, wDAIAbi, signer)

      try {
        const wrapTx = await wDAIContract.deposit({ value: numberOfBridgedTokensReceived, gasLimit: gasLimit })
        await wrapTx.wait()
          .then(() => console.log("Successfully wrapped DAI"))
          .catch(error => console.error(error))
      } catch (error) {
        console.error(error)
      }
    } else {
      console.log("Token is ERC20, no wrap necessary")
    }
  }

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
          })
          .catch(error => console.error(error))
      }
    } catch (error) {
      console.error(error)
      return
    }

    // stake LP tokens
    const stakingContract = new ethers.Contract(stakingContractAddress, stakingRewardsAbi, signer)

    try {
      const stakeTx = await stakingContract.stake(balance, { gasLimit: gasLimit })
      await stakeTx.wait()
        .then(() => console.log("Staked successfully"))
        .catch(error => console.error(error))
    } catch (error) {
      console.error(error)
    }
  }


  /* DEBUG FUNCTIONS */

  async function debugTransaction() {
    console.log("Logging state values:")
    console.log("destinationNetworkId:", destinationNetworkId)
    console.log("erc20PositionBalance:", erc20PositionBalance)
    console.log("bridgeTxHash:", bridgeTxHash)
    console.log("bondTxHash:", bondTxHash)
    console.log("numberOfBridgedTokensReceived:", numberOfBridgedTokensReceived)
  }


  /* HELPER FUNCTIONS */

  async function changeNetwork(newChainId: number): Promise<number> {
    try {
      checkConnectedNetworkId(destinationNetworkId)

      const event = { target: { value: networkIdToSlug(newChainId) } }
      selectSourceNetwork(event as React.ChangeEvent<{ value: any }>)

      return newChainId
    } catch (error) {
      console.error(error)
      return 0
    }
  }

  // get an array of potential networks, sorted by descending yield
  function getNetworksWithYields(): [string, number, string][] {
    try {
      const allNetworks = poolStats
      const chainNames = Object.keys(allNetworks)

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

  async function approveToken(tokenAddress: string, spenderAddress: string, amount: string) {
    const allowanceAndApproveAbi = ["function allowance(address owner, address spender) public view returns (uint256)", "function approve(address spender, uint256 amount) external returns (bool)"]
    const tokenContract = new ethers.Contract(tokenAddress, allowanceAndApproveAbi, signer)

    // get the current allowance for the token and spender
    let currentAllowance = await tokenContract.allowance(address?.address, spenderAddress)
    currentAllowance = currentAllowance.toString()

    const currentAllowanceBN = BigNumber.from(currentAllowance)
    const amountBN = BigNumber.from(amount)

    // check if the current allowance is less than the required amount
    if (currentAllowanceBN.lt(amountBN)) {
      console.log("Allowance is less than amount, approving higher limit")
      // approve LP token spending
      return tokenContract.approve(spenderAddress, amount, { gasLimit: gasLimit })
    } else {
      console.log("Allowance is equal to or greater than amount, no approval necessary")
    }
  }

  async function wrapETH(amountToWrap: string) {
    const wETHContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
    const wethAbi = ["function deposit() payable"]

    const wethContract = new ethers.Contract(wETHContractAddress, wethAbi, signer)

    return await wethContract.deposit({ value: amountToWrap, gasLimit: gasLimit })
  }

  // use yields and user input to determine the destination chain
  function setDestinationNetwork(chainSlug: string) {
    const destinationId = networkSlugToId(chainSlug)

    setDestinationNetworkId(destinationId)

    console.log("Destination network ID set to:", destinationId)
  }

  function getDeadline(confirmTimeMinutes: number) {
    const currentTime = Math.floor(Date.now() / 1000)
    const deadline = currentTime + (confirmTimeMinutes * 60)
    return deadline
  }

  function getHumanErrorMessage(error: Error) {
    return "Error: " + error?.message.split(" (action=")[0]
  }


  if (showRebalanceModal) {
    return (
      <Modal onClose={() => setShowRebalanceModal(false)}>
        { rebalanceSections[currentStep] }
        <Footer currentStep={currentStep} totalSteps={rebalanceSections.length} />
      </Modal>
    )
  } else {
    return <></>
  }
}
