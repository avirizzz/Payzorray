import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

export default function MessageList({
  messages,
  onChangeStep,
  changeAllowed,
  customerId,
  streamedMessages,
  messageFeedback,
  onConfirmShoppingList,
  onEditShoppingList,
  shoppingListDraft,
  productScores,
  onPreviewOption,
  onConfirmCancellation,
  onDismissCancellation,
  onRemoveFromCart,
  onCartQtyChange,
  onCartCheckout,
  onRespondToUpsell,
  isThinking
}) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {messages.map((m, i) => (
        <MessageBubble
          key={i}
          message={m}
          canChange={changeAllowed && m.kind === 'options' && m.selectedId != null}
          onChange={() => onChangeStep?.(m.stepKey, i)}
          customerId={customerId}
          streamedMessages={streamedMessages}
          messageFeedback={messageFeedback}
          onConfirmShoppingList={onConfirmShoppingList}
          onEditShoppingList={onEditShoppingList}
          shoppingListDraft={shoppingListDraft}
          productScores={productScores}
          onPreviewOption={onPreviewOption}
          onConfirmCancellation={onConfirmCancellation}
          onDismissCancellation={onDismissCancellation}
          onRemoveFromCart={onRemoveFromCart}
          onCartQtyChange={onCartQtyChange}
          onCartCheckout={onCartCheckout}
          onRespondToUpsell={onRespondToUpsell}
          isLast={i === messages.length - 1}
          isThinking={isThinking}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
