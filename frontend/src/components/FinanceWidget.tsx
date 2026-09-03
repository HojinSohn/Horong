import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { exchangePublicToken, fetchLinkToken, fetchTransactions, type Transaction } from '../lib/financeApi'
import { currencyFormatter } from '../lib/spending'
import { SpendingBarChart } from './SpendingBarChart'
import { SpendingPieChart } from './SpendingPieChart'

// Plaid's own sign convention: positive = money out (a debit/spend),
// negative = money in (a credit/refund). We flip credits to a leading "+"
// and color them, since a bare minus sign ("$-500.00") reads as a typo,
// not as "money came back."
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function formatAmount(amount: number): string {
  const formatted = currencyFormatter.format(Math.abs(amount))
  return amount < 0 ? `+${formatted}` : formatted
}

function formatDate(isoDate: string): string {
  // Plaid dates are date-only ("2026-08-27"); parsing with an explicit UTC
  // timeZone below avoids the classic off-by-one-day shift a local-timezone
  // format would introduce for negative UTC offsets.
  return dateFormatter.format(new Date(isoDate))
}

export function FinanceWidget() {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [linked, setLinked] = useState(false)
  const [needsReauth, setNeedsReauth] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadTransactions = useCallback(async () => {
    try {
      const result = await fetchTransactions()
      setLinked(result.linked)
      setNeedsReauth(result.needsReauth)
      setTransactions(result.transactions)
    } catch {
      setError("Couldn't load transactions.")
    }
  }, [])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  useEffect(() => {
    if (!linked || needsReauth) {
      fetchLinkToken()
        .then(setLinkToken)
        .catch(() => setError("Couldn't connect to bank linking."))
    }
  }, [linked, needsReauth])

  const onSuccess = useCallback(
    (publicToken: string | null) => {
      if (!publicToken) return
      exchangePublicToken(publicToken)
        .then(loadTransactions)
        .catch(() => setError("Couldn't link your bank."))
    },
    [loadTransactions],
  )

  const { open, ready } = usePlaidLink({ token: linkToken ?? '', onSuccess })

  return (
    <div className="widget-card">
      <h2>Finance</h2>
      {(!linked || needsReauth) && (
        <button type="button" onClick={() => open()} disabled={!ready}>
          Connect your bank
        </button>
      )}
      {linked && needsReauth && <p className="finance-reauth">Reconnect your bank to keep syncing.</p>}
      {error && <p className="finance-error">{error}</p>}
      {linked && transactions.length > 0 && (
        <>
          <SpendingPieChart transactions={transactions} />
          <SpendingBarChart transactions={transactions} />
        </>
      )}
      {linked && (
        <ul className="finance-transactions">
          {transactions.map((txn) => (
            <li key={txn.id} className="finance-txn">
              <div className="finance-txn__main">
                <span className="finance-txn__name">{txn.name}</span>
                <span
                  className={
                    txn.amount < 0 ? 'finance-txn__amount finance-txn__amount--credit' : 'finance-txn__amount'
                  }
                >
                  {formatAmount(txn.amount)}
                </span>
              </div>
              <div className="finance-txn__meta">
                <span>{formatDate(txn.date)}</span>
                {txn.category && <span>{txn.category}</span>}
                {txn.pending && <span className="finance-txn__pending">Pending</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
