import React, { useState, useEffect } from 'react'
import Modal from 'src/components/modal/Modal'
import Divider from '@material-ui/core/Divider'
import { Text } from 'src/components/ui/Text'
import Card from '@material-ui/core/Card'
import { makeStyles, Theme } from '@material-ui/core/styles'
import { isDarkMode } from 'src/theme/theme'
import { ethers } from 'ethers'
import { useWeb3Context } from 'src/contexts/Web3Context'
import stakingRewardsAbi from '@hop-protocol/core/abi/static/StakingRewards.json'
import saddleSwapAbi from '@hop-protocol/core/abi/generated/Swap.json'

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
  const { address, provider } = useWeb3Context()

  const [addressString, setAddressString] = useState("")

  useEffect(() => {
      if (typeof address?.address !== "undefined") {
        setAddressString(address.address)
      }
  }, [address])

  function unstakePosition(provider) {
    const signer = provider?.getSigner()
    const contractAbi = stakingRewardsAbi

    // Create an instance of the contract
    const contractAddress = "0x9142C0C1b0ea0008B0b6734E1688c8355FB93b62"
    const contract = new ethers.Contract(contractAddress, contractAbi, signer)

    // Call the function on the contract instance
    contract.exit()
      .then((balance) => console.log(`success`))
      .catch(error => console.log(error))
  }

  function withdrawPosition(provider) {
    const signer = provider?.getSigner()
    const contractAbi = saddleSwapAbi

    // Create an instance of the contract
    const contractAddress = "0x69a71b7F6Ff088a0310b4f911b4f9eA11e2E9740"
    const contract = new ethers.Contract(contractAddress, contractAbi, signer)

    const amount = 100

    const minAmounts = 10

    const time = Math.floor(Date.now() / 1000) + 200000
    const deadline = ethers.BigNumber.from(time)

    // Call the function on the contract instance
    contract.removeLiquidity(amount, minAmounts, deadline)
      .then((balance) => console.log(`success`))
      .catch(error => console.log(error))
  }

  if (props.showRebalanceModal) {
    return (
      <div className="styles.root">
        <Card className="styles.card">
          <RebalanceModalHeader headerTitle="Rebalance staked position" />
          <p>{addressString}</p>
          <button onClick={() => unstakePosition(provider)}>Unstake Arbitrum position</button>
          <button onClick={() => withdrawPosition(provider)}>Withdraw Arbitrum position</button>
          <button onClick={() => props.setShowRebalanceModal(false)}>Close</button>
          <RebalanceModalFooter />
        </Card>
      </div>
    )
  } else {
    return <></>
  }
}
