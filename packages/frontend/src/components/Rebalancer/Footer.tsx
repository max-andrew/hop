import React from 'react'
import { Box, Divider, Typography } from '@material-ui/core'

export function Footer(props) {
  const currentStep = props.currentStep
  const totalSteps = props.totalSteps

  return currentStep !== 0 
  ? <Box textAlign="center" mt={3}>
      <Divider />
      <br />
      <Typography variant="body2" component="span" color="secondary">{Math.round((currentStep / totalSteps) * 100)}%</Typography>
    </Box>
  : <></>
}
