import React from 'react'
import { ethers, BigNumber } from 'ethers'
import { networkIdToSlug } from 'src/utils/networks'
import * as addresses from '@hop-protocol/core/addresses'
import L2_AmmWrapperAbi from '@hop-protocol/core/abi/generated/L2_AmmWrapper.json'

export function BridgeSection(props) {
  const reactAppNetwork = props.reactAppNetwork
  const chainSlug = props.chainSlug
  const tokenSymbol = props.tokenSymbol
  const signer = props.signer
  const gasLimit = props.gasLimit
  const getTokensAreStaked = props.getTokensAreStaked
  const address = props.address
  const erc20PositionBalance = props.erc20PositionBalance
  const approveToken = props.approveToken
  const getDeadline = props.getDeadline
  const destinationNetworkId = props.destinationNetworkId
  const setBridgeTxHash = props.setBridgeTxHash

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

  return <p>Bridge</p>
}
