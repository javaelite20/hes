import client from './client'

export const getMyRealTime = () =>
  client.get('/analytics/my/realtime').then((r) => r.data)

export const getMyWeekly = () =>
  client.get('/analytics/my/weekly').then((r) => r.data)

export const getMyDaily = (from, to) => {
  const params = {}
  if (from) params.from = from
  if (to) params.to = to
  return client.get('/analytics/my/daily', { params }).then((r) => r.data)
}

export const getMeterRealTime = (meterId) =>
  client.get(`/analytics/meters/${meterId}/realtime`).then((r) => r.data)

export const getMeterDaily = (meterId, from, to) => {
  const params = {}
  if (from) params.from = from
  if (to) params.to = to
  return client.get(`/analytics/meters/${meterId}/daily`, { params }).then((r) => r.data)
}
