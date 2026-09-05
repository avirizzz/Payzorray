import { useCallback, useEffect, useState } from 'react';
import { getProfile, updateProfile, AI_BUYER_PERSONA_ID } from '../api/profile';
import { getPersona, savePersona, getWalletStatus } from '../api/agent';
import { listAddresses, addAddress, updateAddress, deleteAddress } from '../api/addresses';
import { getSpendingStats } from '../api/commerce';
import { requestMandate, approveMandate, declineMandate, topUpMandate, editMandateCap } from '../api/mandates';
import { issueToken, revokeToken } from '../api/agentTokens';
import { createCardSetupOrder, saveCardFromPayment } from '../api/payments';
import { openRazorpayCheckout } from '../services/razorpayCheckout';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import MandateSetupForm from '../components/wallet/MandateSetupForm';
import SimulatedBankApproval from '../components/wallet/SimulatedBankApproval';
import UpiTopUpFlow from '../components/wallet/UpiTopUpFlow';
import AddressForm from '../components/profile/AddressForm';
import { PlusIcon, PencilIcon, TrashIcon, MapPinIcon, OrdersIcon, ChartIcon } from '../components/ui/icons';

const fieldInput = {
  border: '1px solid var(--glass-border-strong)',
  borderRadius: 'var(--radius)',
  padding: '10px 12px',
  fontFamily: 'var(--font-body)',
  background: 'rgba(0,0,0,0.2)',
  color: '#ffffff',
  fontSize: 'var(--text-sm)',
  width: '100%',
  boxSizing: 'border-box'
};

