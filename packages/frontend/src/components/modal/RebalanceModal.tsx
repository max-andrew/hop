import React, { useState } from 'react'
import Modal from 'src/components/modal/Modal'
import Divider from '@material-ui/core/Divider'
import { Text } from 'src/components/ui/Text'
import Card from '@material-ui/core/Card'
import { makeStyles, Theme } from '@material-ui/core/styles'
import { isDarkMode } from 'src/theme/theme'

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    position: 'fixed',
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
  close: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: '2rem',
    display: 'inline-block',
    color: isDarkMode(theme) ? 'white' : '#000',
    opacity: 0.4,
    fontSize: '2rem',
    fontWeight: 'bold',
    zIndex: 1,
    '&:hover': {
      color: '#000',
      opacity: 0.6,
      cursor: 'pointer',
    },
  },
  container: {
    position: 'fixed',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '100%',
    height: 'auto',
    overflow: 'auto',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    transition: 'all 0.15s ease-out',
    padding: '5rem',
    '&.entering': {
      opacity: 0,
      transform: 'translate(-50%, -50%) scale(0.8)',
    },
    '&.entered': {
      opacity: 1,
      transform: 'translate(-50%, -50%) scale(1)',
    },
    '&.exiting': {
      opacity: 0,
      transform: 'translate(-50%, -50%) scale(0.6)',
    },
    '&.exited': {
      opacity: 0,
      transform: 'translate(-50%, -50%) scale(0)',
    },
    '& img': {
      maxWidth: '100%'
    },
    [theme.breakpoints.down('xs')]: {
      maxWidth: '90%',
    },
  },
  card: {
    position: 'relative',
    padding: 0,
    overflow: 'auto',
    maxHeight: '100%',
    border: isDarkMode(theme) ? '1px solid #353535' : 'none',
    boxShadow: isDarkMode(theme) ? 'none' : theme.boxShadow.card,
  },
  content: {
    padding: '4rem',
    [theme.breakpoints.down('xs')]: {
      padding: '4rem 2rem',
    },
  },
}))

export function RebalanceModal(props) {
  const styles = useStyles()

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

  if (props.showRebalanceModal) {
    return (
      <Card className={styles.card}>
        <RebalanceModalHeader headerTitle="Rebalance staked position" />
        <p>Hello</p>
        <button onClick={() => props.setShowRebalanceModal(false)}>Close</button>
        <RebalanceModalFooter />
      </Card>
    )
  } else {
    return <></>
  }
}
