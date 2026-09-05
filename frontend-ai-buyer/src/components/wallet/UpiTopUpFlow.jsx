import { useRef, useState } from 'react';
import Button from '../ui/Button';
import { CloseIcon, CheckIcon } from '../ui/icons';

// Deliberately mismatched theme -- simulates a real third-party UPI app.

const AMOUNT_CHIPS = [1000, 3000, 5000, 10000];
const DAY_CHIPS = [30, 60, 90];

function todayLabel() {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).split('/').join('/');
}

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function PinInput({ length = 6, value, onChange, autoFocus }) {
  const refs = useRef([]);

  function setDigit(i, digit) {
    const chars = value.split('');
    chars[i] = digit;
    onChange(chars.join('').slice(0, length));
  }

  function handleChange(i, e) {
    const digit = e.target.value.replace(/\D/g, '').slice(-1);
    setDigit(i, digit);
    if (digit && i < length - 1) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="password"
          inputMode="numeric"
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          style={{
            width: '38px',
            height: '46px',
            textAlign: 'center',
            fontSize: '1.3rem',
            border: '1.5px solid #d0d5dd',
            borderRadius: '8px',
            background: '#fff',
            color: '#111'
          }}
        />
      ))}
    </div>
  );
}

const HEADER_BG = '#12295c';
const ACCENT = '#ff7a1a';
const GREEN = '#1a9e5c';

function AmountChip({ label, active, tag, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'relative',
        padding: tag ? '10px 14px 14px' : '10px 14px',
        borderRadius: '999px',
        border: active ? '1.5px solid #111' : '1.5px solid #e2e5ea',
        background: '#fff',
        color: '#111',
        fontSize: '0.85rem',
        fontWeight: active ? 700 : 500,
        cursor: 'pointer'
      }}
    >
      {label}
      {tag && (
        <span
          style={{
            position: 'absolute',
            bottom: '-8px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#e3f7ec',
            color: GREEN,
            fontSize: '0.55rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            padding: '2px 7px',
            borderRadius: '999px',
            whiteSpace: 'nowrap'
          }}
        >
          {tag}
        </span>
      )}
    </button>
  );
}

// Generic circles, not real UPI logos -- avoid brand marks.
const APP_SWATCHES = ['#1a9e5c', '#2f6fec', '#e56d24', '#7c5cff', '#e0457b'];

