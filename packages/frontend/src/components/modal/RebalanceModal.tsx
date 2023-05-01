import React, { useState, useEffect } from 'react'

import { BigNumber, ethers } from 'ethers'
import { useWeb3Context } from 'src/contexts/Web3Context'
import { stakingRewardsAbi } from '@hop-protocol/core/abi'
import saddleSwapAbi from '@hop-protocol/core/abi/generated/Swap.json'
import L2_AmmWrapperAbi from '@hop-protocol/core/abi/generated/L2_AmmWrapper.json'
import { hopStakingRewardsContracts } from 'src/config/addresses'
import * as addresses from '@hop-protocol/core/addresses'
import * as networks from '@hop-protocol/core/networks'
import * as metadata from '@hop-protocol/core/metadata'
import { ChainSlug, utils as sdkUtils } from '@hop-protocol/sdk'
import { findNetworkBySlug } from 'src/utils'
import { useSelectedNetwork } from 'src/hooks'
import { reactAppNetwork } from 'src/config'
import { useApp } from 'src/contexts/AppContext'
import { networkIdToSlug, networkSlugToId } from 'src/utils/networks'
import Network from 'src/models/Network'
import Transaction from 'src/models/Transaction'
import { usePoolStats } from 'src/pages/Pools/usePoolStats'

import { isDarkMode } from 'src/theme/theme'
import { makeStyles, Theme } from '@material-ui/core/styles'
import { Grid, Card, Divider, Box, Typography } from '@material-ui/core'
import Modal from 'src/components/modal/Modal'
import { Text } from 'src/components/ui/Text'
import { RaisedNetworkSelector } from 'src/components/NetworkSelector/RaisedNetworkSelector'

const useStyles = makeStyles((theme: Theme) => ({

}))

function RebalanceModalFooter(props) {
  const currentStep = 0
  const totalSteps = 5

  return (
    <>
      <Divider />
      <br />
      <Box textAlign="center">
        <Typography variant="body2" component="span" color="secondary">{Math.round((currentStep / totalSteps) * 100)}%</Typography>
      </Box>
    </>
  )
}

type NetworkAPRTupleType = [string, number, string]

interface NetworkSelectionSectionProps {
  networksWithYields: NetworkAPRTupleType[],
  chainSlug: string,
  destinationNetworkId: number,
  setDestinationNetwork: (chainSlug: string) => void
}

function NetworkSelectionSection(props: NetworkSelectionSectionProps) {
  const networks = props.networksWithYields
  const chainSlug = props.chainSlug
  const destinationNetworkId = props.destinationNetworkId

  // exclude the source network
  const potentialDestinationNetworkObjects = networks.reduce((acc: Network[], network) => {
    const foundNetwork = findNetworkBySlug(network[0])
    if (foundNetwork && network[0] !== chainSlug) {
      acc.push(foundNetwork)
    }
    return acc
  }, [])

  return (
    <>
      <Typography variant="h4" color="textPrimary">Select destination</Typography>
      <Typography variant="subtitle2" color="textSecondary">Choose the network to transfer your position to</Typography>
      <br />
      <br />
      <Grid container alignItems="center">
        <Grid item xs>
          <Box display="flex" alignItems="center" justifyContent="center">
            <RaisedNetworkSelector 
              selectedNetwork={findNetworkBySlug(networkIdToSlug(destinationNetworkId))} 
              onSelect={e => props.setDestinationNetwork(e.target.value)} 
              availableNetworks={potentialDestinationNetworkObjects} 
              />
          </Box>
        </Grid>
        <Divider orientation="vertical" flexItem />
        <Grid item xs>
          <Box display="flex" flexDirection="column" alignItems="center">
            {networks.map((tuple: NetworkAPRTupleType, index: number) => (
                <Box key={index} my={1}>
                  <Typography variant="body1" color="textSecondary" align="right">{tuple[0]}</Typography>
                  <Typography variant="h3">{tuple[2]}</Typography>
                </Box>
            ))}
          </Box>
        </Grid>
      </Grid>
    </>
  )
}

