import CommitTransfersWatcher from 'src/watchers/CommitTransfersWatcher'
import chainSlugToId from 'src/utils/chainSlugToId'
import { findWatcher, getWatchers } from 'src/watchers/watchers'
import { logger, program } from './shared'
import {
  parseConfigFile,
  setGlobalConfigFromConfigFile
} from 'src/config'

program
  .command('commit-transfers')
  .description('Start the relayer watcher')
  .option('--config <string>', 'Config file to use.')
  .option('--env <string>', 'Environment variables file')
  .option('--source-chain <string>', 'Source chain')
  .option('--destination-chain <string>', 'Destination chain')
  .option('--token <string>', 'Token')
  .option('--transfer-id <string>', 'Transfer ID')
  .option(
    '-d, --dry',
    'Start in dry mode. If enabled, no transactions will be sent.'
  )
  .action(async (source: any) => {
    try {
      const configPath = source?.config || source?.parent?.config
      if (configPath) {
        const config = await parseConfigFile(configPath)
        await setGlobalConfigFromConfigFile(config)
      }

      const sourceChain = source.sourceChain
      const destinationChain = source.destinationChain
      const token = source.token
      const dryMode = !!source.dry
      if (!sourceChain) {
        throw new Error('source chain is required')
      }
      if (!destinationChain) {
        throw new Error('destination chain is required')
      }
      if (!token) {
        throw new Error('token is required')
      }

      const watchers = getWatchers({
        enabledWatchers: ['commitTransfers'],
        tokens: [token],
        dryMode
      })

      const watcher = findWatcher(watchers, CommitTransfersWatcher, sourceChain) as CommitTransfersWatcher
      if (!watcher) {
        throw new Error('watcher not found')
      }

      const destinationChainId = chainSlugToId(destinationChain)
      await watcher.checkIfShouldCommit(destinationChainId!) // eslint-disable-line
    } catch (err) {
      logger.error(err)
      process.exit(1)
    }
  })
