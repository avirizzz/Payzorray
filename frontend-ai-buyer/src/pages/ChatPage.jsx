import { useEffect, useRef, useState } from 'react';
import { useAiBuyer } from '../context/AiBuyerContext';
import { merchantName } from '../hooks/useAiBuyerConversation';
import MessageList from '../components/chat/MessageList';
import ChatInput from '../components/chat/ChatInput';
import ProductOptionStack from '../components/chat/ProductOptionStack';
import ProductPreviewModal from '../components/chat/ProductPreviewModal';
import CheckoutModal from '../components/chat/CheckoutModal';
import CartCheckoutModal from '../components/chat/CartCheckoutModal';
import CartPopup from '../components/chat/CartPopup';
import ShoppingListTemplate from '../components/chat/ShoppingListTemplate';
import TokenConfirmCard from '../components/chat/TokenConfirmCard';
import TrackingCard from '../components/chat/TrackingCard';
import TypingIndicator from '../components/chat/TypingIndicator';
import { CartIcon } from '../components/ui/icons';

const STARTER_PROMPTS = [
  'What can you help me with?',
  'Tell me something interesting',
  'Help me think through a decision',
  'Surprise me'
];

export default function ChatPage() {
  const [previewPick, setPreviewPick] = useState(null);
  // tailRef scrolls to new cards rendered after MessageList's own scroll.
  const tailRef = useRef(null);
  const {
    messages,
    pendingProducts,
    productScores,
    scoresLoading,
    previewProductId,
    setPreviewProductId,
    awaitingAddress,
    addressSuggestions,
    pendingCheckout,
    pendingPayment,
    pendingTracking,
    isThinking,
    selectedProduct,
    selectedAddress,
    cart,
    checkoutMode,
    customerId,
    shoppingListOpen,
    shoppingListDraft,
    openShoppingList,
    closeShoppingList,
    submitShoppingList,
    cartPopupOpen,
    openCartPopup,
    closeCartPopup,
    sendMessage,
    respondToUpsell,
    compareSelected,
    confirmCancellation,
    dismissCancellation,
    handlePreviewSelect,
    handlePreviewAddToCart,
    removeFromCart,
    updateCartItemQuantity,
    confirmShoppingListPicks,
    handleCheckoutConfirm,
    handleConfirmPayment,
    handleOneTimeCheckout,
    rewindOptionsStep,
    dismissTracking,
    cancelFlow,
    pushTrace,
    streamedMessages,
    messageFeedback
  } = useAiBuyer();

  useEffect(() => {
    if (!pendingProducts && !pendingPayment && !pendingTracking) return;
    tailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [pendingProducts, pendingPayment, pendingTracking]);

  const blocksInput = pendingCheckout || !!pendingPayment;
  const inputDisabled = blocksInput || isThinking;
  const hasActiveFlow = !!pendingProducts || awaitingAddress || pendingCheckout || !!pendingPayment || !!pendingTracking;
  const canCancel = (!!pendingProducts || awaitingAddress) && !isThinking;
  const isEmpty = messages.length === 0 && !hasActiveFlow && !isThinking;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {isEmpty ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', padding: '0 var(--space-4)', textAlign: 'center' }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: '14px' }}>AI Assistant</p>
            <h1 style={{ fontSize: 'var(--text-4xl)', marginBottom: '14px' }}>What can I help with?</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-md)', maxWidth: '460px', margin: '0 auto' }}>
              Ask me anything. I'll look into it, think it through, and give you an honest, straight answer.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '540px' }}>
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="glass press-on-active"
                style={{
                  borderRadius: 'var(--radius)',
                  padding: '9px 16px',
                  color: '#ffffff',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ maxWidth: '720px', margin: '0 auto', padding: 'var(--space-4) var(--space-4) var(--space-2)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <MessageList
              messages={messages}
              onChangeStep={rewindOptionsStep}
              changeAllowed={!pendingPayment && !pendingTracking}
              customerId={customerId}
              streamedMessages={streamedMessages}
              messageFeedback={messageFeedback}
              onConfirmShoppingList={confirmShoppingListPicks}
              onEditShoppingList={openShoppingList}
              shoppingListDraft={shoppingListDraft}
              productScores={productScores}
              onPreviewOption={(id, pick) => {
                setPreviewPick(() => pick);
                setPreviewProductId(id);
              }}
              onRemoveFromCart={removeFromCart}
              onCartQtyChange={updateCartItemQuantity}
              onCartCheckout={() => sendMessage('/checkout')}
              onRespondToUpsell={respondToUpsell}
              onConfirmCancellation={confirmCancellation}
              onDismissCancellation={dismissCancellation}
              isThinking={isThinking}
            />

            {isThinking && !hasActiveFlow && (
              <div style={{ paddingLeft: '0' }}>
                <TypingIndicator />
              </div>
            )}

            {pendingProducts && (
              <ProductOptionStack
                products={pendingProducts}
                onPreview={(id) => {
                  setPreviewPick(null);
                  setPreviewProductId(id);
                }}
                onCompare={compareSelected}
                disabled={isThinking}
                scores={productScores}
              />
            )}

            {pendingPayment && (
              <TokenConfirmCard
                amount={pendingPayment.amount}
                currency={pendingPayment.currency}
                productName={pendingPayment.productName}
                walletAvailable={pendingPayment.walletAvailable}
                walletReason={pendingPayment.walletReason}
                walletStatus={pendingPayment.walletStatus}
                checkoutStatus={pendingPayment.checkoutStatus}
                onConfirmWallet={handleConfirmPayment}
                onConfirmCheckout={handleOneTimeCheckout}
                onCancel={cancelFlow}
              />
            )}

            {pendingTracking && <TrackingCard {...pendingTracking} onDismiss={dismissTracking} />}

            <div ref={tailRef} />
          </div>
        </div>
      )}

      <ProductPreviewModal
        onPickOption={previewPick}
        fit={productScores?.[previewProductId] || null}
        fitLoading={scoresLoading}
        productId={previewProductId}
        customerId={customerId}
        cartVendor={cart?.merchantId}
        onClose={() => setPreviewProductId(null)}
        onSelect={handlePreviewSelect}
        onAddToCart={handlePreviewAddToCart}
        onTrace={pushTrace}
      />

      {pendingCheckout && checkoutMode === 'cart' && cart?.items?.length > 0 && selectedAddress && (
        <CartCheckoutModal cart={cart} address={selectedAddress} customerId={customerId} onConfirm={handleCheckoutConfirm} onCancel={cancelFlow} onTrace={pushTrace} />
      )}

      {pendingCheckout && checkoutMode !== 'cart' && selectedProduct && selectedAddress && (
        <CheckoutModal
          product={selectedProduct}
          address={selectedAddress}
          customerId={customerId}
          onConfirm={handleCheckoutConfirm}
          onCancel={cancelFlow}
          onChangeProduct={() => rewindOptionsStep('product')}
          onTrace={pushTrace}
        />
      )}

      <ShoppingListTemplate open={shoppingListOpen} onClose={closeShoppingList} onSubmit={submitShoppingList} initialItems={shoppingListDraft} />

      {cartPopupOpen && cart?.items?.length > 0 && (
        <CartPopup
          cart={cart}
          customerId={customerId}
          onPreview={(id) => {
            setPreviewPick(null);
            setPreviewProductId(id);
          }}
          onRemove={removeFromCart}
          onQtyChange={updateCartItemQuantity}
          onClose={closeCartPopup}
          onCheckout={() => {
            closeCartPopup();
            sendMessage('/checkout');
          }}
        />
      )}

      <div style={{ padding: isEmpty ? '0 var(--space-4) var(--space-6)' : '0 var(--space-4) var(--space-4)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          {cart?.items?.length > 0 && !pendingCheckout && !pendingPayment && (
            <button
              onClick={openCartPopup}
              className="glass press-on-active"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                marginBottom: '8px',
                padding: '7px 12px',
                borderRadius: 'var(--radius)',
                color: '#ffffff',
                fontSize: 'var(--text-xs)',
                fontWeight: 700
              }}
            >
              <CartIcon size={13} style={{ color: 'var(--color-blue)' }} />
              {cart.items.length} item{cart.items.length > 1 ? 's' : ''} in cart from {merchantName(cart.merchantId)} — view cart
            </button>
          )}
          {canCancel && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <button
                onClick={cancelFlow}
                className="press-on-active"
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Cancel and keep chatting
              </button>
            </div>
          )}
          <ChatInput
            onSend={sendMessage}
            disabled={inputDisabled}
            placeholder={awaitingAddress ? 'Type an address nickname, or ask something else…' : undefined}
            suggestions={awaitingAddress ? addressSuggestions : null}
          />
        </div>
      </div>
    </div>
  );
}
