import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { exchangePublicToken, fetchLinkToken, fetchTransactions, type Transaction } from '../lib/financeApi'

export function FinanceWidget() {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [linked, setLinked] = useState(false)
  const [needsReauth, setNeedsReauth] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])

  const loadTransactions = useCallback(async () => {
    const result = await fetchTransactions()
    setLinked(result.linked)
    setNeedsReauth(result.needsReauth)
    setTransactions(result.transactions)
  }, [])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  useEffect(() => {
    if (!linked) {
      fetchLinkToken().then(setLinkToken)
    }
  }, [linked])

  const onSuccess = useCallback(
    (publicToken: string | null) => {
      if (!publicToken) return
      exchangePublicToken(publicToken).then(loadTransactions)
    },
    [loadTransactions],
  )

  const { open, ready } = usePlaidLink({ token: linkToken ?? '', onSuccess })

  return (
    <div className="widget-card">
      <h2>Finance</h2>
      {!linked && (
        <button type="button" onClick={() => open()} disabled={!ready}>
          Connect your bank
        </button>
      )}
      {linked && needsReauth && <p className="finance-reauth">Reconnect your bank to keep syncing.</p>}
      {linked && (
        <ul className="finance-transactions">
          {transactions.map((txn) => (
            <li key={txn.id}>
              {txn.date} — {txn.name} — ${txn.amount.toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
