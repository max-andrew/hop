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
import { useSelectedNetwork } from 'src/hooks'
import { reactAppNetwork } from 'src/config'
import { ChainSlug, utils as sdkUtils } from '@hop-protocol/sdk'
import { useApp } from 'src/contexts/AppContext'

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

  // testing default values
  // const [erc20PositionBalance, setERC20PositionBalance] = useState("0")

  // testing values
  const maxAmount = BigNumber.from(2).pow(256).sub(1)
  // const deadline = 26821122300
  const gasLimit = 1000000
  const destinationChainId = 421613


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
          .then((removeLiquidityTxReceipt) => {
            if (typeof removeLiquidityTxReceipt !== "undefined") {
              let numberOfTokensWithdrawn: string = removeLiquidityTxReceipt.logs[1].data.toString()
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

  // bridge canonical tokens
  async function swapAndSend() {
    const l2AmmWrapperContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2AmmWrapper
    const l2AmmWrapperContract = new ethers.Contract(l2AmmWrapperContractAddress, L2_AmmWrapperAbi, signer)

    const chainId = destinationChainId
    const recipient = address?.address
    let amount = localStorage.getItem("erc20PositionBalance") ?? "0"
    let bonderFee
    const amountOutMin = amount !== null ? (+amount * 0.95).toString() : "0"
    const deadline = getDeadline(2)
    const destinationAmountOutMin = amountOutMin
    const destinationDeadline = getDeadline(3)

    try {
      await fetch(`https://api.hop.exchange/v1/quote?amount=${amount}&token=${tokenSymbol}&fromChain=${chainSlug}&toChain=arbitrum&slippage=0.5`)
      .then(response => response.json())
      .then(data => {
        bonderFee = data.bonderFee.toString()
        amount = (+amount + +bonderFee).toString()
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
        chainId,
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
      await bridgeTx.wait()
        .then(() => console.log("Successfully bridged tokens"))
        .catch(error => console.error(error))
    } catch (error) {
      console.error(error)
    }
  }

  async function addLiquidity() {
    const erc20PositionBalance = localStorage.getItem("erc20PositionBalance") ?? "10000000000000000"

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


  function getDestination() {
    // use yields and user input to determine the destination chain
  }

  async function approveToken(tokenAddress: string, spenderAddress: string, amount: string) {
    // approve if allowance is less than the amount needed
    const allowanceAndApproveAbi = ["function allowance(address owner, address spender) public view returns (uint256)", "function approve(address spender, uint256 amount) external returns (bool)"]
    const tokenContract = new ethers.Contract(tokenAddress, allowanceAndApproveAbi, signer)

    // get the current allowance for the token and spender
    let currentAllowance = await tokenContract.allowance(address?.address, spenderAddress)
    currentAllowance = currentAllowance.toString()

    // check if the current allowance is less than the maximum amount
    if (currentAllowance < amount) {
      console.log("Allowance is less than amount, approving higher limit")
      // approve LP token spending
      return tokenContract.approve(spenderAddress, amount, { gasLimit: gasLimit })
    } else {
      console.log("Allowance is equal to or greater than amount, no approval necessary")
    }
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

  async function changeNetwork(destinationNetworkId: number) {
    // Switch to the Ropsten test network
    // provider?.send('wallet_switchEthereumChain', [{ chainId: "421613" }]).catch(() => {
    //   provider?.send('wallet_addEthereumChain', [{ chainId: "421613", rpcUrl: 'https://ropsten.infura.io/v3/84842078b09946638c03157f83405213' }])
    // })

    // const event = { target: { value: "polygon" } }
    // selectSourceNetwork(event as React.ChangeEvent<{ value: any }>)

    /*
    window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: "0x89",
        rpcUrls: ["https://rpc-mainnet.matic.network/"],
        chainName: "Matic Mainnet",
        nativeCurrency: {
            name: "MATIC",
            symbol: "MATIC",
            decimals: 18
        },
        blockExplorerUrls: ["https://polygonscan.com/"]
      }]
    })
    */
  }

  async function wrapETH(amountToWrap: string) {
    const wETHContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
    const wethAbi = ["function deposit() payable"]

    const wethContract = new ethers.Contract(wETHContractAddress, wethAbi, signer)

    return await wethContract.deposit({ value: amountToWrap, gasLimit: gasLimit })
  }

  async function debugTransaction() {
    localStorage.setItem("erc20PositionBalance", "10000000000000000")
  }

  function getDeadline(confirmTimeMinutes: number) {
    const currentTime = Math.floor(Date.now() / 1000) // convert milliseconds to seconds
    const deadline = currentTime + (confirmTimeMinutes * 60) // add confirmation time in seconds
    return deadline
  }

  if (props.showRebalanceModal) {
    return (
      <div className="styles.root">
        <Card className="styles.card">
          <RebalanceModalHeader headerTitle="Rebalance staked position" />
          <br />
          <button onClick={() => unstake()}>Unstake</button>
          <button onClick={() => withdrawPosition()}>Withdraw</button>
          <button onClick={() => swapAndSend()}>Bridge</button>
          <button onClick={() => addLiquidity()}>Deposit</button>
          <button onClick={() => stake()}>Stake</button>
          <p> - </p>
          <button onClick={() => getDestination()}>Get destination chain</button>
          <button onClick={() => approveToken("0x2105a73d7739f1034becc1bd87f4f7820d575644", "0xd691e3f40692a28f0b8090d989cc29f24b59f945", maxAmount.toString())}>Approve</button>
          <button onClick={() => convertHTokens()}>Convert hTokens</button>
          <br />
          <br />
          <button onClick={() => changeNetwork(421613)}>Change network</button>
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
