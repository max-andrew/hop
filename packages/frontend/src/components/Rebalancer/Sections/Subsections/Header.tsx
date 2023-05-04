import React from 'react'
import { Typography } from '@material-ui/core'

interface SectionHeaderProps {
  title: string
  subtitle: string
}

export function SectionHeader(props: SectionHeaderProps) {
  return (
    <>
      <Typography variant="h4" color="textPrimary">{ props.title }</Typography>
      <Typography variant="subtitle2" color="textSecondary">{ props.subtitle }</Typography>
      <br />
      <br />
    </>
  )
}
