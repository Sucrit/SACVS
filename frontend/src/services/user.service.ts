import { api } from '../api/client';

export interface User {
    id: string;
    name: string;
    email: string;
    role: 'STUDENT' | 'REGISTRAR' | 'ADMIN';
    status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
}

export const UserService = {
    getProfile: async () => {
        const response = await api.get<User>('/users/me'); // Assuming /me exists or handle by ID
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get<User>(`/users/${id}`);
        return response.data;
    },

    updateStatus: async (id: string, status: string) => {
        const response = await api.put<User>(`/users/${id}/status`, { status });
        return response.data;
    }
};
