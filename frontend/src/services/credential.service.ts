import { api } from '../api/client';

export interface Credential {
    id: string;
    studentId: string;
    institution: string;
    title: string;
    status: 'PENDING' | 'VERIFIED' | 'ISSUED' | 'REVOKED';
    issuedAt?: string;
    // ... other fields
}

export const CredentialService = {
    getAll: async () => {
        const response = await api.get<Credential[]>('/credentials');
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get<Credential>(`/credentials/${id}`);
        return response.data;
    },

    create: async (data: Partial<Credential>) => {
        const response = await api.post<Credential>('/credentials', data);
        return response.data;
    },

    updateStatus: async (id: string, status: string) => {
        const response = await api.put<Credential>(`/credentials/${id}/status`, { status });
        return response.data;
    }
};
