import React, { useState, useEffect, ChangeEvent } from 'react'
import { findNetworkBySlug, getTokenImage } from 'src/utils'
import { networkIdToSlug } from 'src/utils/networks'
import { useStaking } from 'src/pages/Pools/useStaking'
import { stakingRewardsContracts, stakingRewardTokens, hopStakingRewardsContracts } from 'src/config'
import useAvailableLiquidity from 'src/pages/Send/useAvailableLiquidity'
import Network from 'src/models/Network'
import { HopBridge } from '@hop-protocol/sdk'
import { useStyles } from 'src/pages/Pools/PoolDetails/useStyles'
import { SelectProps } from '@material-ui/core/Select'
import { Grid, Box, Divider, Typography } from '@material-ui/core'
import Button from 'src/components/buttons/Button'
import { RaisedNetworkSelector } from 'src/components/NetworkSelector/RaisedNetworkSelector'
import { SectionHeader } from 'src/components/Rebalancer/Sections/Subsections/Header'

type NetworkAPRTupleType = [string, number, number]

interface NetworkSelectionSectionProps {
  reactAppNetwork: string
  checkConnectedNetworkId: (networkId: number) => Promise<boolean>
  networksMatch: boolean
  sortedChainsWithAPRData: NetworkAPRTupleType[]
  connectedNetworkId: number | undefined
  networkSlugToId: (networkSlug: string) => number
  chainSlug: string
  tokenSymbol: string
  setBridgedFromNetworkId: (bridgedFromNetworkId: number) => void
  destinationNetworkId: number
  setDestinationNetwork: (chainSlug: string) => void
  selectedBridge: HopBridge
  selectedRewardTokenSymbol: string
  setSelectedRewardTokenSymbol: (selectedRewardTokenSymbol: string) => void
  defaultRewardTokenSymbol: string
  goToNextSection: () => void
}

