const { z } = require('zod');

const ProductSchema = z.object({
  product_id: z.string(),
  name: z.string(),
  category: z.string(),
  brand: z.string(),
  model: z.string().optional(),
  variant: z.string().optional(),
  specifications: z.record(z.unknown()),
  description: z.string(),
  tags: z.array(z.string()),
  price: z.number().positive(),
  currency: z.string().default('INR'),
  stock: z.number().int().nonnegative(),
  images: z.array(z.string().url()),
  product_relationships: z.array(z.string()).default([]),
  compatibility: z.array(z.string()).default([]),
  bundle_relationships: z.array(z.string()).default([]),
  merchant_id: z.string(),
  updated_at: z.string().datetime()
});

const HardConstraintSchema = z.object({
  type: z.string(),
  value: z.union([z.number(), z.string()]),
  hard: z.literal(true)
});

const SoftPreferenceSchema = z.object({
  type: z.string(),
  value: z.union([z.number(), z.string(), z.array(z.string())]),
  hard: z.literal(false),
  weight: z.number().min(0).max(1)
});

const IntentSchema = z.object({
  intent: z.enum(['PRODUCT_SEARCH', 'GENERAL_INQUIRY', 'CREATE_ORDER']),
  product: z.object({
    category: z.string().optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    variant: z.string().optional()
  }).optional(),
  hard_constraints: z.record(z.union([z.number(), z.string()])).optional(),
  soft_preferences: z.record(z.union([z.string(), z.array(z.string())])).optional(),
  purpose: z.string().optional(),
  missing_information: z.array(z.string()).default([]),
  confidence: z.record(z.number().min(0).max(1)).optional()
});

const ConversationStateSchema = z.object({
  conversation_id: z.string(),
  intent: z.record(z.unknown()).optional(),
  preferences: z.record(z.unknown()).optional(),
  missing_information: z.array(z.string()).default([]),
  selected_product: z.string().nullable(),
  authorization: z.string().nullable()
});

const MandateStatusEnum = z.enum(['PENDING', 'ACTIVE', 'CONSUMED', 'EXPIRED', 'CANCELLED']);
const CallerTypeEnum = z.enum(['HUMAN_CHATBOT', 'AI_BUYER_AGENT']);

const MandateSchema = z.object({
  approval_id: z.string(),
  razorpay_token: z.object({
    original_max_amount: z.number().positive(),
    remaining_balance: z.number().nonnegative(),
    expire_at: z.number().int().positive(),
    frequency: z.string()
  }),
  razorpay_token_id: z.string().nullable().optional(),
  issued_to: z.object({
    caller_type: CallerTypeEnum,
    customer_id: z.string()
  }),
  product_ids: z.array(z.string()),
  quantity: z.number().int().positive(),
  currency: z.string().default('INR'),
  status: MandateStatusEnum
});

const AuditRecordSchema = z.object({
  timestamp: z.string().datetime(),
  conversation_id: z.string(),
  actor: z.string(),
  action: z.string(),
  product_id: z.string().optional(),
  amount: z.number().optional(),
  decision: z.enum(['ALLOWED', 'DENIED', 'REQUIRE_REAUTHORIZATION', 'ESCALATE']),
  reason: z.string(),
  policy_version: z.string(),
  approval_id: z.string().optional(),
  result: z.string()
});

module.exports = {
  ProductSchema,
  HardConstraintSchema,
  SoftPreferenceSchema,
  IntentSchema,
  ConversationStateSchema,
  MandateSchema,
  AuditRecordSchema,
  MandateStatusEnum,
  CallerTypeEnum
};
