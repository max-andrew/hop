import React, { ChangeEvent } from 'react'
import Box from '@material-ui/core/Box'
import ErrorIcon from '@material-ui/icons/ErrorOutline'
import ShowChartRoundedIcon from '@material-ui/icons/ShowChartRounded'
import InfoTooltip from 'src/components/InfoTooltip'
import Typography from '@material-ui/core/Typography'
import { useStyles } from './useStyles'

type Props = {
  aprFormatted: string
  goToTab: any
  showStakeMessage: boolean
  totalAprFormatted: string
  tvlFormatted: string
  volume24hFormatted: string
  setShowRebalancerModal: (showRebalancerModal: boolean) => void
  hideHigherAPRAlert: boolean
}

export function TopPoolStats (props: Props) {
  const styles = useStyles()
  const {
    aprFormatted,
    goToTab,
    showStakeMessage,
    totalAprFormatted,
    tvlFormatted,
    volume24hFormatted,
    setShowRebalancerModal,
  } = props

  function handleStakeClick (event: ChangeEvent<{}>) {
    event.preventDefault()
    goToTab('stake')
  }

  function handleRebalanceClick (event: ChangeEvent<{}>) {
    event.preventDefault()
    props.setShowRebalancerModal(true)
  }

  return (
      <Box mb={4} p={1} display="flex" justifyContent="space-between" className={styles.topBoxes}>
        <Box mr={1} p={2} display="flex" flexDirection="column" className={styles.topBox}>
          <Box mb={2}>
            <Typography variant="subtitle1" color="secondary" component="div">
              <Box display="flex" alignItems="center" component="div">
                TVL <InfoTooltip title="Total value locked in USD" />
              </Box>
            </Typography>
          </Box>
          <Typography variant="h5">
            {tvlFormatted}
          </Typography>
        </Box>
        <Box ml={1} mr={1} p={2} display="flex" flexDirection="column" className={styles.topBox}>
          <Box mb={2}>
            <Typography variant="subtitle1" color="secondary" component="div">
              <Box display="flex" alignItems="center" component="div">
                24hr Volume <InfoTooltip title="Total volume in AMM in last 24 hours" />
              </Box>
            </Typography>
          </Box>
          <Typography variant="h5">
            {volume24hFormatted}
          </Typography>
        </Box>
        <Box ml={1} mr={1} p={2} display="flex" justifyContent="space-between" className={styles.topBox}>
          <Box display="flex" flexDirection="column">
            <Box mb={2}>
              <Typography variant="subtitle1" color="secondary" component="div">
                <Box display="flex" alignItems="center" component="div">
                  Total APR <InfoTooltip title={`Annual Percentage Rate (APR) from earning fees (${aprFormatted}) and staking LP tokens, based on 24hr trading volume`} />
                </Box>
              </Typography>
            </Box>
            <Typography variant="h5">
              {totalAprFormatted}
            </Typography>
          </Box>
          {showStakeMessage && (
            <Box ml={2} p={1.5} className={styles.notStakedMessage} display="flex" flexDirection="column" justifyContent="center" onClick={handleStakeClick}>
              <Box mb={1}>
                <Typography variant="body2" component="div">
                  <Box display="flex" justifyContent="center" alignItems="center" className={styles.notStakedMessageColor}>
                    <Box mr={0.5} display="flex" justifyContent="center" alignItems="center">
                      <ErrorIcon className={styles.notStakedMessageColor} style={{ fontSize: '2.5rem' }}/>
                    </Box>
                    <strong>Not staked</strong>
                  </Box>
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" component="div">
                  <strong>Stake below to earn rewards</strong>
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
        { !props.hideHigherAPRAlert &&
          <Box ml={1} p={2} display="flex" flexDirection="column" className={styles.topBox + " " + styles.topBoxButton} onClick={handleRebalanceClick}>
            <Box mb={2}>
              <Box display="inline">
                <Typography display="inline" variant="subtitle1" className={styles.notStakedMessageColor} style={{ verticalAlign: 'middle' }}>Get higher APR&nbsp;</Typography>
                <ShowChartRoundedIcon className={styles.notStakedMessageColor} style={{ fontSize: '2.25rem', verticalAlign: 'middle' }}/>
              </Box>
            </Box>
            <Typography variant="body1">
              <strong>Move your position to a higher yield network</strong>
            </Typography>
          </Box>
        }
{/*     <Box ml={1} mr={1} p={2} display="flex" flexDirection="column" className={styles.topBox}>
          <Box mb={2}>
            <Typography variant="subtitle1" color="secondary" component="div">
              <Box display="flex" alignItems="center" component="div">
                24hr Volume <InfoTooltip title="Total volume in AMM in last 24 hours" />
              </Box>
            </Typography>
          </Box>
          <Typography variant="h5">
            {volume24hFormatted}
          </Typography>
        </Box>*/}
      </Box>
  )
}
