import React, { useState, useEffect, ChangeEvent } from 'react'
import { findNetworkBySlug } from 'src/utils'
import { networkIdToSlug } from 'src/utils/networks'
import Network from 'src/models/Network'
import useAvailableLiquidity from 'src/pages/Send/useAvailableLiquidity'
import { HopBridge } from '@hop-protocol/sdk'
import { SelectProps } from '@material-ui/core/Select'
import { Grid, Box, Divider, Typography } from '@material-ui/core'
import Button from 'src/components/buttons/Button'
import { RaisedNetworkSelector } from 'src/components/NetworkSelector/RaisedNetworkSelector'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'

type NetworkAPRTupleType = [string, number, string]

interface NetworkSelectionSectionProps {
  checkConnectedNetworkId: (networkId: number) => Promise<boolean>
  networksMatch: boolean
  sortedChainsWithAPRData: NetworkAPRTupleType[]
  connectedNetworkId: number | undefined
  networkSlugToId: (networkSlug: string) => number
  chainSlug: string
  setBridgedFromNetworkId: (bridgedFromNetworkId: number) => void
  destinationNetworkId: number
  setDestinationNetwork: (chainSlug: string) => void
  selectedBridge: HopBridge
  goToNextSection: () => void
}

export function NetworkSelectionSection(props: NetworkSelectionSectionProps) {
  const checkConnectedNetworkId = props.checkConnectedNetworkId
  const networksMatch = props.networksMatch
  const networks = props.sortedChainsWithAPRData
  const connectedNetworkId = props.connectedNetworkId
  const networkSlugToId = props.networkSlugToId
  const chainSlug = props.chainSlug
  const setBridgedFromNetworkId = props.setBridgedFromNetworkId
  const destinationNetworkId = props.destinationNetworkId
  const selectedBridge = props.selectedBridge
  const goToNextSection = props.goToNextSection

  // get a list of networks without available liquidity
  const networkSlugsWithoutLiquidity: string[] = [""]
  networks.forEach(network => {
    const { availableLiquidity } = useAvailableLiquidity(selectedBridge, chainSlug, network[0])
    if (availableLiquidity?.isZero()) {
      networkSlugsWithoutLiquidity.push(network[0])
    }
  })
  
  // exclude networks with 0 APR
  const positiveAPRNetworks =  networks.reduce((acc: NetworkAPRTupleType[], network) => {
    if (network && network[1] > 0) {
      acc.push(network)
    }
    return acc
  }, [])

  // exclude the source network and those without liquidity from the list of networks with positive APR
  const selectableNetworks = positiveAPRNetworks.reduce((acc: NetworkAPRTupleType[], network) => {
    if (network && network[0] !== chainSlug && !networkSlugsWithoutLiquidity.includes(network[0])) {
      acc.push(network)
    }
    return acc
  }, [])

  // convert the selectable network list to Network objects
  const selectableNetworkObjects: Network[] = []
  selectableNetworks.forEach(network => {
    const foundNetwork = findNetworkBySlug(network[0])
    if (typeof foundNetwork !== "undefined") {
      selectableNetworkObjects.push(foundNetwork)
    }
  })

  return (
    <>
      <SectionHeader title="Select destination" subtitle="Choose the network to transfer your position to" />
      <Grid container alignItems="center">
        <Grid item xs>
          <Box display="flex" alignItems="center" justifyContent="center" mr={1}>
            <RaisedNetworkSelector 
              selectedNetwork={findNetworkBySlug(networkIdToSlug(destinationNetworkId))}
              onSelect={(e: ChangeEvent<SelectProps>) => props.setDestinationNetwork(e.target.value as string)}
              availableNetworks={selectableNetworkObjects}
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
                  <Typography variant="h3" color={networkSlugsWithoutLiquidity.includes(tuple[0]) ? "textSecondary" : undefined} align="right">{tuple[2]}</Typography>
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