function GodModeSection(props) {
  const chainSlug = props.chainSlug
  const setDestinationNetwork = props.setDestinationNetwork
  const unstake = props.unstake
  const withdrawPosition = props.withdrawPosition
  const unwrapIfNativeToken = props.unwrapIfNativeToken
  const swapAndSend = props.swapAndSend
  const checkBridgeStatusAndSetBondHash = props.checkBridgeStatusAndSetBondHash
  const changeNetwork = props.changeNetwork
  const setBridgedTokenData = props.setBridgedTokenData
  const wrapIfNativeToken = props.wrapIfNativeToken
  const addLiquidity = props.addLiquidity
  const stake = props.stake
  const getNetworksWithYields = props.getNetworksWithYields
  const approveToken = props.approveToken
  const convertHTokens = props.convertHTokens
  const wrapETH = props.wrapETH
  const debugTransaction = props.debugTransaction

  return (
    <>
      <br />
      <button onClick={() => setDestinationNetwork(chainSlug)}>Set destination chain</button>
      <button onClick={() => unstake()}>Unstake</button>
      <button onClick={() => withdrawPosition()}>Withdraw</button>
      <button onClick={() => unwrapIfNativeToken()}>Unwrap if native token</button>
      <button onClick={() => swapAndSend()}>Bridge</button>
      <button onClick={() => checkBridgeStatusAndSetBondHash()}>Set bridge data</button>
      <br />
      <br />
      <button onClick={() => changeNetwork()}>Change network</button>
      <button onClick={() => setBridgedTokenData()}>Set bridged token data</button>
      <button onClick={() => wrapIfNativeToken()}>Wrap if native token</button>
      <button onClick={() => addLiquidity()}>Deposit</button>
      <button onClick={() => stake()}>Stake</button>
      <p> - </p>
      <button onClick={() => getNetworksWithYields()}>Get networks</button>
      <button onClick={() => approveToken("0xDc38c5aF436B9652225f92c370A011C673FA7Ba5", "0xa50395bdEaca7062255109fedE012eFE63d6D402", "39014000550885654")}>Approve</button>
      <button onClick={() => convertHTokens()}>Convert hTokens</button>
      <button onClick={() => wrapETH("1000000000000000")}>Wrap ETH</button>
      <button onClick={() => debugTransaction()}>Debug</button>
    </>
  )
}

