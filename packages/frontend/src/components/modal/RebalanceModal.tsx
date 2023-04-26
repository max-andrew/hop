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
  const { selectedNetwork, selectSourceNetwork } = useSelectedNetwork({ l2Only: true })
  const { selectedBridge } = useApp()

  const signer = provider?.getSigner()

  const [positionERC20Balance, setPositionERC20Balance] = useState("")

  const maxAmount = BigNumber.from(2).pow(256).sub(1)
  const deadline = 26821122300
  const gasLimit = 1000000


  async function unstake() {
    const chainSlug = selectedNetwork?.slug ?? ""
    const tokenSymbol = selectedBridge?.getTokenSymbol() ?? ""

    const stakingContractAddress = hopStakingRewardsContracts?.[reactAppNetwork]?.[chainSlug]?.[tokenSymbol]

    // approve LP token spending
    try {
      const approveTx = await approveLPTokenFor(stakingContractAddress)
      await approveTx.wait()
      console.log("Approved successfully")
    } catch (error) {
      console.log(error)
      return
    }

    // stake LP tokens
    try {
      const stakingContract = new ethers.Contract(stakingContractAddress, stakingRewardsAbi, signer)
      const stakeTx = await stakingContract.exit({ gasLimit: gasLimit * 2 })
      stakeTx.wait()
        .then(() => console.log("Unstaked successfully"))
        .catch(error => console.log(error))
    } catch (error) {
      console.log(error)
    }
  }

  function withdrawPosition() {
    const saddleSwapAddress = "0xa50395bdEaca7062255109fedE012eFE63d6D402"

    approveLPTokenFor(saddleSwapAddress)
      .then(() => {
        const lpTokenContractAddress = "0x2105a73d7739f1034becc1bd87f4f7820d575644"
        const balanceOfAbi = ["function balanceOf(address account) view returns (uint256)"]
        const lpTokenContract = new ethers.Contract(lpTokenContractAddress, balanceOfAbi, signer)
        
        // get balance of LP token
        lpTokenContract.balanceOf("0xfEF19d3BB4575F69bff2b74D20d9155e67Ebe777")
          .then((balance) => {
            console.log("Token balance:", balance.toString())
            removeLiquidityOneToken(balance.toString())
            setPositionERC20Balance(balance.toString())
          })
          .catch(error => console.log(error))
      })
      .catch(error => console.log(error))

    function removeLiquidityOneToken(balance: string) {
      const amount: BigNumber = BigNumber.from(balance.toString())
      const minAmount = amount.mul(95).div(100).toString()

      const swapContract = new ethers.Contract(saddleSwapAddress, saddleSwapAbi, signer)

      /*
        uint256 tokenAmount,
        uint8 tokenIndex,
        uint256 minAmount,
        uint256 deadline
      */
      swapContract.removeLiquidityOneToken(amount, 0, minAmount, deadline, { gasLimit: gasLimit })
        .then((tokensReceived) => console.log(`success`))
        .catch(error => console.log(error))
    }
  }

  // bridge canonical tokens
  function swapAndSend() {
    const contractAbi = L2_AmmWrapperAbi

    // Create an instance of the contract
    const optimismContract = "0xC1985d7a3429cDC85E59E2E4Fcc805b857e6Ee2E"
    const arbitrumContract = "0xa832293f2DCe2f092182F17dd873ae06AD5fDbaF"

    const contractAddress = optimismContract
    const contract = new ethers.Contract(contractAddress, contractAbi, signer)

    // UPDATE: hardcoded as Arbitrum Goerli // Optimism Goerli
    const chainId = 421613 // 420 // 0x66eed // 0x1a4 // uint256
    const recipient = "0xfEF19d3BB4575F69bff2b74D20d9155e67Ebe777" // address
    const amount = 1000000000000000 // uint256
    const bonderFee = 350802141917622 // uint256
    const amountOutMin = 1000000000 // uint256
    const deadline = 26821122300 // uint256
    const destinationAmountOutMin = 1000000000 // uint256
    const destinationDeadline = 26821122300 // uint256

    fetch(`https://api.hop.exchange/v1/quote?amount=${amount}&token=ETH&fromChain=optimism&toChain=arbitrum&slippage=0.5`)
      .then(response => response.json())
      .then(data => {
          console.log("Bonder fee:", data)
        })
      .catch(error => console.error(error))

    const gasLimit = 10000000
    
    // Call the function on the contract instance
    contract.swapAndSend(
      chainId,
      recipient,
      amount,
      bonderFee,
      amountOutMin,
      deadline,
      destinationAmountOutMin,
      destinationDeadline,
      { 
        value: amount,
        gasLimit: gasLimit 
      }
    )
      .then((balance) => console.log(`success`))
      .catch(error => console.log(error))
  }

  function addLiquidity() {
    // get amount sent to destination network

    // wrap if ETH

    const saddleSwapContractAddress = "0xa50395bdEaca7062255109fedE012eFE63d6D402"

    const gasLimit = 10000000
    const deadline = 26821122300
    const maxAmount = BigNumber.from(2).pow(256).sub(1)

    // approve LP token spending
    const wETHContractAddress = "0xDc38c5aF436B9652225f92c370A011C673FA7Ba5"
    // contract requesting spending cap: 0xa50395bdeaca7062255109fede012efe63d6d402

    const approveAbi = ["function approve(address spender, uint256 amount) external returns (bool)"]
    const wETHContract = new ethers.Contract(wETHContractAddress, approveAbi, signer)

    // approve token
    wETHContract.approve(saddleSwapContractAddress, maxAmount, { gasLimit: gasLimit })
      .then(() => {
        // using amount received
        const amount: BigNumber = BigNumber.from("1000000000000000")
        const minToMint = amount.mul(80).div(100).toString()

        const swapContract = new ethers.Contract(saddleSwapContractAddress, saddleSwapAbi, signer)

        /*
          uint256[] calldata amounts,
          uint256 minToMint,
          uint256 deadline

          -> amount of LP token user minted and received
        */
        swapContract.addLiquidity([amount, 0], minToMint, deadline, { gasLimit: gasLimit })
          .then((tokensReceived) => console.log(`success`))
          .catch(error => console.log(error))
      })
      .catch(error => console.log(error))
  }

  async function stake() {
    // get balanceOf LP tokens
    const amount = "10000000000000000"

    const stakingContractAddress = "0xd691E3f40692a28f0b8090D989cC29F24B59f945"

    // approve LP token spending
    const approveTx = await approveLPTokenFor(stakingContractAddress)
    await approveTx.wait()
      .then(() => console.log(`Approved successfully`))
      .catch(error => console.log(error))

    // stake LP tokens
    const stakingContract = new ethers.Contract(stakingContractAddress, stakingRewardsAbi, signer)

    const stakeTx = await stakingContract.stake(amount, { gasLimit: gasLimit * 3 })
    stakeTx.wait()
      .then(() => console.log(`Staked successfully`))
      .catch(error => console.log(error))
  }


  async function approveLPTokenFor(address: string) {
    const chainSlug = selectedNetwork?.slug ?? ""
    const tokenSymbol = selectedBridge?.getTokenSymbol() ?? ""

    // approve LP token spending
    try {
      const lpTokenContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2SaddleLpToken

      const approveAbi = ["function approve(address spender, uint256 amount) external returns (bool)"]
      const lpTokenContract = new ethers.Contract(lpTokenContractAddress, approveAbi, signer)

      console.log("Approved successfully")

      return await lpTokenContract.approve(address, maxAmount, { gasLimit: gasLimit })
    } catch (error) {
      console.log(error)
    }
  }

  async function approveTokens(tokenAddress: string, spenderAddress: string) {
    // approve if allowance is less than the amount needed

    /* 
    const balance = await lpToken.balanceOf()
    const allowance = await lpToken.allowance(saddleSwap.address)
    if (allowance.lt(balance)) {
      return lpToken.approve(saddleSwap.address, constants.MaxUint256)
    } 
    */


    const chainSlug = selectedNetwork?.slug ?? ""
    const tokenSymbol = selectedBridge?.getTokenSymbol() ?? ""

    // approve LP token spending
    try {
      const lpTokenContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2SaddleLpToken

      const approveAbi = ["function approve(address spender, uint256 amount) external returns (bool)"]
      const lpTokenContract = new ethers.Contract(lpTokenContractAddress, approveAbi, signer)

      console.log("Approved successfully")

      return await lpTokenContract.approve(address, maxAmount, { gasLimit: gasLimit })
    } catch (error) {
      console.log(error)
    }
  }

    /*
    approve:
      weth
        0xDc38c5aF436B9652225f92c370A011C673FA7Ba5
      l2 wrapper
        0xC1985d7a3429cDC85E59E2E4Fcc805b857e6Ee2E
      saddleswap
        0xa50395bdEaca7062255109fedE012eFE63d6D402
      bridge
        0x2708E5C7087d4C6D295c8B58b2D452c360D505C7
      hETH
        0xC8A4FB931e8D77df8497790381CA7d228E68a41b
    */

    /*
    const optimismWETH = "0xDc38c5aF436B9652225f92c370A011C673FA7Ba5"
    const arbitrumWETH = "0xCb5DDFb8D0038247Dc0bEeeCAa7f3457bEFcb77c"
    const WETHAddress = optimismWETH

    const optimismHETH = "0xC8A4FB931e8D77df8497790381CA7d228E68a41b"
    const arbitrumHETH = "0x3F9880B2dF19aE17AdbdcD6a91a16fCd4a1A9D3D"
    const HETHAddress = optimismHETH

    const contractAbi = ["function approve(address spender, uint256 amount) external returns (bool)"]
  
    // Create an instance of the WETH contract
    const contractWETHAddress = WETHAddress
    const contractWETH = new ethers.Contract(contractWETHAddress, contractAbi, signer)

    // Create an instance of the HETH contract
    const contractHETHAddress = HETHAddress
    const contractHETH = new ethers.Contract(contractHETHAddress, contractAbi, signer)
    */
    // Call the function on the contract instance
    /*
    contractWETH.approve("0xC1985d7a3429cDC85E59E2E4Fcc805b857e6Ee2E", maxAmount, { gasLimit: gasLimit })
      .then((balance) => console.log(`success`))
      .catch(error => console.log(error))
    */

    // Call the function on the contract instance
    /*
    contractHETH.approve("0x2708E5C7087d4C6D295c8B58b2D452c360D505C7", maxAmount, { gasLimit: gasLimit })
      .then((balance) => console.log(`success`))
      .catch(error => console.log(error))
    */

    // approve HOP-LP-ETH contract (for adding liquidity)
    // token contract: 0x2105a73d7739f1034becc1bd87f4f7820d575644
    // Contract requesting spending cap: 0xd691e3f40692a28f0b8090d989cc29f24b59f945

  function convertHTokens() {
    const contractAbi = saddleSwapAbi

    // Create an instance of the contract
    const optimismContract = "0xa50395bdEaca7062255109fedE012eFE63d6D402"

    const contractAddress = optimismContract
    const contract = new ethers.Contract(contractAddress, contractAbi, signer)

    const gasLimit = 10000000

    const tokenIndexFrom = 1 // hToken
    const tokenIndexTo = 0 // canonical
    const dx = 1000000000000000
    const minDy = 100000000000000
    const deadline = 26821122300
    
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
      .catch(error => console.log(error))
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

  async function debugTransaction() {
    console.log(reactAppNetwork === 'goerli')
    const tokenSymbol = selectedBridge?.getTokenSymbol() ?? ""

    console.log(tokenSymbol)

    const chainSlug = selectedNetwork?.slug ?? ""
    const lpTokenContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2SaddleLpToken
   
    console.dir(lpTokenContractAddress)
    /*
    const transactionHash = '0xcdd3b0f6a85b038d59ed5f740a36f13db19ba8eac4f60d12ddce93645627c3f0' // Replace with your transaction hash
    const etherscanApiKey = 'YYY' // Replace with your Etherscan API key

    const etherscanProvider = new ethers.providers.EtherscanProvider(420, etherscanApiKey)

    etherscanProvider.getTransactionReceipt(transactionHash).then((receipt) => {
      console.log('Transaction status:', receipt.status === 1 ? 'success' : 'failure')
      console.log('Block number:', receipt.blockNumber)
      console.log('Gas used:', receipt.gasUsed.toString())
      console.log('Logs:', receipt.logs)
    }).catch((error) => {
      console.log('Error:', error)
    })
    */
  }

  function getDeadline(confirmTimeMinutes) {
    const currentTime = Math.floor(Date.now() / 1000) // convert milliseconds to seconds
    const deadline = currentTime + (confirmTimeMinutes * 60) // add confirmation time in seconds
    return deadline
  }

  if (props.showRebalanceModal) {
    return (
      <div className="styles.root">
        <Card className="styles.card">
          <RebalanceModalHeader headerTitle="Rebalance staked position" />
          <button onClick={() => unstake()}>Unstake</button>
          <button onClick={() => withdrawPosition()}>Withdraw</button>
          <button onClick={() => swapAndSend()}>Send</button>
          <button onClick={() => addLiquidity()}>Add liquidity</button>
          <button onClick={() => stake()}>Stake</button>
          <p> - </p>
          <button onClick={() => approveTokens("0x2105a73d7739f1034becc1bd87f4f7820d575644", "0xd691e3f40692a28f0b8090d989cc29f24b59f945")}>Approve</button>
          <button onClick={() => convertHTokens()}>Convert hTokens</button>
          <button onClick={() => changeNetwork(421613)}>Change network</button>
          <button onClick={() => debugTransaction()}>Debug</button>
          <p> - </p>
          <button onClick={() => props.setShowRebalanceModal(false)}>Close</button>
          <RebalanceModalFooter />
        </Card>
      </div>
    )
  } else {
    return <></>
  }
}
