import dotenv from 'dotenv';

dotenv.config();

const parseRequired = (value: string | undefined, key: string): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${key} is required for blockchain-interface-service.`);
  }
  return trimmed;
};

const parseOptional = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 5400,
  RPC_URL: parseOptional(process.env.BLOCKCHAIN_RPC_URL) || 'http://127.0.0.1:7546',
  PRIVATE_KEY: parseOptional(process.env.BLOCKCHAIN_PRIVATE_KEY),
  CONTRACT_ADDRESS: parseOptional(process.env.BLOCKCHAIN_CONTRACT_ADDRESS),
  CHAIN_NAME: parseOptional(process.env.BLOCKCHAIN_CHAIN_NAME) || 'EVM',
  INTERNAL_SERVICE_TOKEN: parseOptional(process.env.INTERNAL_SERVICE_TOKEN),
  HASH_HMAC_SECRET: parseRequired(process.env.BLOCKCHAIN_HASH_HMAC_SECRET, 'BLOCKCHAIN_HASH_HMAC_SECRET'),
};

if (!ENV.INTERNAL_SERVICE_TOKEN || ENV.INTERNAL_SERVICE_TOKEN.trim().length === 0) {
  throw new Error('INTERNAL_SERVICE_TOKEN is required for blockchain-interface-service.');
}
