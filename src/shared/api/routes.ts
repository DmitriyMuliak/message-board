export const apiRoutes = {
  messages: {
    base: '/api/messages',
    byId: (id: string) => `/api/messages/${id}`,
  },
} as const;
