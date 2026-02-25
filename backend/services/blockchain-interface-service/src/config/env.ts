import dotenv from 'dotenv';

dotenv.config();

const parseOptional = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const ENV = {
  PORT: Number(process.env.PORT) || 5400,
  RPC_URL: parseOptional(process.env.BLOCKCHAIN_RPC_URL) || 'http://127.0.0.1:7545',
  PRIVATE_KEY: parseOptional(process.env.BLOCKCHAIN_PRIVATE_KEY),
  CONTRACT_ADDRESS: parseOptional(process.env.BLOCKCHAIN_CONTRACT_ADDRESS),
  CHAIN_NAME: parseOptional(process.env.BLOCKCHAIN_CHAIN_NAME) || 'EVM',
  INTERNAL_SERVICE_TOKEN: parseOptional(process.env.INTERNAL_SERVICE_TOKEN),
};
