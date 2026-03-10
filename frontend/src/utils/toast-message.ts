export { toErrorMessage } from './errors';

export const toSuccessMessage = (entity: string, action: string): string => `${entity} ${action} successfully.`;
