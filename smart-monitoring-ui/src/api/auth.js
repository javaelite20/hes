import client from './client'

export const login = (userId, password) =>
  client.post('/auth/login', { userId, password }).then((r) => r.data)

export const register = (data) =>
  client.post('/auth/register', data).then((r) => r.data)
