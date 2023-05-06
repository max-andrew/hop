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
  gasLimit: number
  erc20PositionBalance: string
  getHumanErrorMessage: (error: Error) => string
  goToNextSection: () => void
}

export function UnwrapSection(props: UnwrapSectionProps) {
  const reactAppNetwork = props.reactAppNetwork
  const chainSlug = props.chainSlug
  const tokenSymbol = props.tokenSymbol
  const signer = props.signer
  const gasLimit = props.gasLimit
  const erc20PositionBalance = props.erc20PositionBalance
  const getHumanErrorMessage = props.getHumanErrorMessage
  const goToNextSection = props.goToNextSection

  const [isTransacting, setIsTransacting] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  function isNativeToken(chainSlug: string, tokenSymbol: string): boolean {
    return tokenSymbol === (hopMetadata as any)?.[reactAppNetwork]?.chains?.[chainSlug]?.nativeTokenSymbol
  }

  async function unwrapETH(amountToUnwrap: string) {
    const wETHContractAddress = (addresses as any)?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
    const wethAbi = ["function withdraw(uint wad) public"]

    const wethContract = new ethers.Contract(wETHContractAddress, wethAbi, signer)

    return await wethContract.withdraw(amountToUnwrap, { gasLimit: gasLimit })
  }

  // unwrap if native
  async function unwrapIfNativeToken() {
    if (isNativeToken(chainSlug, tokenSymbol)) {
      if (tokenSymbol === "ETH") {
        try {
          const unwrapTx = await unwrapETH(erc20PositionBalance)
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
      } else if (tokenSymbol === "DAI") {
        const wDAIContractAddress = (addresses as any)?.[reactAppNetwork]?.bridges?.[tokenSymbol]?.[chainSlug]?.l2CanonicalToken
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
