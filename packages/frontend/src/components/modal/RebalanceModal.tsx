import React, { useState, useEffect } from 'react'
import Modal from 'src/components/modal/Modal'
import Divider from '@material-ui/core/Divider'
import { Text } from 'src/components/ui/Text'
import Card from '@material-ui/core/Card'
import { makeStyles, Theme } from '@material-ui/core/styles'
import { isDarkMode } from 'src/theme/theme'
import { BigNumber, ethers } from 'ethers'
import { useWeb3Context } from 'src/contexts/Web3Context'
import { stakingRewardsAbi } from '@hop-protocol/core/abi'
import saddleSwapAbi from '@hop-protocol/core/abi/generated/Swap.json'
import L2_AmmWrapperAbi from '@hop-protocol/core/abi/generated/L2_AmmWrapper.json'
import { hopStakingRewardsContracts } from 'src/config/addresses'
import * as addresses from '@hop-protocol/core/addresses'
import * as networks from '@hop-protocol/core/networks'
import { ChainSlug, utils as sdkUtils } from '@hop-protocol/sdk'
import { useSelectedNetwork } from 'src/hooks'
import { reactAppNetwork } from 'src/config'
import { useApp } from 'src/contexts/AppContext'
import { networkIdToSlug } from 'src/utils/networks'

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 4,
    overflow: 'auto',
    transition: 'all 0.15s ease-out',
    background: '#00000070',
    '&.entering': {
      background: 'transparent',
    },
    '&.entered': {
      background: isDarkMode(theme) ? '#0000005a' : '#f4f4f491',
    },
    '&.exiting': {
      background: '#f4f4f491',
    },
    '&.exited': {
      background: 'transparent',
    },
  },
  card: {
    position: 'relative',
    padding: 0,
    overflow: 'auto',
    maxHeight: '100%',
    border: isDarkMode(theme) ? '1px solid #353535' : 'none',
    boxShadow: isDarkMode(theme) ? 'none' : theme.boxShadow.card,
  }
}))

function RebalanceModalHeader(props) {
  const headerTitle = props.headerTitle

  if (typeof headerTitle !== "undefined") {
    return (
      <>
        <Text mono style={{ fontSize: 12, textTransform: "uppercase", textAlign: "center" }}>{headerTitle}</Text>
        <br />
        <Divider />
      </>
    )
  } else {
    return <></>
  }
}

function RebalanceModalFooter(props) {
  const currentStep = 1
  const totalSteps = 5

  return (
    <>
      <Divider />
      <br />
      <Text mono style={{ fontSize: 12, textTransform: "uppercase", textAlign: "center" }}>Step {currentStep}/{totalSteps}</Text>
    </>
  )
}

