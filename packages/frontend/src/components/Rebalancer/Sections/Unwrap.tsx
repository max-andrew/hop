import React, { useState } from 'react'

import { ethers } from 'ethers'
import * as addresses from '@hop-protocol/core/addresses'

import { Box, Typography } from '@material-ui/core'
import Button from 'src/components/buttons/Button'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'
import { StatusMessage } from 'src/components/Rebalancer/Sections/Subsections/StatusMessage'

export function UnwrapSection(props) {
  const tokenSymbol = props.tokenSymbol
  const reactAppNetwork = props.reactAppNetwork
  const signer = props.signer
  const chainSlug = props.chainSlug
  const gasLimit = props.gasLimit
  const erc20PositionBalance = props.erc20PositionBalance
  const getHumanErrorMessage = props.getHumanErrorMessage
  const goToNextSection = props.goToNextSection

  const [isTransacting, setIsTransacting] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  async function unwrapETH(amountToUnwrap: string) {
    const wETHContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
    const wethAbi = ["function withdraw(uint wad) public"]

    const wethContract = new ethers.Contract(wETHContractAddress, wethAbi, signer)

    return await wethContract.withdraw(amountToUnwrap, { gasLimit: gasLimit })
  }

  // unwrap if ETH or DAI on Gnosis
  async function unwrapIfNativeToken() {
    if (tokenSymbol === "ETH") {
      try {
        // error unwrapping bc erc20PositionBalance is undefined
        const unwrapTx = await unwrapETH(erc20PositionBalance)
        await unwrapTx.wait()
          .then(() => {
            console.log("Successfully unwrapped ETH")
            setStatusMessage("Successfully unwrapped ETH")
            setIsTransacting(false)
            goToNextSection()
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
    } else if (tokenSymbol === "DAI" && chainSlug === "gnosis") {
      const wDAIContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
      const wDAIAbi = ["function withdraw(uint256 wad) external"]

      const wDAIContract = new ethers.Contract(wDAIContractAddress, wDAIAbi, signer)

      try {
        const unwrapTx = await wDAIContract.withdraw(erc20PositionBalance, { gasLimit: gasLimit })
        await unwrapTx.wait()
          .then(() => {
            console.log("Successfully unwrapped DAI")
            setStatusMessage("Successfully unwrapped ETH")
            setIsTransacting(false)
            goToNextSection()
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
    } else {
      console.log("Token is ERC20, no unwrap necessary")
      setStatusMessage("No unwrap necessary")
      setIsTransacting(false)
      goToNextSection()
    }
  }

  return (
    <>
      <SectionHeader title="Unwrap" subtitle="Convert your tokens to the native version" />
      <Button
        highlighted={!isTransacting}
        loading={isTransacting}
        large
        fullWidth
        onClick={() => {
          setStatusMessage("Unwrapping tokens")
          setIsTransacting(true)
          unwrapIfNativeToken()
        }}>
        Unwrap
      </Button>
      <StatusMessage message={statusMessage} />
    </>
  )
}