export function RebalanceModal(props) {
  const styles = useStyles()

  const { address, provider, onboard, connectedNetworkId, checkConnectedNetworkId } = useWeb3Context()
  const signer = provider?.getSigner()

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

  const gasLimit = 700000


  /* REBALANCE FUNCTIONS */

  async function unstake() {
    const stakingContractAddress = hopStakingRewardsContracts?.[reactAppNetwork]?.[chainSlug]?.[tokenSymbol]
    const stakingContract = new ethers.Contract(stakingContractAddress, stakingRewardsAbi, signer)

    // check if any tokens are staked
    try {
      let stakedBalance: string = await stakingContract.balanceOf(address?.address)
      stakedBalance = stakedBalance.toString()

      if (stakedBalance === "0") {
        console.log("No tokens staked, no unstake necessary")
        return
      } else {
        console.log("Staked token balance:", stakedBalance)
      }
    } catch (error) {
      console.error(error)
    }

    // unstake LP tokens
    try {
      const stakeTx = await stakingContract.exit({ gasLimit: gasLimit })
      await stakeTx.wait()
        .then(() => console.log("Unstaked successfully"))
        .catch(error => console.error(error))
    } catch (error) {
      console.error(error)
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
        return
      } else {
        console.log("LP token balance:", balance)
      }
    } catch (error) {
      console.error(error)
      return
    }

    // approve LP token spending
    try {
      const approveTx = await approveToken(lpTokenContractAddress, saddleSwapContractAddress, balance)
      if (typeof approveTx !== "undefined") {
        await approveTx.wait()
          .then(() => {
            console.log("Approved successfully")
            removeLiquidityOneToken(balance)
          })
          .catch(error => console.error(error))
      } else {
        removeLiquidityOneToken(balance)
      }
    } catch (error) {
      console.error(error)
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
        const removeLiquidityTx = await swapContract.removeLiquidityOneToken(amount, 0, minAmount, deadline, { gasLimit: gasLimit })
        await removeLiquidityTx.wait()
          .then(async (removeLiquidityTxReceipt) => {
            if (typeof removeLiquidityTxReceipt !== "undefined") {
              let numberOfTokensWithdrawn: string = removeLiquidityTxReceipt.logs[2].data.toString()
              numberOfTokensWithdrawn = parseInt(numberOfTokensWithdrawn, 16).toString()

              console.log("Successfully withdrew", numberOfTokensWithdrawn, "tokens")
              setERC20PositionBalance(numberOfTokensWithdrawn)
            } else {
              setERC20PositionBalance("0")
            }
          })
          .catch(error => console.error(error))
      } catch (error) {
        console.error(error)
      }
    }
  }

  // unwrap if ETH or DAI on Gnosis
  async function unwrapIfNativeToken() {
    if (tokenSymbol === "ETH") {
      try {
        const unwrapTx = await unwrapETH(erc20PositionBalance)
        await unwrapTx.wait()
          .then(() => console.log("Successfully unwrapped ETH"))
          .catch(error => console.error(error))
      } catch (error) {
        console.error(error)
      }
    } else if (tokenSymbol === "DAI" && chainSlug === "gnosis") {
      const wDAIContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
      const wDAIAbi = ["function withdraw(uint256 wad) external"]

      const wDAIContract = new ethers.Contract(wDAIContractAddress, wDAIAbi, signer)

      try {
        const unwrapTx = await wDAIContract.withdraw(erc20PositionBalance, { gasLimit: gasLimit })
        await unwrapTx.wait()
          .then(() => console.log("Successfully unwrapped DAI"))
          .catch(error => console.error(error))
      } catch (error) {
        console.error(error)
      }
    } else {
      console.log("Token is ERC20, no unwrap necessary")
    }
  }

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

  async function changeNetwork() {
    try {
      checkConnectedNetworkId(destinationNetworkId)

      const event = { target: { value: networkIdToSlug(destinationNetworkId) } }
      selectSourceNetwork(event as React.ChangeEvent<{ value: any }>)
    } catch (error) {
      console.error(error)
    }
  }

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

  function convertHTokens() {
    const contractAbi = saddleSwapAbi

    // Create an instance of the contract
    const optimismContract = "0xa50395bdEaca7062255109fedE012eFE63d6D402"

    const contractAddress = optimismContract
    const contract = new ethers.Contract(contractAddress, contractAbi, signer)

    const tokenIndexFrom = 1 // hToken
    const tokenIndexTo = 0 // canonical
    const dx = 1000000000000000
    const minDy = 100000000000000
    const deadline = getDeadline(2)
    
    contract.swap(
      tokenIndexFrom,
      tokenIndexTo,
      dx,
      minDy,
      deadline,
      {
        gasLimit: gasLimit
      }
    )
      .then((balance) => console.log(`success`))
      .catch(error => console.error(error))
  }

  async function debugTransaction() {
    console.log("Logging state values:")
    console.log("destinationNetworkId:", destinationNetworkId)
    console.log("erc20PositionBalance:", erc20PositionBalance)
    console.log("bridgeTxHash:", bridgeTxHash)
    console.log("bondTxHash:", bondTxHash)
    console.log("numberOfBridgedTokensReceived:", numberOfBridgedTokensReceived)
  }


  /* HELPER FUNCTIONS */

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

  async function unwrapETH(amountToUnwrap: string) {
    const wETHContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
    const wethAbi = ["function withdraw(uint wad) public"]

    const wethContract = new ethers.Contract(wETHContractAddress, wethAbi, signer)

    return await wethContract.withdraw(amountToUnwrap, { gasLimit: gasLimit })
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


  if (props.showRebalanceModal) {
    return (
      <div className="styles.root">
        <Modal onClose={() => props.setShowRebalanceModal(false)}>
          <NetworkSelectionSection networksWithYields={networksWithYields} chainSlug={chainSlug} destinationNetworkId={destinationNetworkId} setDestinationNetwork={setDestinationNetwork} />
          <br />
          <br />
          <GodModeSection
            chainSlug={chainSlug}
            setDestinationNetwork={setDestinationNetwork}
            unstake={unstake}
            withdrawPosition={withdrawPosition}
            unwrapIfNativeToken={unwrapIfNativeToken}
            swapAndSend={swapAndSend}
            checkBridgeStatusAndSetBondHash={checkBridgeStatusAndSetBondHash}
            changeNetwork={changeNetwork}
            setBridgedTokenData={setBridgedTokenData}
            wrapIfNativeToken={wrapIfNativeToken}
            addLiquidity={addLiquidity}
            stake={stake}
            getNetworksWithYields={getNetworksWithYields}
            approveToken={approveToken}
            convertHTokens={convertHTokens}
            wrapETH={wrapETH}
            debugTransaction={debugTransaction}
            />
          <RebalanceModalFooter />
        </Modal>
      </div>
    )
  } else {
    return <></>
  }
}
