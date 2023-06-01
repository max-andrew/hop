import React, { useState, useEffect, ChangeEvent } from 'react'
import { findNetworkBySlug } from 'src/utils'
import { networkIdToSlug, networkSlugToId } from 'src/utils/networks'
import Network from 'src/models/Network'
import { SelectProps } from '@material-ui/core/Select'
import { Grid, Box, Divider, Typography } from '@material-ui/core'
import Button from 'src/components/buttons/Button'
import { RaisedNetworkSelector } from 'src/components/NetworkSelector/RaisedNetworkSelector'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'

type NetworkAPRTupleType = [string, number, string]

interface NetworkSelectionSectionProps {
  checkConnectedNetworkId: (networkId: number) => Promise<boolean>
  sortedChainsWithAPRData: NetworkAPRTupleType[],
  connectedNetworkId: number | undefined,
  chainSlug: string,
  setBridgedFromNetworkId: (bridgedFromNetworkId: number) => void
  destinationNetworkId: number,
  setDestinationNetwork: (chainSlug: string) => void
  goToNextSection: () => void
}

export function NetworkSelectionSection(props: NetworkSelectionSectionProps) {
  const checkConnectedNetworkId = props.checkConnectedNetworkId
  const networks = props.sortedChainsWithAPRData
  const connectedNetworkId = props.connectedNetworkId
  const chainSlug = props.chainSlug
  const setBridgedFromNetworkId = props.setBridgedFromNetworkId
  const destinationNetworkId = props.destinationNetworkId
  const goToNextSection = props.goToNextSection

  const [networksMatch, setNetworksMatch] = useState<boolean>(false)

  // listen for the right chain connection
  useEffect(() => {
    if (connectedNetworkId && +connectedNetworkId === +networkSlugToId(chainSlug)) {
      console.log("Networks", +connectedNetworkId, "and", +networkSlugToId(chainSlug), "match")
      setNetworksMatch(true)
      setBridgedFromNetworkId(connectedNetworkId)
    } else {
      setNetworksMatch(false)
    }
  }, [connectedNetworkId])

  // exclude networks with 0 APR
  const positiveAPRNetworks =  networks.reduce((acc: NetworkAPRTupleType[], network) => {
    if (network && network[1] > 0) {
      acc.push(network)
    }
    return acc
  }, [])

  // exclude the source network
  const potentialDestinationNetworkObjects = positiveAPRNetworks.reduce((acc: Network[], network) => {
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
              onSelect={(e: ChangeEvent<SelectProps>) => props.setDestinationNetwork(e.target.value as string)}
              availableNetworks={potentialDestinationNetworkObjects}
              />
          </Box>
        </Grid>
        <Divider orientation="vertical" flexItem />
        <Grid item xs>
          <Box display="flex" flexDirection="column" alignItems="center">
            <Box>
              {positiveAPRNetworks.map((tuple: NetworkAPRTupleType, index: number) => (
                <Box key={index} my={2}>
                  <Typography variant="body1" color="textSecondary" align="right">{tuple[0]}</Typography>
                  <Typography variant="h3" align="right">{tuple[2]}</Typography>
                </Box>
              ))}
            </Box>
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
          networksMatch ? goToNextSection() : connectedNetworkId && checkConnectedNetworkId(networkSlugToId(chainSlug))
        }}>
        { networksMatch ? "Select Network" : "Switch Networks" }
      </Button>
    </>
  )
}
