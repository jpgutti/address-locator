import React, { useEffect, useCallback } from 'react'
import queryString from 'query-string'
import { head, path } from 'ramda'
import { useRuntime } from 'vtex.render-runtime'

import { useAddress, withAddressProvider } from '../AddressContext'
import AddressPage from './AddressPage'

import '../../global.css'

const redirectToReturnURL = navigate => {
  try {
    const parsedQueryString = queryString.parse(window.location.search)
    const returnURL = (parsedQueryString && parsedQueryString.returnUrl) || ''
    const cleanUrl = head(returnURL) === '/' ? returnURL : `/${returnURL}`
    navigate({ to: cleanUrl })
  } catch (e) {
    // Unable to redirect
  }
}

const AddressManager = props => {
  const { address } = useAddress()
  const { navigate } = useRuntime()

  const redirect = useCallback(() => redirectToReturnURL(navigate), [navigate])

  useEffect(() => {
    if (!!path(['orderForm', 'shippingData', 'address'], address)) {
      redirect()
    }
  }, [address, redirect])
  return <AddressPage {...props} onSelectAddress={redirect} />
}

AddressManager.schema = {
  title: 'admin/address-locator.address-manager-title',
  description: 'admin/address-locator.address-manager-description',
  type: 'object',
  properties: {
    logoUrl: {
      type: 'string',
      title: 'admin/address-locator.address-manager.logo-title',
      widget: {
        'ui:widget': 'image-uploader',
      },
    },
  },
}

export default withAddressProvider(AddressManager)
