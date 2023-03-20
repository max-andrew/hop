import React from 'react'
import Modal from 'src/components/modal/Modal'
import Divider from '@material-ui/core/Divider'
import { Text } from 'src/components/ui/Text'
import Typography from '@material-ui/core/Typography'

export function RebalanceModal(props) {
  const isRebalancing = true

  function TransactionModalHeader(props) {
    const headerTitle = props.headerTitle
    let headerTitleJSX = <></>

    if (typeof headerTitle !== "undefined") {
      headerTitleJSX = (
        <>
          <br />
          <Text mono style={{ fontSize: 12, marginBottom: 12, textTransform: "uppercase" }}>{headerTitle}</Text>
        </>
      )
    }

    const currentStep = 1
    const totalSteps = 5

    return (
      <>
        <span style={{ textAlign: "center" }}>
          {headerTitleJSX}
          <Typography variant="h6" color="textSecondary">Step {currentStep}/{totalSteps}</Typography>
          <br />
        </span>
        <Divider />
        <br />
      </>
    )
  }

  return (
    <Modal>
      { isRebalancing && <TransactionModalHeader headerTitle="Rebalancing staked position" /> }
      <p>Hello</p>
    </Modal>
  )
}
