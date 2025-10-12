import { useEffect, useMemo } from 'react'
import logo from './assets/logo.svg'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useChainId,
} from 'wagmi'
import { formatUnits } from 'viem'
import type { Abi } from 'viem'

// Addresses from .env (no VITE_ prefix)
const TOKEN_ADDRESS = import.meta.env.SIMPLE_TOKEN_ADDRESS as `0x${string}`
const FAUCET_ADDRESS = import.meta.env.TOKEN_FAUCET_ADDRESS as `0x${string}`

// ABIs from src/abis (Etherscan-style: array at root)
import SimpleTokenAbi from './abis/SimpleToken.json'
import TokenFaucetAbi from './abis/TokenFaucet.json'
const tokenAbi = SimpleTokenAbi as Abi
const faucetAbi = TokenFaucetAbi as Abi
function formatSeconds(sec?: bigint) {
  if (!sec || sec <= 0n) return '0s'
  const s = Number(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return [h ? `${h}h` : null, m ? `${m}m` : null, r ? `${r}s` : null].filter(Boolean).join(' ')
}

function App() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const isSepolia = chainId === 11155111
  const envOk = Boolean(TOKEN_ADDRESS && FAUCET_ADDRESS && TOKEN_ADDRESS.startsWith('0x') && FAUCET_ADDRESS.startsWith('0x'))

  // Token metadata
  const { data: symbol } = useReadContract({ abi: tokenAbi, address: TOKEN_ADDRESS, functionName: 'symbol', query: { enabled: envOk } })
  const { data: name } = useReadContract({ abi: tokenAbi, address: TOKEN_ADDRESS, functionName: 'name', query: { enabled: envOk } })
  const { data: decimals } = useReadContract({ abi: tokenAbi, address: TOKEN_ADDRESS, functionName: 'decimals', query: { enabled: envOk } })
  // Ensure ReactNode-friendly strings for UI rendering
  const symbolText = useMemo(() => (typeof symbol === 'string' ? symbol : 'TEST'), [symbol])
  const nameText = useMemo(() => (typeof name === 'string' ? name : 'SimpleToken'), [name])

  // Add token to wallet (MetaMask) helper inside component to access symbol/decimals
  const addTokenToWallet = async () => {
    try {
      const ethereum = (window as any)?.ethereum
      if (!ethereum || !ethereum.request) return
      await ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: TOKEN_ADDRESS,
            symbol: symbolText,
            decimals: decimals ? Number(decimals) : 18,
            image: logo,
          },
        },
      })
    } catch (err) {
      console.error('Failed to add token to wallet', err)
    }
  }
  const { data: userBalance, refetch: refetchUserBalance } = useReadContract({
    abi: tokenAbi,
    address: TOKEN_ADDRESS,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && envOk },
  })
  const { data: faucetBalanceRaw, refetch: refetchFaucetBalance } = useReadContract({
    abi: faucetAbi,
    address: FAUCET_ADDRESS,
    functionName: 'getFaucetBalance',
    query: { enabled: envOk },
  })

  // Faucet config/state
  const { data: faucetConfig } = useReadContract({ abi: faucetAbi, address: FAUCET_ADDRESS, functionName: 'getFaucetConfig', query: { enabled: envOk } })

  // User info
  const { data: userInfo, refetch: refetchUserInfo } = useReadContract({
    abi: faucetAbi,
    address: FAUCET_ADDRESS,
    functionName: 'getUserInfo',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && envOk },
  })

  // Request tokens
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract()
  const { isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash, query: { enabled: Boolean(txHash) } })

  useEffect(() => {
    if (txSuccess) {
      refetchUserInfo?.()
      refetchUserBalance?.()
      refetchFaucetBalance?.()
    }
  }, [txSuccess])

  // Listen to ERC-20 Transfer events to update balances when faucet transfers or user receives
  useWatchContractEvent({
    abi: tokenAbi,
    address: TOKEN_ADDRESS,
    eventName: 'Transfer',
    onLogs: (logs) => {
      if (!address) return
      let toUser = false
      let fromFaucet = false
      const transferSig = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
      for (const l of logs as any[]) {
        const topics = l.topics as readonly `0x${string}`[] | undefined
        if (!topics || topics.length < 3) continue
        if (String(topics[0]).toLowerCase() !== transferSig) continue
        const fromAddr = ('0x' + String(topics[1]).slice(-40)).toLowerCase()
        const toAddr = ('0x' + String(topics[2]).slice(-40)).toLowerCase()
        if (toAddr === address.toLowerCase()) toUser = true
        if (fromAddr === FAUCET_ADDRESS.toLowerCase()) fromFaucet = true
      }
      if (toUser || fromFaucet) {
        refetchUserBalance?.()
        refetchFaucetBalance?.()
        refetchUserInfo?.()
      }
    },
  })

  const decimalsNum = useMemo(() => (decimals ? Number(decimals) : 18), [decimals])
  const faucetBalance = useMemo(() => (faucetBalanceRaw ? formatUnits(faucetBalanceRaw as bigint, decimalsNum) : '0'), [faucetBalanceRaw, decimalsNum])
  const userBalanceFmt = useMemo(() => (userBalance ? formatUnits(userBalance as bigint, decimalsNum) : '0'), [userBalance, decimalsNum])

  const tokensPerRequestFmt = useMemo(() => {
    const v = (faucetConfig as any)?.[0] as bigint | undefined
    return v ? formatUnits(v, decimalsNum) : '—'
  }, [faucetConfig, decimalsNum])
  const cooldownSec = useMemo(() => (faucetConfig as any)?.[1] as bigint | undefined, [faucetConfig])
  const maxPerAddressFmt = useMemo(() => {
    const v = (faucetConfig as any)?.[2] as bigint | undefined
    return v ? formatUnits(v, decimalsNum) : '—'
  }, [faucetConfig, decimalsNum])
  const dailyLimitFmt = useMemo(() => {
    const v = (faucetConfig as any)?.[3] as bigint | undefined
    return v ? formatUnits(v, decimalsNum) : '—'
  }, [faucetConfig, decimalsNum])
  const totalDistributedTodayFmt = useMemo(() => {
    const v = (faucetConfig as any)?.[4] as bigint | undefined
    return v ? formatUnits(v, decimalsNum) : '0'
  }, [faucetConfig, decimalsNum])
  const paused = useMemo(() => Boolean((faucetConfig as any)?.[5]), [faucetConfig])

  const canRequest = Boolean((userInfo as any)?.[2])
  const timeUntilNext = (userInfo as any)?.[3] as bigint | undefined
  const totalReceivedFmt = useMemo(() => {
    const v = (userInfo as any)?.[0] as bigint | undefined
    return v ? formatUnits(v, decimalsNum) : '0'
  }, [userInfo, decimalsNum])

  const handleRequest = () => {
    if (!isConnected || paused || !canRequest || isPending || !isSepolia || !envOk) return
    writeContract({ abi: faucetAbi, address: FAUCET_ADDRESS, functionName: 'requestTokens' })
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-neutral-50 to-white dark:from-neutral-950 dark:to-neutral-900 text-neutral-900 dark:text-neutral-100">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-neutral-200/60 dark:border-neutral-800/60 bg-white/70 dark:bg-neutral-900/60 backdrop-blur supports-[backdrop-filter]:bg-white/60 supports-[backdrop-filter]:dark:bg-neutral-900/50">
        <div className="mx-auto w-full max-w-7xl px-6 py-4 flex items-center justify-between">
          {/* Logo + title left */}
          <div className="flex items-center gap-3">
            <img src={logo} alt={`${symbolText} Token logo`} className="h-12 w-12 rounded-lg shadow-sm" />
            <div>
              <span className="text-2xl md:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 to-neutral-700 dark:from-white dark:to-neutral-300">TEST Token Faucet</span>
              <p className="text-sm md:text-base text-neutral-600 dark:text-neutral-400">{nameText} ({symbolText})</p>
            </div>
          </div>

          {/* Address + balance right */}
          <div className="flex items-center gap-3">
            <ConnectButton
              chainStatus="none"
              accountStatus="address"
              showBalance={{ smallScreen: true, largeScreen: true }}
            />
            <button
              onClick={addTokenToWallet}
              disabled={!envOk}
              className="inline-flex items-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
            >
              Add {symbolText} to wallet
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-start px-6 pt-6">
        {/* Env validation banner */}
          {!envOk && (
            <div className="mt-4 w-full max-w-7xl rounded-xl border border-yellow-300/60 bg-yellow-50/70 dark:bg-yellow-950/40 dark:border-yellow-800 text-yellow-900 dark:text-yellow-200 p-4">
              ⚠️ Missing environment variables: SIMPLE_TOKEN_ADDRESS and TOKEN_FAUCET_ADDRESS.
            </div>
          )}

        {!isConnected ? (
          <div className="flex-1 w-full max-w-7xl flex items-center justify-center text-center">
            <div className="rounded-2xl bg-white/70 dark:bg-neutral-900/50 backdrop-blur border border-neutral-200/60 dark:border-neutral-800/60 shadow-sm p-8">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Connect your wallet</h1>
              <p className="mb-6 text-base md:text-lg text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto">
                To request tokens from the faucet, you need to connect your wallet to the Sepolia network.
              </p>
              <div className="flex justify-center">
                <ConnectButton chainStatus="none" label="Connect Wallet" />
              </div>
            </div>
          </div>
        ) : !isSepolia ? (
          <div className="flex-1 w-full max-w-2xl rounded-2xl border border-red-200/60 bg-red-50/70 dark:bg-red-950/30 dark:border-red-800/60 p-6 mt-8 shadow-sm">
            <h2 className="text-xl font-semibold mb-2 text-red-700 dark:text-red-300">Wrong network</h2>
            <p className="text-sm text-red-800 dark:text-red-200">
              You are connected to network {chainId}. Switch to Sepolia (chainId 11155111) to use the faucet.
            </p>
          </div>
        ) : (
          <div className="w-full max-w-3xl rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 p-6 shadow-sm mt-8 bg-white/70 dark:bg-neutral-900/50 backdrop-blur">
            <h2 className="text-xl font-semibold mb-4">Faucet Status</h2>

            {/* Status grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 p-4 shadow-sm transition hover:shadow-md">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Tokens per request</p>
                <p className="text-lg font-medium">{tokensPerRequestFmt} {symbolText}</p>
              </div>
              <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 p-4 shadow-sm transition hover:shadow-md">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Cooldown</p>
                <p className="text-lg font-medium">{formatSeconds(cooldownSec)}</p>
              </div>
              <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 p-4 shadow-sm transition hover:shadow-md">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Max per address</p>
                <p className="text-lg font-medium">{maxPerAddressFmt} {symbolText}</p>
              </div>
              <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 p-4 shadow-sm transition hover:shadow-md">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Daily limit</p>
                <p className="text-lg font-medium">{dailyLimitFmt} {symbolText}</p>
              </div>
              <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 p-4 shadow-sm transition hover:shadow-md">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Distributed today</p>
                <p className="text-lg font-medium">{totalDistributedTodayFmt} {symbolText}</p>
              </div>
            </div>

            {/* Balances */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/40 p-4 ring-1 ring-neutral-200/60 dark:ring-neutral-800/60 shadow-sm">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Faucet Balance</p>
                <p className="text-lg font-semibold">{faucetBalance} {symbolText}</p>
              </div>
              <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/40 p-4 ring-1 ring-neutral-200/60 dark:ring-neutral-800/60 shadow-sm">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Your balance</p>
                <p className="text-lg font-semibold">{userBalanceFmt} {symbolText}</p>
              </div>
            </div>

            {/* User info */}
            <div className="rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 p-5 mb-6 bg-neutral-50/50 dark:bg-neutral-800/30">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Total received</p>
              <p className="text-lg font-medium">{totalReceivedFmt} {symbolText}</p>
              {!canRequest && Boolean(timeUntilNext) && (
                <p className="mt-2 text-sm text-orange-600">You can request again in {formatSeconds(timeUntilNext)}</p>
              )}
              {paused && (
                <p className="mt-2 text-sm text-red-600">The faucet is temporarily paused.</p>
              )}
            </div>

            {/* Action */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleRequest}
                disabled={!canRequest || paused || isPending || !isSepolia || !envOk}
                className="inline-flex items-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-2.5 font-semibold shadow-sm hover:from-indigo-700 hover:to-violet-700 transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900"
              >
                {isPending ? 'Requesting…' : 'Request tokens'}
              </button>
              {!!writeError && (
                <span className="text-sm text-red-600">{(writeError as any)?.shortMessage || String((writeError as any)?.message || writeError)}</span>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
