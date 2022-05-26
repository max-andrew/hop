import React, { useCallback, useEffect, useState } from 'react'
import { CanonicalToken, ChainId, Hop, NetworkSlug, Token } from '@hop-protocol/sdk'
import Network from 'src/models/Network'
import { BigNumber, constants } from 'ethers'
import { useWeb3Context } from 'src/contexts/Web3Context'
import logger from 'src/logger'
import { formatError, toTokenDisplay } from 'src/utils'
import { CanonicalBridge } from './canonicalBridge/CanonicalBridge'
import { l1Network } from 'src/config/networks'
import { TxConfirm } from 'src/contexts/AppContext/useTxConfirm'
import { useQuery } from 'react-query'
import { useTransactionReplacement } from 'src/hooks'
import Transaction from 'src/models/Transaction'
import { createTransaction } from 'src/utils/createTransaction'
import { TransactionHandled } from './useSendTransaction'

interface EstimateTxOptions {
  token: Token
  network?:Network
  sourceChain?: Network
  destinationChain?: Network
  deadline?: () => number
  checkAllowance?: boolean
}
interface L1CanonicalBridgeProps {
  sdk?: Hop
  sourceToken?: Token
  sourceTokenAmount?: BigNumber
  sourceChain?: Network
  destinationChain?: Network
  estimatedReceived?: BigNumber
  txConfirm?: TxConfirm
  customRecipient?: string
  setSending?: any
  setTx?: any
  approving?: boolean
  setApproving?: any
  setError?: any
}

