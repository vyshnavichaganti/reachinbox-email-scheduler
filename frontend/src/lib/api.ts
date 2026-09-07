import type {
  Email,
  PaginatedResponse,
  Sender,
  SlackStatus,
  User,
} from '../types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BACKEND_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const defaultHeaders: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body && !(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...(options.headers as Record<string, string>),
    },
  };

  const response = await fetch(url, config);

  if (response.status === 204) {
    return {} as T;
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }
    return {} as T;
  }

  if (!response.ok || data.success === false) {
    const errorMessage =
      data.error?.message || data.message || `Request failed with status ${response.status}`;
    throw new ApiError(errorMessage, response.status, data.error?.details || data.details);
  }

  return data as T;
}

export const api = {
  // Auth APIs
  getAuthMe: async (): Promise<{ success: boolean; data: User }> => {
    return request<{ success: boolean; data: User }>('/api/auth/me');
  },

  logout: async (): Promise<{ success: boolean; message: string }> => {
    return request<{ success: boolean; message: string }>('/api/auth/logout', {
      method: 'POST',
    });
  },

  getGoogleAuthUrl: (): string => {
    return `${BACKEND_URL}/api/auth/google`;
  },

  // Sender APIs
  getSenders: async (): Promise<{ success: boolean; data: Sender[] }> => {
    return request<{ success: boolean; data: Sender[] }>('/api/senders');
  },

  // Email Listing & Search APIs
  getScheduledEmails: async (
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<Email>> => {
    return request<PaginatedResponse<Email>>(`/api/emails/scheduled?page=${page}&limit=${limit}`);
  },

  getSentEmails: async (
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<Email>> => {
    return request<PaginatedResponse<Email>>(`/api/emails/sent?page=${page}&limit=${limit}`);
  },

  searchEmails: async (params: {
    q?: string;
    status?: string;
    senderId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Email>> => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.append('q', params.q);
    if (params.status) searchParams.append('status', params.status);
    if (params.senderId) searchParams.append('senderId', params.senderId);
    searchParams.append('page', String(params.page || 1));
    searchParams.append('limit', String(params.limit || 20));

    return request<PaginatedResponse<Email>>(`/api/emails/search?${searchParams.toString()}`);
  },

  getEmailById: async (id: string): Promise<{ success: boolean; data: Email }> => {
    return request<{ success: boolean; data: Email }>(`/api/emails/${id}`);
  },

  cancelEmail: async (id: string): Promise<{ success: boolean; data: Email }> => {
    return request<{ success: boolean; data: Email }>(`/api/emails/${id}`, {
      method: 'DELETE',
    });
  },

  // Scheduling APIs
  scheduleEmail: async (input: {
    userId: string;
    senderId: string;
    recipient: string;
    subject: string;
    body: string;
    scheduledAt: string;
    idempotencyKey: string;
  }): Promise<{ success: boolean; data: Email }> => {
    return request<{ success: boolean; data: Email }>('/api/emails/schedule', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  bulkScheduleEmails: async (input: {
    userId: string;
    senderId: string;
    recipients: string[];
    subject: string;
    body: string;
    startTime: string;
    delayBetweenMs: number;
  }): Promise<{ success: boolean; data: { scheduledCount: number; emails: Email[] } }> => {
    return request<{ success: boolean; data: { scheduledCount: number; emails: Email[] } }>(
      '/api/emails/bulk-schedule',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  },

  // Slack Integration APIs
  getSlackConnectUrl: (): string => {
    return `${BACKEND_URL}/api/slack/connect`;
  },

  getSlackStatus: async (): Promise<{ success: boolean; data: SlackStatus }> => {
    return request<{ success: boolean; data: SlackStatus }>('/api/slack/status');
  },

  disconnectSlack: async (): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>('/api/slack/disconnect', {
      method: 'DELETE',
    });
  },
};
export { ApiError };
