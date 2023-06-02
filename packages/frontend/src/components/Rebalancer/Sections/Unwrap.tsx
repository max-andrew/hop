import React, { useState } from 'react'
import { ethers, Signer } from 'ethers'
import * as hopMetadata from '@hop-protocol/core/metadata'
import * as addresses from '@hop-protocol/core/addresses'
import Button from 'src/components/buttons/Button'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'
import { StatusMessage } from 'src/components/Rebalancer/Sections/Subsections/StatusMessage'

interface UnwrapSectionProps {
  reactAppNetwork: string
  chainSlug: string
  tokenSymbol: string
  signer: Signer
  erc20PositionBalance: string
  getHumanErrorMessage: (error: Error) => string
  goToNextSection: () => void
}

export function UnwrapSection(props: UnwrapSectionProps) {
  const reactAppNetwork = props.reactAppNetwork
  const chainSlug = props.chainSlug
  const tokenSymbol = props.tokenSymbol
  const signer = props.signer
  const erc20PositionBalance = props.erc20PositionBalance
  const getHumanErrorMessage = props.getHumanErrorMessage
  const goToNextSection = props.goToNextSection

  const [isTransacting, setIsTransacting] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  function isNativeToken(chainSlug: string, tokenSymbol: string): boolean {
    let adjustedTokenSymbol = tokenSymbol

    if (tokenSymbol === "DAI" && chainSlug === "gnosis") {
      adjustedTokenSymbol = "XDAI"
    }

    return adjustedTokenSymbol === (hopMetadata as any)?.[reactAppNetwork]?.chains?.[chainSlug]?.nativeTokenSymbol
  }

  async function unwrapETH(amountToUnwrap: string) {
    const wETHContractAddress = (addresses as any)?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
    const wethAbi = ["function withdraw(uint256 _amount) external returns (bool)"]
    const wethContract = new ethers.Contract(wETHContractAddress, wethAbi, signer)
    const gasLimit = await wethContract.estimateGas.withdraw(amountToUnwrap)

    return await wethContract.withdraw(amountToUnwrap, { gasLimit: gasLimit })
  }

  async function unwrapDAI(amountToUnwrap: string) {
    const wDAIContractAddress = (addresses as any)?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
    const wDAIAbi = ["function withdraw(uint256 _amount) external returns (bool)"]
    const wDAIContract = new ethers.Contract(wDAIContractAddress, wDAIAbi, signer)
    const gasLimit = await wDAIContract.estimateGas.withdraw(amountToUnwrap)

    return wDAIContract.withdraw(amountToUnwrap, { gasLimit: gasLimit })
  }

  async function unwrapIfNativeToken() {
    if (isNativeToken(chainSlug, tokenSymbol)) {
      try {
        let unwrapTx
        if (tokenSymbol === "ETH") {
          unwrapTx = await unwrapETH(erc20PositionBalance)
        } else if (tokenSymbol === "DAI") {
          unwrapTx = await unwrapDAI(erc20PositionBalance)
        } else {
          console.log("Could not identify token to unwrap")
          setStatusMessage("Error unwrapping token")
          setIsTransacting(false)
          return
        }

        await unwrapTx.wait()
          .then(() => {
            console.log("Successfully unwrapped ETH")
            setStatusMessage("Successfully unwrapped ETH")
            setIsTransacting(false)
            goToNextSection()
          })
          .catch((error: Error) => {
            console.error(error)
            setStatusMessage(getHumanErrorMessage(error))
            setIsTransacting(false)
          })
      } catch (error) {
        console.error(error)
        setStatusMessage(getHumanErrorMessage(error as Error))
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