const fieldLabel = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' };

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [identityDraft, setIdentityDraft] = useState({ name: '', email: '', phone: '' });
  const [identityBusy, setIdentityBusy] = useState(false);
  const [identityError, setIdentityError] = useState(null);
  const [persona, setPersona] = useState('');
  const [personaDraft, setPersonaDraft] = useState('');
  const [personaBusy, setPersonaBusy] = useState(false);
  const [personaError, setPersonaError] = useState(null);
  const [mandate, setMandate] = useState(null);
  const [pendingMandate, setPendingMandate] = useState(null);
  const [token, setToken] = useState(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState(null);
  const [pendingTopUp, setPendingTopUp] = useState(false);
  const [editingCap, setEditingCap] = useState(false);
  const [capDraft, setCapDraft] = useState('');
  const [capBusy, setCapBusy] = useState(false);
  const [capError, setCapError] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [addressForm, setAddressForm] = useState(null);
  const [addressBusy, setAddressBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const data = await getProfile(AI_BUYER_PERSONA_ID);
    setProfile(data);
    const personaText = await getPersona(data.customer_id).catch(() => '');
    setPersona(personaText);
    setPersonaDraft(personaText);
    const wallet = await getWalletStatus(data.customer_id).catch(() => ({ mandate: null, token: null }));
    setMandate(wallet.mandate?.status === 'ACTIVE' ? wallet.mandate : null);
    setToken(wallet.token);
    setAddresses(await listAddresses().catch(() => []));
    setStats(await getSpendingStats(data.customer_id).catch(() => null));
  }, []);

  useEffect(() => {
    reload()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [reload]);

  function handleStartEditIdentity() {
    setIdentityDraft({ name: profile.name || '', email: profile.email || '', phone: profile.phone || '' });
    setIdentityError(null);
    setEditingIdentity(true);
  }

  async function handleSaveIdentity() {
    setIdentityBusy(true);
    setIdentityError(null);
    try {
      await updateProfile(identityDraft);
      await reload();
      setEditingIdentity(false);
    } catch (err) {
      setIdentityError(err.message);
    } finally {
      setIdentityBusy(false);
    }
  }

  async function handleSavePersona() {
    setPersonaBusy(true);
    setPersonaError(null);
    try {
      const saved = await savePersona(profile.customer_id, personaDraft);
      setPersona(saved);
    } catch (err) {
      setPersonaError(err.message);
    } finally {
      setPersonaBusy(false);
    }
  }

  async function handleAddressSubmit(form) {
    setAddressBusy(true);
    try {
      if (addressForm && addressForm !== 'new') {
        await updateAddress(addressForm.id, form);
      } else {
        await addAddress({ ...form, is_default: addresses.length === 0 });
      }
      setAddressForm(null);
      setAddresses(await listAddresses());
    } catch (err) {
      setError(err.message);
    } finally {
      setAddressBusy(false);
    }
  }

  async function handleDeleteAddress(id) {
    setDeletingId(id);
    try {
      await deleteAddress(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleMandateSubmit({ amount, expireAt, frequency }) {
    setWalletBusy(true);
    setWalletError(null);
    try {
      const { mandate: created } = await requestMandate({
        customer_id: profile.customer_id,
        caller_type: profile.caller_type,
        amount,
        frequency,
        expire_at: expireAt
      });
      setPendingMandate(created);
    } catch (err) {
      setWalletError(err.message);
    } finally {
      setWalletBusy(false);
    }
  }

  // Real ₹1 verification charge; mandate itself stays simulated:true on purpose.
  async function handleApprove() {
    setWalletBusy(true);
    setWalletError(null);
    try {
      const order = await createCardSetupOrder({ customerId: profile.customer_id, name: profile.name, email: profile.email, contact: profile.phone });
      const response = await openRazorpayCheckout({
        key: order.key_id,
        order_id: order.order_id,
        razorpay_customer_id: order.razorpay_customer_id,
        amount: order.amount,
        currency: order.currency,
        name: 'AI Buyer',
        description: 'Wallet verification — real ₹1 payment',
        prefill: { name: profile.name, email: profile.email, contact: profile.phone },
        save: true
      });
      await saveCardFromPayment(profile.customer_id, response.razorpay_payment_id).catch(() => null);
      await approveMandate(pendingMandate.approval_id);
      setPendingMandate(null);
      await reload();
    } catch (err) {
      setWalletError(err.message);
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleDecline() {
    setWalletBusy(true);
    setWalletError(null);
    try {
      await declineMandate(pendingMandate.approval_id);
      setPendingMandate(null);
    } catch (err) {
      setWalletError(err.message);
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleIssueToken() {
    setWalletBusy(true);
    setWalletError(null);
    try {
      await issueToken(mandate.approval_id);
      await reload();
    } catch (err) {
      setWalletError(err.message);
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleRevokeToken() {
    setWalletBusy(true);
    setWalletError(null);
    try {
      await revokeToken(token.id);
      await reload();
    } catch (err) {
      setWalletError(err.message);
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleTopUpConfirm(amount) {
    const result = await topUpMandate(mandate.approval_id, amount);
    if (result.status !== 'MANDATE_TOPPED_UP') {
      throw new Error(result.reason || 'Top-up failed');
    }
    return result;
  }

  async function handleTopUpDone() {
    setPendingTopUp(false);
    await reload();
  }

  function handleStartEditCap() {
    setCapDraft(String(mandate.razorpay_token.original_max_amount));
    setCapError(null);
    setEditingCap(true);
  }

  // Backend rejects lowering the cap below what's already spent.
  async function handleSaveCap(e) {
    e.preventDefault();
    const parsed = Number(capDraft);
    if (!parsed || parsed <= 0) return;
    setCapBusy(true);
    setCapError(null);
    try {
      const result = await editMandateCap(mandate.approval_id, parsed);
      if (result.status !== 'MANDATE_CAP_UPDATED') {
        setCapError(result.reason || "Couldn't update the cap");
        return;
      }
      setEditingCap(false);
      await reload();
    } catch (err) {
      setCapError(err.message);
    } finally {
      setCapBusy(false);
    }
  }

  if (loading) return <div style={{ padding: 'var(--space-4)' }}>Loading…</div>;
  if (error) return <div style={{ padding: 'var(--space-4)', color: 'var(--color-danger)', fontWeight: 700 }}>Error: {error}</div>;
  if (!profile) return null;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', width: '100%', padding: 'var(--space-4)', overflowY: 'auto' }}>
      <p className="eyebrow" style={{ marginBottom: '8px' }}>Account</p>
      <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-3)' }}>Your Profile</h2>

      <Card variant="loud" className="signature-edge" style={{ marginBottom: 'var(--space-2)' }}>
        {editingIdentity ? (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
              <label style={fieldLabel}>
                Name
                <input value={identityDraft.name} onChange={(e) => setIdentityDraft((d) => ({ ...d, name: e.target.value }))} style={fieldInput} />
              </label>
              <label style={fieldLabel}>
                Email
                <input value={identityDraft.email} onChange={(e) => setIdentityDraft((d) => ({ ...d, email: e.target.value }))} style={fieldInput} type="email" />
              </label>
              <label style={fieldLabel}>
                Phone
                <input value={identityDraft.phone} onChange={(e) => setIdentityDraft((d) => ({ ...d, phone: e.target.value }))} style={fieldInput} />
              </label>
            </div>
            {identityError && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '10px' }}>{identityError}</p>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="ghost" onClick={() => setEditingIdentity(false)} disabled={identityBusy} style={{ flex: 1 }}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveIdentity} disabled={identityBusy} style={{ flex: 1 }}>
                {identityBusy ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                flexShrink: 0,
                background: 'var(--gradient-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 'var(--text-lg)'
              }}
            >
              {profile.name?.[0] || 'A'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: '2px' }}>{profile.name}</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{profile.email}</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{profile.phone}</p>
            </div>
            <button
              onClick={handleStartEditIdentity}
              aria-label="Edit profile"
              className="press-on-active"
              style={{ width: '32px', height: '32px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)' }}
            >
              <PencilIcon size={13} />
            </button>
          </div>
        )}
      </Card>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: 'var(--space-3)' }}>
          <Card style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: 'rgba(13,148,251,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <OrdersIcon size={15} style={{ color: 'var(--color-blue)' }} />
            </div>
            <div>
              <p className="gauge-number" style={{ fontWeight: 700, fontSize: 'var(--text-lg)', lineHeight: 1 }}>{stats.order_count}</p>
              <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Orders placed</p>
            </div>
          </Card>
          <Card style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: 'rgba(13,148,251,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ChartIcon size={15} style={{ color: 'var(--color-blue)' }} />
            </div>
            <div>
              <p className="gauge-number" style={{ fontWeight: 700, fontSize: 'var(--text-lg)', lineHeight: 1 }}>₹{stats.total_spend}</p>
              <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Total spent</p>
            </div>
          </Card>
        </div>
      )}

      <p className="eyebrow" style={{ marginBottom: '6px' }}>Agent memory</p>
      <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-1)' }}>Shopping Preferences</h3>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
        The agent reads this before every search and weights results toward it — it never invents a match that isn't real.
      </p>
      <Card style={{ marginBottom: 'var(--space-3)' }}>
        <textarea
          value={personaDraft}
          onChange={(e) => setPersonaDraft(e.target.value)}
          placeholder="e.g. I like JDM cars, prefer blue color schemes, budget usually under ₹1500"
          rows={3}
          style={{ ...fieldInput, resize: 'vertical', marginBottom: '10px' }}
        />
        {personaError && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '10px' }}>{personaError}</p>}
        <Button variant="ghost" onClick={handleSavePersona} disabled={personaBusy || personaDraft === persona}>
          {personaBusy ? 'Saving…' : 'Save Preferences'}
        </Button>
      </Card>

      <p className="eyebrow" style={{ marginBottom: '6px' }}>Address book</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
        <h3 style={{ fontSize: 'var(--text-lg)' }}>Delivery Addresses</h3>
        <button
          onClick={() => setAddressForm('new')}
          className="press-on-active"
          style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: 'var(--color-blue)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer' }}
        >
          <PlusIcon size={13} />
          Add address
        </button>
      </div>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
        Give each one a nickname — in chat, just type it (e.g. "home") to pick where an order should ship.
      </p>
      <div style={{ marginBottom: 'var(--space-3)' }}>
        {addresses.length === 0 ? (
          <Card style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>No saved addresses yet — add one so the agent can ship to it.</Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {addresses.map((a) => (
              <Card key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px' }}>
                <MapPinIcon size={16} style={{ color: 'var(--color-blue)', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: '2px' }}>{a.label}</p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.postal_code}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button
                    onClick={() => setAddressForm(a)}
                    aria-label="Edit address"
                    className="press-on-active"
                    style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: '50%', color: 'var(--color-text-muted)' }}
                  >
                    <PencilIcon size={12} />
                  </button>
                  <button
                    onClick={() => handleDeleteAddress(a.id)}
                    disabled={deletingId === a.id}
                    aria-label="Delete address"
                    className="press-on-active"
                    style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: '50%', color: 'var(--color-danger)' }}
                  >
                    <TrashIcon size={12} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {addressForm && (
        <AddressForm
          initialValue={addressForm !== 'new' ? addressForm : undefined}
          onSubmit={handleAddressSubmit}
          onCancel={() => setAddressForm(null)}
          busy={addressBusy}
        />
      )}

      <p className="eyebrow" style={{ marginBottom: '6px' }}>Spending cap</p>
      <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-1)' }}>UPI Reserve Pay</h3>
      {walletError && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '10px' }}>{walletError}</p>}
      <div style={{ marginBottom: 'var(--space-3)' }}>
        {pendingMandate ? (
          <SimulatedBankApproval
            mandate={pendingMandate}
            onApprove={handleApprove}
            onDecline={handleDecline}
            busy={walletBusy}
            title="Wallet Setup Verification"
            confirmLabel="Verify with ₹1 & Activate"
            note="This opens a real Razorpay payment for ₹1 to verify your payment method — that ₹1 is genuinely charged. Once active, the agent's purchases against this cap are confirmed with you and debited as simulated charges, not further real Razorpay payments."
          />
        ) : !mandate ? (
          <MandateSetupForm onSubmit={handleMandateSubmit} busy={walletBusy} />
        ) : pendingTopUp ? (
          <UpiTopUpFlow onConfirm={handleTopUpConfirm} onDone={handleTopUpDone} onCancel={() => setPendingTopUp(false)} />
        ) : (
          <Card variant="loud" className="signature-edge" style={{ paddingTop: 'calc(var(--space-2) + 4px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <p style={{ fontWeight: 700 }}>Spending cap active</p>
              {!editingCap && (
                <button
                  onClick={handleStartEditCap}
                  aria-label="Edit cap"
                  className="press-on-active"
                  style={{ width: '26px', height: '26px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)' }}
                >
                  <PencilIcon size={11} />
                </button>
              )}
            </div>

            {editingCap ? (
              <form onSubmit={handleSaveCap} style={{ marginBottom: '14px' }}>
                <label style={fieldLabel}>
                  Max amount (₹)
                  <input type="number" min="1" step="1" value={capDraft} onChange={(e) => setCapDraft(e.target.value)} style={fieldInput} autoFocus />
                </label>
                {capError && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 700, marginTop: '8px' }}>{capError}</p>}
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <Button type="button" variant="ghost" onClick={() => setEditingCap(false)} disabled={capBusy} style={{ flex: 1 }}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={capBusy} style={{ flex: 1 }}>
                    {capBusy ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: '6px' }}>
                  <span className="gauge-number" style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>₹{mandate.razorpay_token.remaining_balance}</span>
                  <span style={{ color: 'var(--color-text-muted)', alignSelf: 'flex-end' }}>of ₹{mandate.razorpay_token.original_max_amount}</span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: '14px' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.max(4, Math.min(100, (mandate.razorpay_token.remaining_balance / mandate.razorpay_token.original_max_amount) * 100))}%`,
                      background: 'var(--gradient-accent)',
                      borderRadius: '3px'
                    }}
                  />
                </div>
              </>
            )}

            {token ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Badge color="rgba(13,148,251,0.14)">Token Active</Badge>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>The agent can check out with your confirmation, no re-approval needed each time.</span>
                </div>
                <Button variant="ghost" onClick={handleRevokeToken} disabled={walletBusy}>
                  {walletBusy ? 'Revoking…' : 'Revoke Token'}
                </Button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '10px' }}>No active token — the agent can't check out until you issue one.</p>
                <Button variant="primary" onClick={handleIssueToken} disabled={walletBusy}>
                  {walletBusy ? 'Issuing…' : 'Issue AI Buyer Token'}
                </Button>
              </>
            )}

            <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '14px', paddingTop: '14px' }}>
              <Button variant="ghost" onClick={() => setPendingTopUp(true)}>
                <PlusIcon size={13} style={{ marginRight: '5px' }} />
                Add More Money
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