export function useL1CanonicalBridge(props: L1CanonicalBridgeProps) {
  const {
    sdk,
    sourceToken,
    sourceTokenAmount,
    sourceChain,
    destinationChain,
    estimatedReceived,
    txConfirm,
    customRecipient,
    approving,
    setApproving,
    setSending,
    setTx,
    setError,
  } = props

  const { checkConnectedNetworkId, provider } = useWeb3Context()
  const [l1CanonicalBridge, setL1CanonicalBridge] = useState<CanonicalBridge | undefined>()
  const [usingNativeBridge, setUsingNativeBridge] = useState(false)
  const [userSpecifiedBridge, setUserSpecifiedBridge] = useState(false)

  const { waitForTransaction, addTransaction, updateTransaction } = useTransactionReplacement()

  function selectNativeBridge(val: boolean) {
    setUsingNativeBridge(val)
    setUserSpecifiedBridge(true)
  }

  function handleTransaction(tx: any, fromNetwork: any, toNetwork: any, sourceToken: any): TransactionHandled {
    const txModel = createTransaction(tx, fromNetwork, toNetwork, sourceToken)
    addTransaction(txModel)

    return {
      transaction: tx,
      txModel,
    }
  }

  const { data: needsNativeBridgeApproval } = useQuery(
    [
      `needsNativeBridgeApproval:${l1CanonicalBridge?.address}:${sourceTokenAmount?.toString()}`,
      l1CanonicalBridge?.address,
      sourceTokenAmount?.toString(),
      usingNativeBridge,
    ],
    async () => {
      if (!(l1CanonicalBridge && sourceTokenAmount)) {
        return
      }

      if (sourceChain?.isL1 && sourceToken?.symbol === CanonicalToken.ETH) {
        return false
      }

      // if (sourceChain?.isL1 && destinationChain?.chainId === ChainId.Gnosis && sourceToken?.symbol === CanonicalToken.DAI) {
      //   return false
      // }

      const allowance = await l1CanonicalBridge.getL1CanonicalAllowance()
      return allowance?.lt(sourceTokenAmount)
    },
    {
      enabled:
        usingNativeBridge !== false &&
        !!l1CanonicalBridge?.address &&
        !!sourceTokenAmount?.toString() &&
        !!sourceChain &&
        !!sourceToken,
      refetchInterval: 10e3,
    }
  )

  // ====================================================================
  // Set using native bridge
  // ====================================================================

  useEffect(() => {
    if (userSpecifiedBridge) return

    if (sourceTokenAmount && estimatedReceived && l1CanonicalBridge) {
      if (usingNativeBridge === false && sourceTokenAmount.gt(estimatedReceived)) {
        return setUsingNativeBridge(true)
      } else if (sourceTokenAmount.lte(estimatedReceived)) {
        return setUsingNativeBridge(false)
      }
    }
  }, [
    userSpecifiedBridge,
    sourceTokenAmount?.toString(),
    estimatedReceived?.toString(),
    l1CanonicalBridge,
    destinationChain,
  ])

  // ====================================================================
  // Set native bridge
  // ====================================================================

  useEffect(() => {
    const update = async () => {
      if (!(sourceToken && destinationChain)) {
        return setL1CanonicalBridge(undefined)
      }

      if (sourceToken.chain.chainId !== ChainId.Ethereum) {
        return setL1CanonicalBridge(undefined)
      }

      const signer = provider?.getSigner()
      if (signer) {
        const canonicalBridge = await CanonicalBridge.from(
          NetworkSlug.Mainnet,
          sourceToken.symbol,
          destinationChain.slug,
          signer,
        )
        return setL1CanonicalBridge(canonicalBridge)
      }

      setL1CanonicalBridge(undefined)
    }

    update().catch(console.error)
  }, [provider, sourceToken, destinationChain, CanonicalBridge])

  // ====================================================================
  // Approve native bridge
  // ====================================================================

  const approveNativeBridge = useCallback(async () => {
    if (sourceToken?.symbol === CanonicalToken.ETH) {
      throw new Error('ETH approval not necessary')
    }
    if (!usingNativeBridge) {
      throw new Error('Must be using Native Bridge')
    }
    if (!sourceChain) {
      throw new Error('sourceChain required')
    }
    if (!sourceToken || !destinationChain) {
      throw new Error('sourceToken and destinationChain required')
    }
    if (!l1CanonicalBridge) {
      throw new Error('l1CanonicalBridge required')
    }

    const isNetworkConnected = await checkConnectedNetworkId(sourceChain.chainId)
    if (!isNetworkConnected) return

    const displayedAmount = toTokenDisplay(sourceTokenAmount, sourceToken.decimals)
    const spender = l1CanonicalBridge.getL1CanonicalBridgeApproveAddress()

    try {
      const tx: any = await txConfirm?.show({
        kind: 'approval',
        inputProps: {
          tagline: `Allow ${destinationChain.name}'s native bridge to spend your ${sourceToken?.symbol} on ${sourceChain.name}`,
          amount: displayedAmount,
          token: sourceToken,
          tokenSymbol: sourceToken.symbol,
          source: {
            network: {
              slug: sourceChain.slug,
              networkId: sourceChain.chainId,
            },
          },
        },
        onConfirm: async (approveAll: boolean = false) => {
          const approveAmount = approveAll ? constants.MaxUint256 : sourceTokenAmount
          setApproving(true)
          return await sourceToken.approve(spender, approveAmount)
        },
      })

      if (tx?.hash) {
        addTransaction(
          new Transaction({
            hash: tx.hash,
            networkName: sourceChain.slug,
            token: sourceToken,
            isCanonicalTransfer: true
          })
        )

        const res = await waitForTransaction(tx, {
          networkName: sourceChain.slug,
          token: sourceToken,
        })
        if (res && 'replacementTx' in res) {
          return res.replacementTx
        }
      }
      await tx?.wait()
    } catch (error: any) {
      setApproving(false)
      if (!/cancelled/gi.test(error.message)) {
        setError(formatError(error, sourceChain))
      }
      logger.error(error)
    }
    setApproving(false)
  }, [
    l1CanonicalBridge,
    usingNativeBridge,
    txConfirm,
    sourceChain,
    sourceToken,
    destinationChain,
    approving,
    checkConnectedNetworkId,
    waitForTransaction,
    addTransaction,
    Transaction,
    toTokenDisplay,
  ])

  // ====================================================================
  // Send native bridge
  // ====================================================================

  const sendL1CanonicalBridge = useCallback(async () => {
    if (
      !(
        sdk &&
        l1CanonicalBridge &&
        sourceToken &&
        sourceTokenAmount &&
        sourceChain &&
        destinationChain &&
        usingNativeBridge &&
        needsNativeBridgeApproval === false &&
        txConfirm
      )
    ) {
      console.error('not ready')
      return
    }

    try {
      const tx: any = await txConfirm.show({
        kind: 'send',
        inputProps: {
          customRecipient,
          source: {
            amount: toTokenDisplay(sourceTokenAmount, sourceToken?.decimals),
            token: sourceToken,
            network: {
              slug: sourceChain.slug,
              networkId: sourceChain.chainId,
            },
          },
          dest: {
            network: destinationChain,
          },
          estimatedReceived: toTokenDisplay(
            sourceTokenAmount,
            sourceToken?.decimals,
            sourceToken?.symbol
          ),
        },
        onConfirm: async () => {
          try {
            const isNetworkConnected = await checkConnectedNetworkId(l1Network.networkId)
            if (!isNetworkConnected) return

            setSending(true)
            console.log('native bridge deposit')
            return l1CanonicalBridge.deposit(sourceTokenAmount)
          } catch (error: any) {
            if (setError) {
              setError(formatError(error))
            }
            logger.error(formatError(error))
            setSending(false)
          }
          setSending(false)
        },
      })
      logger.debug(`tx:`, tx)

      setSending(false)
      if (!tx) {
        return
      }

      const txHandled = handleTransaction(tx, sourceChain, destinationChain, sourceToken)
      logger.debug(`txHandled:`, txHandled)

      const { transaction, txModel } = txHandled
      setTx(txModel)

      const txModelArgs = {
        networkName: sourceChain.slug,
        destNetworkName: destinationChain.slug,
        token: sourceToken,
      }

      // TODO: DRY. this is copied from useSendTransaction and shouldn't be re-written
      const res = await waitForTransaction(transaction, txModelArgs)

      if (res && 'replacementTxModel' in res) {
        setTx(res.replacementTxModel)
        const { replacementTxModel: txModelReplacement } = res

        if (sourceChain && destinationChain) {
          // Replace watcher
          const replacementWatcher = sdk?.watch(
            txModelReplacement.hash,
            sourceToken!.symbol,
            sourceChain?.slug,
            destinationChain?.slug
          )
          replacementWatcher.once(sdk?.Event.DestinationTxReceipt, async data => {
            logger.debug(`replacement dest tx receipt event data:`, data)
            if (txModelReplacement && !txModelReplacement.destTxHash) {
              const opts = {
                destTxHash: data.receipt.transactionHash,
                pendingDestinationConfirmation: false,
                replaced: transaction.hash,
              }
              updateTransaction(txModelReplacement, opts)
            }
          })
        }
      }

      return handleTransaction(tx, sourceChain, destinationChain, sourceToken)
    } catch (err: any) {
      if (!/cancelled/gi.test(err.message)) {
        setError(formatError(err, sourceChain))
      }
      logger.error(err)
    }
    setSending(false)
  }, [
    sdk,
    l1CanonicalBridge,
    sourceChain,
    sourceToken,
    sourceTokenAmount,
    destinationChain,
    needsNativeBridgeApproval,
    txConfirm,
    estimatedReceived,
    usingNativeBridge,
    checkConnectedNetworkId,
    waitForTransaction,
    toTokenDisplay,
  ])

  const estimateApproveNativeBridge = useCallback(async () => {
    if (!(usingNativeBridge && l1CanonicalBridge && sourceTokenAmount)) {
      return
    }

    return l1CanonicalBridge.estimateApproveTx(sourceTokenAmount)
  }, [usingNativeBridge, l1CanonicalBridge, sourceTokenAmount])

  const estimateSendNativeBridge = useCallback(
    async (options: EstimateTxOptions) => {
      if (!(usingNativeBridge && l1CanonicalBridge && sourceTokenAmount)) {
        return
      }

      return await l1CanonicalBridge.estimateDepositTx(sourceTokenAmount, options)
    },
    [usingNativeBridge, l1CanonicalBridge, sourceTokenAmount]
  )

  return {
    selectNativeBridge,
    usingNativeBridge,
    setUsingNativeBridge,

    l1CanonicalBridge,

    needsNativeBridgeApproval,
    approveNativeBridge,

    estimateApproveNativeBridge,
    estimateSendNativeBridge,
    sendL1CanonicalBridge,
  }
}