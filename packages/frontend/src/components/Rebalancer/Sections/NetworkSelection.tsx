import React, { useState, useEffect } from 'react'

import { findNetworkBySlug } from 'src/utils'
import { networkIdToSlug, networkSlugToId } from 'src/utils/networks'
import Network from 'src/models/Network'

import { Grid, Box, Divider, Typography } from '@material-ui/core'
import Button from 'src/components/buttons/Button'
import { RaisedNetworkSelector } from 'src/components/NetworkSelector/RaisedNetworkSelector'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'

type NetworkAPRTupleType = [string, number, string]

interface NetworkSelectionSectionProps {
  checkConnectedNetworkId: (networkId: number) => Promise<boolean>
  networksWithYields: NetworkAPRTupleType[],
  connectedNetworkId: number | undefined,
  chainSlug: string,
  destinationNetworkId: number,
  setDestinationNetwork: (chainSlug: string) => void
  goToNextSection: () => void
}

export function NetworkSelectionSection(props: NetworkSelectionSectionProps) {
  const checkConnectedNetworkId = props.checkConnectedNetworkId
  const networks = props.networksWithYields
  const connectedNetworkId = props.connectedNetworkId
  const chainSlug = props.chainSlug
  const destinationNetworkId = props.destinationNetworkId
  const goToNextSection = props.goToNextSection

  const [networksMatch, setNetworksMatch] = useState<boolean>(false)

  // listen for the right chain connection
  useEffect(() => {
    if (connectedNetworkId === networkSlugToId(chainSlug)) {
      setNetworksMatch(true)
    } else {
      setNetworksMatch(false)
    }
  }, [connectedNetworkId])

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
      <SectionHeader title="Select destination" subtitle="Choose the network to transfer your position to" />
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
      <Button 
        fullWidth 
        large 
        highlighted
        disabled={networksMatch && destinationNetworkId === 0}
        onClick={() => {
          if (networksMatch) {
            goToNextSection()
          } else {
            connectedNetworkId && checkConnectedNetworkId(networkSlugToId(chainSlug))
          }
        }}>
        { networksMatch ? "Select Network" : "Switch Networks" }
      </Button>
    </>
  )
}
