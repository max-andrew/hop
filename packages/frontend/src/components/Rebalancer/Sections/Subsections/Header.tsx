import React from 'react'
import { Typography } from '@material-ui/core'

export function SectionHeader(props) {
  return (
    <>
      <Typography variant="h4" color="textPrimary">{ props.title }</Typography>
      <Typography variant="subtitle2" color="textSecondary">{ props.subtitle }</Typography>
      <br />
      <br />
    </>
  )
}