export function RebalanceModal(props) {
  const styles = useStyles()

  const { address, provider, onboard, connectedNetworkId, checkConnectedNetworkId } = useWeb3Context()
  const signer = provider?.getSigner()

  const { selectedNetwork, selectSourceNetwork } = useSelectedNetwork({ l2Only: true })
  const chainSlug = selectedNetwork?.slug ?? ""

  const { selectedBridge } = useApp()
  const tokenSymbol = selectedBridge?.getTokenSymbol() ?? ""

  const [destinationNetworkId, setDestinationNetworkId] = useState(420)
  const [bridgeTxHash, setBridgeTxHash] = useState("")
  const [bondTxHash, setBondTxHash] = useState("")

  // testing values
  const maxAmount = BigNumber.from(2).pow(256).sub(1)
  const gasLimit = 700000


  /* REBALANCE FUNCTIONS */

  // use yields and user input to determine the destination chain
  function setDestinationNetwork() {
    setDestinationNetworkId(420)
  }

  async function unstake() {
    const stakingContractAddress = hopStakingRewardsContracts?.[reactAppNetwork]?.[chainSlug]?.[tokenSymbol]

    // unstake LP tokens
    try {
      const stakingContract = new ethers.Contract(stakingContractAddress, stakingRewardsAbi, signer)
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
      console.log("LP token balance:", balance)
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

      const minAmount = Math.round(+amount * 0.95).toString()
      const deadline = getDeadline(2)

      /*
        uint256 tokenAmount,
        uint8 tokenIndex,
        uint256 minAmount,
        uint256 deadline
      */
      try {
        const removeLiquidityTx = await swapContract.removeLiquidityOneToken(amount, 0, minAmount, deadline, { gasLimit: gasLimit })
        await removeLiquidityTx.wait()
          .then(async (removeLiquidityTxReceipt) => {
            if (typeof removeLiquidityTxReceipt !== "undefined") {
              let numberOfTokensWithdrawn: string = removeLiquidityTxReceipt.logs[2].data.toString()
              numberOfTokensWithdrawn = parseInt(numberOfTokensWithdrawn, 16).toString()

              console.log("Successfully withdrew", numberOfTokensWithdrawn, "tokens")
              localStorage.setItem("erc20PositionBalance", numberOfTokensWithdrawn)
            } else {
              localStorage.setItem("erc20PositionBalance", "0")
            }
          })
          .catch(error => console.error(error))
      } catch (error) {
        console.error(error)
      }
    }
  }

  // unwrap if ETH
  async function unwrapIfETH() {
    if (tokenSymbol === "ETH") {
      try {
        const erc20PositionBalance = localStorage.getItem("erc20PositionBalance") ?? "0"

        const unwrapTx = await unwrapETH(erc20PositionBalance)
        await unwrapTx.wait()
          .then(() => console.log("Successfully unwrapped ETH"))
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

    const recipient = address?.address
    let amount = localStorage.getItem("erc20PositionBalance") ?? "0"
    let bonderFee
    const amountOutMin = amount !== null ? (+amount * 0.95).toString() : "0"
    const deadline = getDeadline(2)
    const destinationAmountOutMin = amountOutMin
    const destinationDeadline = getDeadline(3)

    const destinationNetworkSlug = networkIdToSlug(destinationNetworkId)

    try {
      await fetch(`https://api.hop.exchange/v1/quote?amount=${amount}&token=${tokenSymbol}&fromChain=${chainSlug}&toChain=${destinationNetworkSlug}&slippage=0.5`)
      .then(response => response.json())
      .then(data => {
        bonderFee = data.bonderFee

        if (reactAppNetwork === "goerli") {
          bonderFee = bonderFee * 2
        }

        amount = (+amount + bonderFee).toString()
        console.log("Bonder fee:", bonderFee)
      })
    } catch (error) {
      console.error(error)
      return
    }

    let value = amount
    if (tokenSymbol !== "ETH") {
      value = "0"
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

  async function checkBridgeStatus() {
    const bridgeStatusURL: string = `https://api.hop.exchange/v1/transfer-status?transactionHash=${bridgeTxHash}&network=${reactAppNetwork}`

    const response = await fetch(bridgeStatusURL)
    const data = await response.json()

    if (typeof data.error !== "undefined") {
      console.log("Error checking bridge status")
      return
    }

    const deadline = getDeadline(3)
    
    while (getDeadline(0) < deadline) {
      const response = await fetch(bridgeStatusURL)
      const data = await response.json()

      if (data.bonded) {
        setBondTxHash(data.bondTransactionHash)
        console.log("Successfully bridged tokens")
        return
      } else {
        console.log("Could not yet confirm successful bridging, rechecking")
      }

      await new Promise(resolve => setTimeout(resolve, 10000)) // 10 second intervals
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

  async function addLiquidity() {
    // const numberOfBridgedTokensReceived: string = bondTxReceipt.logs[11].data.toString()
    const erc20PositionBalance = localStorage.getItem("erc20PositionBalance") ?? "0"

    // wrap if ETH
    if (tokenSymbol === "ETH") {
      try {
        const wrapTx = await wrapETH(erc20PositionBalance)
        await wrapTx.wait()
          .then(() => console.log("Successfully wrapped ETH"))
          .catch(error => console.error(error))
      } catch (error) {
        console.error(error)
        return
      }
    }

    const wETHContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
    const saddleSwapContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2SaddleSwap

    // approve wETH token spending
    try {
      const approveTx = await approveToken(wETHContractAddress, saddleSwapContractAddress, erc20PositionBalance)
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
    const minToMint = Math.round(+erc20PositionBalance * 0.7).toString()
    const deadline = getDeadline(2)

    /*
      uint256[] calldata amounts,
      uint256 minToMint,
      uint256 deadline

      -> amount of LP token user minted and received
    */
    try {
      const depositTx = await swapContract.addLiquidity([erc20PositionBalance, 0],  minToMint, deadline, { gasLimit: gasLimit })
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

  function getLocalStorage() {
    console.log(localStorage.getItem("erc20PositionBalance"))
  }

  function clearLocalStorage() {
    localStorage.setItem("erc20PositionBalance", "0")
    console.log("Successfully cleared local storage")
  }

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
    
    /*
      uint8 tokenIndexFrom,
      uint8 tokenIndexTo,
      uint256 dx,
      uint256 minDy,
      uint256 deadline
    */
    // Call the function on the contract instance
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
    const response = await fetch(`https://api.hop.exchange/v1/transfer-status?transactionHash=${"0x374fbb2f63e568e646f0c6aa28169e954b126a8a7949ecac7693ab7801ea2f2"}&network=${reactAppNetwork}`)
    const data = await response.json()

    console.dir(data)
    console.log(typeof data.error === "undefined")
  }


  /* HELPER FUNCTIONS */

  async function approveToken(tokenAddress: string, spenderAddress: string, amount: string) {
    const allowanceAndApproveAbi = ["function allowance(address owner, address spender) public view returns (uint256)", "function approve(address spender, uint256 amount) external returns (bool)"]
    const tokenContract = new ethers.Contract(tokenAddress, allowanceAndApproveAbi, signer)

    // get the current allowance for the token and spender
    let currentAllowance = await tokenContract.allowance(address?.address, spenderAddress)
    currentAllowance = currentAllowance.toString()

    // check if the current allowance is less than the required amount
    if (currentAllowance < amount) {
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

  function getDeadline(confirmTimeMinutes: number) {
    const currentTime = Math.floor(Date.now() / 1000)
    const deadline = currentTime + (confirmTimeMinutes * 60)
    return deadline
  }


  if (props.showRebalanceModal) {
    return (
      <div className="styles.root">
        <Card className="styles.card">
          <RebalanceModalHeader headerTitle="Rebalance staked position" />
          <br />
          <button onClick={() => setDestinationNetwork()}>Get destination chain</button>
          <button onClick={() => unstake()}>Unstake</button>
          <button onClick={() => withdrawPosition()}>Withdraw</button>
          <button onClick={() => unwrapIfETH()}>Unwrap if ETH</button>
          <button onClick={() => swapAndSend()}>Bridge</button>
          <br />
          <br />
          <button onClick={() => checkBridgeStatus()}>Check bridge status</button>
          <button onClick={() => changeNetwork()}>Change network</button>
          <button onClick={() => addLiquidity()}>Deposit</button>
          <button onClick={() => stake()}>Stake</button>
          <p> - </p>
          <button onClick={() => getLocalStorage()}>Get local storage</button>
          <button onClick={() => clearLocalStorage()}>Clear local storage</button>
          <br />
          <br />
          <button onClick={() => approveToken("0x2105a73d7739f1034becc1bd87f4f7820d575644", "0xd691e3f40692a28f0b8090d989cc29f24b59f945", maxAmount.toString())}>Approve</button>
          <button onClick={() => convertHTokens()}>Convert hTokens</button>
          <button onClick={() => wrapETH("1000000000000000")}>Wrap ETH</button>
          <button onClick={() => debugTransaction()}>Debug</button>
          <p> - </p>
          <button onClick={() => props.setShowRebalanceModal(false)}>Close</button>
          <br />
          <br />
          <RebalanceModalFooter />
        </Card>
      </div>
    )
  } else {
    return <></>
  }
}
