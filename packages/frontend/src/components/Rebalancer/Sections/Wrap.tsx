import React, { useState } from 'react'
import { ethers } from 'ethers'
import * as addresses from '@hop-protocol/core/addresses'
import Button from 'src/components/buttons/Button'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'
import { StatusMessage } from 'src/components/Rebalancer/Sections/Subsections/StatusMessage'

export function WrapSection(props) {
  const goToNextSection = props.goToNextSection
  const reactAppNetwork = props.reactAppNetwork
  const chainSlug = props.chainSlug
  const tokenSymbol = props.tokenSymbol
  const numberOfBridgedTokensReceived = props.numberOfBridgedTokensReceived
  const signer = props.signer
  const gasLimit = props.gasLimit
  const getHumanErrorMessage = props.getHumanErrorMessage

  const [isTransacting, setIsTransacting] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  async function wrapETH(amountToWrap: string) {
    const wETHContractAddress = addresses?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
    const wethAbi = ["function deposit() payable"]

    const wethContract = new ethers.Contract(wETHContractAddress, wethAbi, signer)

    return await wethContract.deposit({ value: amountToWrap, gasLimit: gasLimit })
  }

  // wrap if ETH or DAI on Gnosis
  async function wrapIfNativeToken() {
    if (tokenSymbol === "ETH") {
      try {
        const wrapTx = await wrapETH(numberOfBridgedTokensReceived)
        await wrapTx.wait()
          .then(() => {
            console.log("Successfully wrapped ETH")
            setStatusMessage("Successfully wrapped ETH")
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
      const wDAIAbi = ["function deposit() payable"]

      const wDAIContract = new ethers.Contract(wDAIContractAddress, wDAIAbi, signer)

      try {
        const wrapTx = await wDAIContract.deposit({ value: numberOfBridgedTokensReceived, gasLimit: gasLimit })
        await wrapTx.wait()
          .then(() => {
            console.log("Successfully wrapped DAI")
            setStatusMessage("Successfully wrapped DAI")
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
      console.log("Token is ERC20, no wrap necessary")
    }
  }

  return (
    <>
      <SectionHeader title="Wrap" subtitle="Wrap native tokens to deposit" />
      <Button
        highlighted={!isTransacting}
        loading={isTransacting}
        large
        fullWidth
        onClick={() => {
          setStatusMessage("Wrapping tokens")
          setIsTransacting(true)
          wrapIfNativeToken()
        }}>
        Wrap
      </Button>
      <StatusMessage message={statusMessage} />
    </>
  )
}