export function NetworkSelectionSection(props: NetworkSelectionSectionProps) {
  const {
    reactAppNetwork,
    checkConnectedNetworkId, 
    networksMatch,
    sortedChainsWithAPRData,
    connectedNetworkId,
    networkSlugToId,
    chainSlug,
    tokenSymbol,
    setBridgedFromNetworkId,
    destinationNetworkId,
    setDestinationNetwork,
    selectedBridge,
    selectedRewardTokenSymbol,
    setSelectedRewardTokenSymbol,
    defaultRewardTokenSymbol,
    goToNextSection
  } = props
  const styles = useStyles()

  // metadata for each reward token available for the current staked token across all available networks
  const allNetworksStakingRewardTokenMetaData: { [rewardTokenSymbol: string]: { stakingContractAddress: string, rewardTokenImageUrl: string, chainSlug: string } } = {}
  // staking apr for networks with multiple reward tokens to update the displayed apr with token selection
  const stakingAprData: { [networkSlug: string]: number[] } = {}
  // networks with multiple rewards tokens and a list of their symbols
  const networksWithMultipleRewardTokens: { [networkSlug: string]: string[] } = {}
  
  // for each available network
  for (const chain of sortedChainsWithAPRData) {
    // for each of the potential destination network contracts see
    // if there is a contract address for both HOP and/or an alternate reward token
    const hopStakingContractAddress = hopStakingRewardsContracts?.[reactAppNetwork]?.[chain[0]]?.[tokenSymbol]
    if (hopStakingContractAddress) {
      allNetworksStakingRewardTokenMetaData.HOP = {
        stakingContractAddress: hopStakingContractAddress, 
        rewardTokenImageUrl: getTokenImage("HOP"), 
        chainSlug: chain[0]
      }
    }

    let rewardTokenSymbol
    const stakingContractAddress = stakingRewardsContracts?.[reactAppNetwork]?.[chain[0]]?.[tokenSymbol]
    if (stakingContractAddress) {
      rewardTokenSymbol = stakingRewardTokens?.[reactAppNetwork]?.[chain[0]]?.[stakingContractAddress?.toLowerCase()] ?? ''
      allNetworksStakingRewardTokenMetaData[rewardTokenSymbol] = {
        stakingContractAddress, 
        rewardTokenImageUrl: rewardTokenSymbol ? getTokenImage(rewardTokenSymbol) : "", 
        chainSlug: chain[0] 
      }
    }

    if (typeof hopStakingContractAddress !== "undefined" && typeof stakingContractAddress !== "undefined") {
      // ensure the rewards tokens have positive staking APR
      const { stakingApr: hopStakingApr } = useStaking(chain[0], tokenSymbol, hopStakingContractAddress)
      const { stakingApr: altStakingApr } = useStaking(chain[0], tokenSymbol, stakingContractAddress)

      stakingAprData[chain[0]] = [hopStakingApr, altStakingApr]

      if (hopStakingApr > 0 && altStakingApr > 0) {
        networksWithMultipleRewardTokens[chain[0]] = ["HOP", rewardTokenSymbol]
      }
    }
  }

  // get a list of networks without available liquidity
  const networkSlugsWithoutLiquidity: string[] = []
  sortedChainsWithAPRData.forEach(network => {
    const { availableLiquidity } = useAvailableLiquidity(selectedBridge, chainSlug, network[0])
    if (availableLiquidity?.isZero()) {
      networkSlugsWithoutLiquidity.push(network[0])
    }
  })
  
  // exclude networks with 0 APR
  const positiveAPRNetworks = sortedChainsWithAPRData.reduce((acc: NetworkAPRTupleType[], network) => {
    if (network && network[1] > 0) {
      acc.push(network)
    }
    return acc
  }, [])

  // sorted networks with total APR value updated for the selected reward token in order of descending updated APR
  const positiveAPRNetworksByRewardToken = positiveAPRNetworks

  // if the selected destination network has multiple rewards tokens
  if (Object.keys(networksWithMultipleRewardTokens).includes(networkIdToSlug(destinationNetworkId))) {
    // get the index of the given network
    let networkIndex
    positiveAPRNetworksByRewardToken.forEach((network, index) => {
      if (network[0] === networkIdToSlug(destinationNetworkId)) {
        networkIndex = index
      }
    })

    const network = positiveAPRNetworksByRewardToken[networkIndex]

    // get selected token index
    const selectedRewardTokenIndex = selectedRewardTokenSymbol === "HOP" ? 0 : 1

    // get the staking APR for the given network and selected reward token
    const stakingApr = stakingAprData[network[0]][selectedRewardTokenIndex]

    // update the total APR value to be the pool APR + the staking APR
    network[1] = network[2] + stakingApr

    // and sort the array based on those new values
    positiveAPRNetworksByRewardToken.sort((a, b) => b[1] - a[1])
  }

  // reset the selected reward token on destination network change
  useEffect(() => {
    setSelectedRewardTokenSymbol(defaultRewardTokenSymbol)
  }, [destinationNetworkId])

  // exclude mainnet, the source network, and those without liquidity from the list of networks with positive APR
  const selectableNetworks = positiveAPRNetworksByRewardToken.reduce((acc: NetworkAPRTupleType[], network) => {
    if (network && network[0] !== "ethereum" && network[0] !== chainSlug && !networkSlugsWithoutLiquidity.includes(network[0])) {
      acc.push(network)
    }
    return acc
  }, [])

  // set default to highest APR selectable network
  useEffect(() => {
    if (typeof selectableNetworks?.[0]?.[0] !== "undefined") {
      setDestinationNetwork(selectableNetworks[0][0])
    }
  }, [])

  // convert the selectable network list to Network objects
  const selectableNetworkObjects: Network[] = []
  selectableNetworks.forEach(network => {
    const foundNetwork = findNetworkBySlug(network[0])
    if (typeof foundNetwork !== "undefined") {
      selectableNetworkObjects.push(foundNetwork)
    }
  })

  function formatDecimalToPercentage(decimal: number): string {
    const formattedNumber = (decimal * 100).toFixed(2)
    const formattedPercentage = formattedNumber + "%"

    return formattedPercentage
  }

  return (
    <>
      <SectionHeader title="Select destination" subtitle={`Choose the network to transfer your position to`} />
      <Grid container alignItems="center">
        <Grid item xs>
          <Box display="flex" alignItems="center" justifyContent="center" mr={1}>
            { selectableNetworkObjects.length > 0
              ? <RaisedNetworkSelector 
                selectedNetwork={findNetworkBySlug(networkIdToSlug(destinationNetworkId))}
                onSelect={(e: ChangeEvent<SelectProps>) => setDestinationNetwork(e.target.value as string)}
                availableNetworks={selectableNetworkObjects}
                />
              : <Typography variant="body1" color="textSecondary" align="right">No available networks</Typography>
            }
          </Box>
          { Object.keys(networksWithMultipleRewardTokens).includes(networkIdToSlug(destinationNetworkId)) &&
            <Box textAlign="center" mr={1}>
              <br />
              <br />
              <Typography variant="overline" color="textSecondary">Staking rewards in:</Typography>
              <br />
              <br />
              <Grid container alignItems="center">
                {networksWithMultipleRewardTokens[networkIdToSlug(destinationNetworkId)].map((rewardTokenSymbol) => {
                  return ( 
                    <Grid item xs>
                      <Box 
                        onClick={() => setSelectedRewardTokenSymbol(rewardTokenSymbol)}
                        style={{
                          paddingLeft: '1rem',
                          paddingBottom: '1rem',
                          transition: 'translate(0, 5px)'
                        }}
                        >
                        <Box display="flex" alignItems="center" data-selected={selectedRewardTokenSymbol === rewardTokenSymbol} className={styles.stakingTabButtonBox}>
                          <Box mr={0.5} display="flex" justifyItems="center" alignItems="center">
                            <img 
                              className={styles.stakingTabImage} 
                              src={allNetworksStakingRewardTokenMetaData[rewardTokenSymbol].rewardTokenImageUrl} 
                              title={rewardTokenSymbol} 
                              alt={rewardTokenSymbol}
                              />
                          </Box>
                          <Typography variant="body2">
                            {rewardTokenSymbol}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid> 
                  )
                })}
              </Grid>
            </Box>
          }
        </Grid>
        <Divider orientation="vertical" flexItem />
        <Grid item xs>
          <Box display="flex" flexDirection="column" alignItems="center">
            <Box>
              {positiveAPRNetworks.map((tuple: NetworkAPRTupleType, index: number) => (
                <Box key={index} my={2}>
                  <Typography variant="body1" color="textSecondary" align="right">{tuple[0]}</Typography>
                  <Typography 
                    variant="h3" 
                    color={networkSlugsWithoutLiquidity.includes(tuple[0]) || chainSlug === tuple[0] ? "textSecondary" : undefined} 
                    align="right"
                    >
                    {
                      /*Object.keys(networksWithMultipleRewardTokens).includes(tuple[0]) 
                      ? formatDecimalToPercentage(stakingAprData[tuple[0]][selectedRewardTokenSymbol === "HOP" ? 0 : 1] + positiveAPRNetworks[index][2])
                      : */

                      formatDecimalToPercentage(tuple[1])
                    }
                  </Typography>
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
