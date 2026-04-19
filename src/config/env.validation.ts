import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(5000),

  DATABASE_URL: Joi.string().uri().required(),

  TELEGRAM_BOT_TOKEN: Joi.string().required(),
  MINIAPP_URL: Joi.string().uri().required(),

  SCASH_RPC_URL: Joi.string().uri().required(),
  SCASH_RPC_USER: Joi.string().required(),
  SCASH_RPC_PASS: Joi.string().required(),

  ZMQ_BLOCK_URL: Joi.string().required(),
  ZMQ_TX_URL: Joi.string().required(),

  BLOCK_SYNC_START_HEIGHT: Joi.number().integer().min(0).optional(),

  MASTER_KEY: Joi.string().min(16).required(),
  COORDINATION_ACCOUNT_MNEMONIC: Joi.string().min(20).required(),
});
