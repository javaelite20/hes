import client from './client'

export const login = (loginId, password) =>
  client.post('/auth/login', { loginId, password }).then((r) => r.data)

export const register = (data) =>
  client.post('/auth/register', data).then((r) => r.data)
