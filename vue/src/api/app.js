import { get, post } from '../utils/request'

export const getAppEnv = () => {
  return get('/api/app/env')
}

export const getWalletHome = () => {
  return get('/api/wallet/home')
}

export const getWalletBalance = (params) => {
  return get('/api/wallet/balance', params)
}

export const getWalletHistory = () => {
  return get('/api/wallet/history')
}

export const createWallet = (data) => {
  return post('/api/wallet/create', data)
}

export const importWallet = (data) => {
  return post('/api/wallet/import', data)
}

export const updatePassword = (data) => {
  return post('/api/wallet/update-password', data)
}

export const unbindWallet = () => {
  return post('/api/wallet/unbind')
}