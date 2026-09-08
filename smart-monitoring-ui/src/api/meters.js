import client from './client'

export const getMyMeter = () =>
  client.get('/meters/my').then((r) => r.data)

export const getAllMeters = () =>
  client.get('/meters').then((r) => r.data)

export const createMeter = (data) =>
  client.post('/meters', data).then((r) => r.data)

export const assignMeter = (meterId, userId) =>
  client.patch(`/meters/${meterId}/assign/${userId}`).then((r) => r.data)
