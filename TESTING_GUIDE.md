# WalletConnect Testing Guide

## Quick Start Testing

### Desktop Testing (5 minutes)

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open in browser:**
   - Navigate to `http://localhost:5173`
   - You should see the Galaxy landing page

3. **Connect via QR Code:**
   - Click "Connect Wallet"
   - WalletConnect QR modal should appear
   - Open MetaMask mobile app → Settings → WalletConnect → Scan QR
   - Approve connection
   - You should be redirected to the main app

4. **Test Swap:**
   - Select ETH → USDC
   - Enter amount (e.g., 0.001 ETH)
   - Click "Calculate Route"
   - Click "Trade"
   - Approve transaction in mobile wallet
   - Wait for confirmation

5. **Test Disconnect:**
   - Click wallet address in navbar
   - Click "Disconnect"
   - Should return to landing page

### Mobile Testing (5 minutes)

1. **Deploy to accessible URL or use ngrok:**
   ```bash
   npm run build
   npm run preview
   # Or use ngrok for external access
   ngrok http 4173
   ```

2. **Open on mobile device:**
   - Use Safari (iOS) or Chrome (Android)
   - Navigate to your deployed URL

3. **Connect Wallet:**
   - Click "Connect Wallet"
   - Should deep link to MetaMask mobile
   - Approve connection
   - Returns to browser automatically

4. **Test Transaction:**
   - Navigate to Stake tab
   - Enter amount
   - Click "Deposit"
   - Approve in wallet
   - Verify success

## Troubleshooting

### QR Modal Not Appearing
- Check console for errors
- Verify project ID is correct: `88686807816516c396fdf733fd957d95`
- Ensure `@walletconnect/ethereum-provider` is installed

### Mobile Deep Link Not Working
- Ensure wallet app is installed
- Try manually opening wallet app first
- Check if browser blocks redirects
- Clear browser cache and try again

### Connection Drops
- Check network connection
- Verify Ethereum mainnet is selected
- Check WalletConnect Cloud status

### Transactions Failing
- Ensure sufficient ETH for gas
- Verify correct network (mainnet)
- Check token balances
- Try increasing slippage

## Browser Compatibility

### Tested Browsers
- ✅ Chrome (desktop & mobile)
- ✅ Firefox (desktop)
- ✅ Safari (desktop & iOS)
- ✅ Edge (desktop)
- ✅ Brave (desktop & mobile)

### Known Issues
- None currently

## Wallet Compatibility

### Tested Wallets
- ✅ MetaMask (iOS, Android)
- ✅ Coinbase Wallet
- ✅ Trust Wallet
- ⏳ Rainbow (pending test)
- ⏳ Phantom (pending test)

### How to Test New Wallet
1. Install wallet app
2. Fund with test ETH
3. Open app, click "Connect Wallet"
4. Select wallet from WalletConnect modal
5. Approve connection
6. Test basic transaction

## Performance Checks

### Initial Load
- [ ] Landing page loads < 2s
- [ ] Starfield animation smooth
- [ ] QR modal appears instantly

### Connection Speed
- [ ] QR scan → connection < 5s
- [ ] Mobile deep link < 3s
- [ ] Auto-reconnect < 2s

### Transaction Speed
- [ ] Route calculation < 3s
- [ ] Transaction signing < 10s
- [ ] Confirmation feedback immediate

## Security Checks

### Connection Security
- [ ] Only connects to user-approved wallet
- [ ] Session persists securely
- [ ] Disconnect fully clears session
- [ ] No private keys in localStorage

### Transaction Security
- [ ] User must approve each transaction
- [ ] Amounts match user input
- [ ] Contract addresses are correct
- [ ] Network validation works

## Reporting Issues

If you find bugs, please note:
1. Device & browser version
2. Wallet app & version
3. Steps to reproduce
4. Console error messages
5. Screenshots if applicable

Report to: [your-email@x-quo.com]

---

**Happy Testing! 🚀**

