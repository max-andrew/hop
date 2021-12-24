import makeRequest from './makeRequest'
import { normalizeEntity } from './shared'

export default async function getTransferRoots (
  chain: string,
  token: string,
  lastId: string = '0x0000000000000000000000000000000000000000'
): Promise<any[]> {
  const query = `
    query TransferRoots($token: String, $lastId: ID) {
      transfersCommitteds(
        where: {
          token: $token,
          id_gt: $lastId
        },
        orderBy: id,
        orderDirection: asc,
        id_gt: $lastId,
        first: 1000
      ) {
        id
        rootHash
        destinationChainId
        totalAmount
        rootCommittedAt

        transactionHash
        transactionIndex
        timestamp
        blockNumber
        contractAddress
        token
      }
    }
  `
  const jsonRes = await makeRequest(chain, query, {
    token,
    lastId
  })

  let roots = jsonRes.transfersCommitteds.map((x: any) => normalizeEntity(x))

  lastId = roots[roots.length - 1].id
  const maxItemsLength = 1000
  if (roots.length === maxItemsLength) {
    roots = roots.concat(await getTransferRoots(
      chain,
      token,
      lastId
    ))
  }

  return roots
}