export default function UpiTopUpFlow({ onConfirm, onDone, onCancel }) {
  const [step, setStep] = useState('amount');
  const [amount, setAmount] = useState(5000);
  const [amountInput, setAmountInput] = useState('5000');
  const [endDate, setEndDate] = useState(addDaysISO(30));
  const [activeDays, setActiveDays] = useState(30);
  const [remark, setRemark] = useState('Reserve for AI Buyer');
  const [pin, setPin] = useState('');
  const [verifyText, setVerifyText] = useState('Verifying with your bank…');
  const [newBalance, setNewBalance] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  function chooseAmount(v) {
    setAmount(v);
    setAmountInput(String(v));
  }

  function chooseDays(days) {
    setActiveDays(days);
    setEndDate(addDaysISO(days));
  }

  const amountValid = Number(amountInput) > 0;

  async function handlePay() {
    setStep('verifying');
    setVerifyText('Verifying with your bank…');
    await new Promise((r) => setTimeout(r, 900));
    setVerifyText('Confirming with server…');
    try {
      const result = await onConfirm(amount);
      await new Promise((r) => setTimeout(r, 500));
      setNewBalance(result?.mandate?.razorpay_token?.remaining_balance ?? null);
      setStep('success');
    } catch (error) {
      setErrorMessage(error.message || 'Payment failed');
      setStep('failed');
    }
  }

  return (
    <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', maxWidth: '380px', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
      <div style={{ background: HEADER_BG, color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: ACCENT, display: 'inline-block' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', letterSpacing: '0.04em' }}>UPI RESERVE</span>
        </div>
        {step !== 'verifying' && step !== 'success' && (
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#fff', opacity: 0.7, display: 'flex' }} aria-label="Cancel">
            <CloseIcon size={15} />
          </button>
        )}
      </div>

      <div style={{ background: '#fff', color: '#111', padding: '20px 18px' }}>
        {step === 'amount' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f5f6f8', borderRadius: '14px', padding: '10px 12px', marginBottom: '18px' }}>
              <span style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#e2e5ea', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: '0.85rem' }}>AI Buyer — Wallet Top-Up</p>
                <p style={{ fontSize: '0.72rem', color: '#777' }}>UPI ID: aibuyer@upi</p>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#444', marginBottom: '8px' }}>Enter amount you want to reserve</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '16px' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 700 }}>₹</span>
              <input
                type="number"
                min="1"
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setAmount(Number(e.target.value) || 0);
                }}
                style={{ border: 'none', outline: 'none', fontSize: '2.1rem', fontWeight: 700, width: '100%', color: '#111' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '26px', flexWrap: 'wrap' }}>
              {AMOUNT_CHIPS.map((v, i) => (
                <AmountChip key={v} label={`₹${v.toLocaleString('en-IN')}`} active={amount === v} tag={i === AMOUNT_CHIPS.length - 1 ? 'MAXIMUM' : null} onClick={() => chooseAmount(v)} />
              ))}
            </div>

            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Start Date</p>
            <div style={{ border: '1.5px solid #e2e5ea', borderRadius: '10px', padding: '10px 12px', color: '#888', fontSize: '0.85rem', marginBottom: '16px' }}>{todayLabel()} (Today)</div>

            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>End Date</p>
            <input
              type="date"
              value={endDate}
              min={addDaysISO(0)}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActiveDays(null);
              }}
              style={{ width: '100%', border: '1.5px solid #e2e5ea', borderRadius: '10px', padding: '10px 12px', fontSize: '0.85rem', color: '#111', boxSizing: 'border-box', marginBottom: '14px' }}
            />
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {DAY_CHIPS.map((d, i) => (
                <AmountChip key={d} label={`${d} days`} active={activeDays === d} tag={i === DAY_CHIPS.length - 1 ? 'MAXIMUM' : null} onClick={() => chooseDays(d)} />
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', background: '#f5f6f8', borderRadius: '12px', padding: '12px', marginBottom: '18px' }}>
              <span style={{ fontSize: '0.9rem', lineHeight: 1, flexShrink: 0 }}>ⓘ</span>
              <p style={{ fontSize: '0.74rem', color: '#666', lineHeight: 1.5 }}>
                Confirming reserves ₹{amount || 0} in your AI Buyer wallet right away -- the agent can spend from it for future purchases until it runs out.
              </p>
            </div>

            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Remark</p>
            <input
              type="text"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              style={{ width: '100%', border: '1.5px solid #e2e5ea', borderRadius: '10px', padding: '10px 12px', fontSize: '0.85rem', color: '#111', boxSizing: 'border-box', marginBottom: '22px' }}
            />

            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#444', marginBottom: '10px' }}>Select app to proceed</p>
            <div style={{ display: 'flex', gap: '14px', marginBottom: '4px' }}>
              {APP_SWATCHES.map((color, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={!amountValid}
                  onClick={() => setStep('pin')}
                  aria-label="Pay with UPI app"
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    border: 'none',
                    background: color,
                    opacity: amountValid ? 1 : 0.4,
                    cursor: amountValid ? 'pointer' : 'not-allowed'
                  }}
                />
              ))}
            </div>
          </>
        )}

        {step === 'pin' && (
          <>
            <p style={{ fontSize: '0.8rem', color: '#555', marginBottom: '2px', fontWeight: 700 }}>RESERVING</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#555', marginBottom: '18px', borderTop: '1px dashed #d0d5dd', borderBottom: '1px dashed #d0d5dd', padding: '8px 0' }}>
              <span>AI Buyer — Wallet Top-Up</span>
              <span style={{ fontWeight: 700, color: '#111' }}>₹{amount}</span>
            </div>
            <p style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#555', marginBottom: '10px' }}>Enter UPI PIN</p>
            <PinInput length={6} value={pin} onChange={setPin} autoFocus />
            <Button
              variant="primary"
              disabled={pin.length !== 6}
              onClick={handlePay}
              style={{ width: '100%', marginTop: '20px', background: pin.length === 6 ? ACCENT : undefined, borderColor: pin.length === 6 ? ACCENT : undefined }}
            >
              Pay ₹{amount}
            </Button>
            <button onClick={() => setStep('amount')} style={{ display: 'block', margin: '10px auto 0', background: 'none', border: 'none', color: '#555', fontSize: '0.8rem', textDecoration: 'underline' }}>
              Back
            </button>
          </>
        )}

        {step === 'verifying' && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                border: `3px solid ${HEADER_BG}22`,
                borderTopColor: HEADER_BG,
                borderRadius: '50%',
                margin: '0 auto 16px',
                animation: 'upi-spin 0.8s linear infinite'
              }}
            />
            <style>{'@keyframes upi-spin { to { transform: rotate(360deg); } }'}</style>
            <p style={{ fontSize: '0.9rem', color: '#333' }}>{verifyText}</p>
          </div>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <CheckIcon size={22} />
            </div>
            <p style={{ fontWeight: 700, marginBottom: '4px' }}>Payment Successful</p>
            <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: newBalance != null ? '2px' : '18px' }}>₹{amount} added to your wallet</p>
            {newBalance != null && <p style={{ fontSize: '0.8rem', color: '#555', marginBottom: '18px' }}>New balance: ₹{newBalance}</p>}
            <Button variant="primary" onClick={onDone} style={{ width: '100%', background: ACCENT, borderColor: ACCENT }}>
              Done
            </Button>
          </div>
        )}

        {step === 'failed' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#c0392b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <CloseIcon size={22} />
            </div>
            <p style={{ fontWeight: 700, marginBottom: '4px' }}>Payment Failed</p>
            <p style={{ fontSize: '0.8rem', color: '#555', marginBottom: '18px' }}>{errorMessage}</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="ghost" onClick={onCancel} style={{ flex: 1 }}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setStep('pin')} style={{ flex: 1, background: ACCENT, borderColor: ACCENT }}>
                Retry
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
