import { useState, useEffect } from 'react';
import { useWalletStore } from '../store/wallet';
import {
  POLYGON_TOKENS,
  Token,
  getSwapQuote,
  getTokenBalance,
  checkAllowance,
  approveToken,
  executeSwap,
  parseTokenAmount,
  formatTokenAmount,
} from '../utils/dex';
import { ethers } from 'ethers';

function Trade() {
  const { address, provider, signer, chainId } = useWalletStore();
  
  const [sellToken, setSellToken] = useState<Token>(POLYGON_TOKENS.MATIC);
  const [buyToken, setBuyToken] = useState<Token>(POLYGON_TOKENS.USDC);
  const [sellAmount, setSellAmount] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [sellBalance, setSellBalance] = useState('0');
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (address && provider && chainId === 137) {
      loadBalance();
    }
  }, [address, provider, sellToken, chainId]);

  useEffect(() => {
    if (sellAmount && parseFloat(sellAmount) > 0) {
      const timer = setTimeout(() => {
        fetchQuote();
      }, 500); // Debounce
      return () => clearTimeout(timer);
    } else {
      setBuyAmount('');
      setQuote(null);
    }
  }, [sellAmount, sellToken, buyToken]);

  const loadBalance = async () => {
    if (!address || !provider) return;
    try {
      const balance = await getTokenBalance(provider, sellToken.address, address);
      setSellBalance(balance);
    } catch (err) {
      console.error('Failed to load balance:', err);
    }
  };

  const fetchQuote = async () => {
    if (!sellAmount || parseFloat(sellAmount) <= 0 || !chainId) return;
    
    setIsLoadingQuote(true);
    setError(null);

    try {
      const sellAmountWei = parseTokenAmount(sellAmount, sellToken.decimals);
      const quoteData = await getSwapQuote(
        sellToken.address,
        buyToken.address,
        sellAmountWei,
        chainId
      );

      setQuote(quoteData);
      setBuyAmount(formatTokenAmount(quoteData.buyAmount, buyToken.decimals));

      // Check if approval needed (for ERC20 tokens)
      if (sellToken.address !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' && provider && address) {
        const allowance = await checkAllowance(
          provider,
          sellToken.address,
          address,
          quoteData.allowanceTarget
        );
        setNeedsApproval(ethers.BigNumber.from(allowance).lt(sellAmountWei));
      } else {
        setNeedsApproval(false);
      }
    } catch (err: any) {
      console.error('Quote error:', err);
      setError(err.message || 'Failed to get quote');
      setBuyAmount('');
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const handleApprove = async () => {
    if (!signer || !quote) return;

    setIsApproving(true);
    setError(null);

    try {
      const sellAmountWei = parseTokenAmount(sellAmount, sellToken.decimals);
      const tx = await approveToken(
        signer,
        sellToken.address,
        quote.allowanceTarget,
        sellAmountWei
      );

      await tx.wait();
      setNeedsApproval(false);
    } catch (err: any) {
      console.error('Approval error:', err);
      setError(err.message || 'Approval failed');
    } finally {
      setIsApproving(false);
    }
  };

  const handleSwap = async () => {
    if (!signer || !quote) return;

    setIsSwapping(true);
    setError(null);

    try {
      const tx = await executeSwap(signer, quote);
      await tx.wait();

      // Reset and reload
      setSellAmount('');
      setBuyAmount('');
      setQuote(null);
      await loadBalance();

      alert('Swap successful!');
    } catch (err: any) {
      console.error('Swap error:', err);
      setError(err.message || 'Swap failed');
    } finally {
      setIsSwapping(false);
    }
  };

  const switchTokens = () => {
    const temp = sellToken;
    setSellToken(buyToken);
    setBuyToken(temp);
    setSellAmount(buyAmount);
    setBuyAmount('');
  };

  const isPolygon = chainId === 137;

  return (
    <div>
      <h2>Trade</h2>

      {!address && (
        <div style={{ marginTop: '2rem', padding: '1rem', background: '#7f1d1d', borderRadius: '8px', color: '#fca5a5' }}>
          Please connect your wallet to trade
        </div>
      )}

      {address && !isPolygon && (
        <div style={{ marginTop: '2rem', padding: '1rem', background: '#7f1d1d', borderRadius: '8px', color: '#fca5a5' }}>
          Please switch to Polygon network to trade
        </div>
      )}

      {error && (
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#7f1d1d', borderRadius: '8px', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {address && isPolygon && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ padding: '1.5rem', background: '#1a1f3a', borderRadius: '8px' }}>
            <h3>Swap Tokens</h3>
            
            {/* Sell Section */}
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ color: '#94a3b8' }}>You Pay</label>
                <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                  Balance: {parseFloat(sellBalance).toFixed(4)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  placeholder="0.0"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#0a0e27',
                    color: '#fff',
                    border: '1px solid #2a3f5f',
                    borderRadius: '4px',
                    fontSize: '1rem'
                  }}
                />
                <select
                  value={sellToken.symbol}
                  onChange={(e) => setSellToken(POLYGON_TOKENS[e.target.value])}
                  style={{
                    padding: '0.5rem',
                    background: '#0a0e27',
                    color: '#fff',
                    border: '1px solid #2a3f5f',
                    borderRadius: '4px',
                    minWidth: '100px'
                  }}
                >
                  {Object.values(POLYGON_TOKENS).map(token => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setSellAmount(sellBalance)}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.25rem 0.75rem',
                  background: '#2a3f5f',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  fontSize: '0.875rem'
                }}
              >
                Max
              </button>
            </div>

            {/* Switch Button */}
            <div style={{ textAlign: 'center', margin: '1rem 0' }}>
              <button
                onClick={switchTokens}
                style={{
                  padding: '0.5rem',
                  background: '#2a3f5f',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  color: '#4ade80',
                  fontSize: '1.25rem',
                  width: '40px',
                  height: '40px'
                }}
              >
                ⇅
              </button>
            </div>

            {/* Buy Section */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>
                You Receive {isLoadingQuote && '(loading...)'}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={buyAmount}
                  readOnly
                  placeholder="0.0"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#0a0e27',
                    color: '#fff',
                    border: '1px solid #2a3f5f',
                    borderRadius: '4px',
                    fontSize: '1rem'
                  }}
                />
                <select
                  value={buyToken.symbol}
                  onChange={(e) => setBuyToken(POLYGON_TOKENS[e.target.value])}
                  style={{
                    padding: '0.5rem',
                    background: '#0a0e27',
                    color: '#fff',
                    border: '1px solid #2a3f5f',
                    borderRadius: '4px',
                    minWidth: '100px'
                  }}
                >
                  {Object.values(POLYGON_TOKENS).map(token => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Price Display */}
            {quote && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#0a0e27', borderRadius: '4px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                  <div>Rate: 1 {sellToken.symbol} = {parseFloat(quote.price).toFixed(6)} {buyToken.symbol}</div>
                  <div>Est. Gas: ~{parseInt(quote.estimatedGas) / 1000000} MATIC</div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={isApproving || !quote}
                style={{
                  width: '100%',
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: isApproving ? '#6b7280' : '#fbbf24',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isApproving || !quote ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  color: '#000',
                  fontWeight: '600'
                }}
              >
                {isApproving ? 'Approving...' : `Approve ${sellToken.symbol}`}
              </button>
            ) : (
              <button
                onClick={handleSwap}
                disabled={isSwapping || !quote || parseFloat(sellAmount) <= 0}
                style={{
                  width: '100%',
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: isSwapping || !quote || parseFloat(sellAmount) <= 0 ? '#6b7280' : '#4ade80',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isSwapping || !quote || parseFloat(sellAmount) <= 0 ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  color: '#fff',
                  fontWeight: '600'
                }}
              >
                {isSwapping ? 'Swapping...' : 'Swap'}
              </button>
            )}
          </div>

          <div style={{ marginTop: '1rem', padding: '1rem', background: '#1a1f3a', borderRadius: '8px' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
              ⓘ Powered by 0x Protocol. Prices include 1% slippage tolerance. Always verify transaction details in MetaMask.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Trade;
