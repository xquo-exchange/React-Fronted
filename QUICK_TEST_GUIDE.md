# Quick Testing Guide - WalletConnect Fixes

## Start Dev Server

```bash
npm run dev
```

Then open `http://localhost:5173` in your browser.

---

## Test 1: Fresh Load (No Auto QR Modal) ✅

**Steps:**
1. Open app in **incognito/private** mode (or clear localStorage)
2. Observe the landing page

**Expected:**
- ✅ Landing page with starfield animation appears
- ✅ "Connect Wallet" button visible
- ✅ **NO QR modal auto-shows**

**Console Logs:**
```
No WalletConnect session to restore
```

---

## Test 2: First Connection (QR Shows Once) ✅

**Steps:**
1. Click "Connect Wallet" button
2. Observe QR modal

**Expected:**
- ✅ QR modal appears **immediately**
- ✅ QR modal appears **only once** (no duplicates)
- ✅ Scan with mobile wallet and connect

**Console Logs:**
```
🔄 Initializing WalletConnect with QR modal...
✅ WalletConnect connected: 0x...
```

---

## Test 3: No Refresh Loops ✅

**Steps:**
1. After connecting (from Test 2)
2. Observe browser behavior

**Expected:**
- ✅ Page does **NOT** refresh
- ✅ You see the main app immediately
- ✅ No multiple reloads
- ✅ No "Core is already initialized" warnings

**Console Logs:**
```
✅ WalletConnect connected: 0x...
(NO reload messages)
```

---

## Test 4: Silent Reconnection ✅

**Steps:**
1. While connected, **refresh the page** (F5 or Ctrl+R)
2. Observe behavior

**Expected:**
- ✅ **NO QR modal appears**
- ✅ Connection restores silently
- ✅ You stay on the main app
- ✅ No landing page flash
- ✅ **NO page reload loops**

**Console Logs:**
```
🔄 Attempting silent WalletConnect reconnect...
✅ Found existing WalletConnect session
✅ WalletConnect session restored: 0x...
```

---

## Test 5: Disconnect Cleanly ✅

**Steps:**
1. Click wallet address in navbar
2. Click "Disconnect"

**Expected:**
- ✅ Returns to landing page
- ✅ No errors in console
- ✅ Clean state

**Console Logs:**
```
Wallet disconnected
🧹 Clearing cached WalletConnect provider
```

---

## Test 6: Reconnect After Disconnect ✅

**Steps:**
1. After disconnecting (from Test 5)
2. Click "Connect Wallet" again

**Expected:**
- ✅ QR modal appears
- ✅ Can reconnect successfully
- ✅ No errors

---

## Common Issues to Check

### ❌ If QR Modal Auto-Shows
- **Problem**: Silent reconnection not working
- **Check**: Look for "Core is already initialized" in console
- **Fix**: Clear localStorage and try again

### ❌ If Page Refreshes Multiple Times
- **Problem**: chainChanged still reloading
- **Check**: Look for reload messages in console
- **Fix**: Verify changes to `handleChainChanged` are applied

### ❌ If Can't Reconnect
- **Problem**: Cached provider not cleared
- **Check**: Try disconnecting from wallet app directly
- **Fix**: Clear localStorage manually

---

## Browser Console Commands

**Clear localStorage (force fresh start):**
```javascript
localStorage.clear()
location.reload()
```

**Check WalletConnect session:**
```javascript
localStorage.getItem('walletConnected')
```

**Check cached provider:**
```javascript
window.walletConnectProvider
```

---

## Success Criteria

All tests should pass with:
- ✅ No auto-showing QR modal on landing
- ✅ QR modal shows once when clicking Connect
- ✅ No page refresh loops
- ✅ Silent reconnection works
- ✅ Clean disconnect and reconnect flow

---

## If All Tests Pass

The WalletConnect fixes are working correctly! 🎉

You can now:
1. Test actual transactions (swap, stake)
2. Test on mobile devices
3. Deploy to production

---

## If Tests Fail

1. Check console logs for errors
2. Clear browser cache and localStorage
3. Restart dev server
4. Try in different browser
5. Check that all file changes were saved

