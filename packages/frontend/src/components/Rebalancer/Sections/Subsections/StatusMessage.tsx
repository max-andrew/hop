import React from 'react'
import { Box, Typography } from '@material-ui/core'

export function StatusMessage(props) {
  const message: string = props.message

  return (
    <Box textAlign="center" mt={1}>
      {
        (message.length > 0)
        ? <Typography variant="overline" style={{ minHeight: '100%' }} >{ message }</Typography>
        : <br />
      }
    </Box>
  )
}
