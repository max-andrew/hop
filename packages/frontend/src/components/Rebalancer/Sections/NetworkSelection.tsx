import React from 'react'

import { findNetworkBySlug } from 'src/utils'
import { networkIdToSlug } from 'src/utils/networks'
import Network from 'src/models/Network'

import { Grid, Box, Divider, Typography } from '@material-ui/core'
import Button from 'src/components/buttons/Button'
import { RaisedNetworkSelector } from 'src/components/NetworkSelector/RaisedNetworkSelector'

type NetworkAPRTupleType = [string, number, string]

interface NetworkSelectionSectionProps {
  networksWithYields: NetworkAPRTupleType[],
  chainSlug: string,
  destinationNetworkId: number,
  setDestinationNetwork: (chainSlug: string) => void
  goToNextSection: () => void
}

export function NetworkSelectionSection(props: NetworkSelectionSectionProps) {
  const networks = props.networksWithYields
  const chainSlug = props.chainSlug
  const destinationNetworkId = props.destinationNetworkId
  const goToNextSection = props.goToNextSection

  // exclude the source network
  const potentialDestinationNetworkObjects = networks.reduce((acc: Network[], network) => {
    const foundNetwork = findNetworkBySlug(network[0])
    if (foundNetwork && network[0] !== chainSlug) {
      acc.push(foundNetwork)
    }
    return acc
  }, [])

  return (
    <>
      <Typography variant="h4" color="textPrimary">Select destination</Typography>
      <Typography variant="subtitle2" color="textSecondary">Choose the network to transfer your position to</Typography>
      <br />
      <br />
      
      <Grid container alignItems="center">
        <Grid item xs>
          <Box display="flex" alignItems="center" justifyContent="center">
            <RaisedNetworkSelector 
              selectedNetwork={findNetworkBySlug(networkIdToSlug(destinationNetworkId))} 
              onSelect={e => props.setDestinationNetwork(e.target.value)} 
              availableNetworks={potentialDestinationNetworkObjects} 
              />
          </Box>
        </Grid>
        <Divider orientation="vertical" flexItem />
        <Grid item xs>
          <Box display="flex" flexDirection="column" alignItems="center">
            {networks.map((tuple: NetworkAPRTupleType, index: number) => (
                <Box key={index} my={1}>
                  <Typography variant="body1" color="textSecondary" align="right">{tuple[0]}</Typography>
                  <Typography variant="h3">{tuple[2]}</Typography>
                </Box>
            ))}
          </Box>
        </Grid>
      </Grid>

      <br />
      <br />
      <Box textAlign="center">
        <Button fullWidth large highlighted onClick={goToNextSection}>Select Network</Button>
      </Box>
    </>
  )
}
