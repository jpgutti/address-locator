import React, { useMemo } from 'react'
import { graphql, compose } from 'react-apollo'
import { pick } from 'ramda'

import {
  updateOrderFormProfile,
  updateOrderFormShipping,
  updateOrderFormCheckin,
} from 'vtex.store-resources/Mutations'
import { address as addressQuery } from 'vtex.store-resources/Queries'

import AddressContext from './AddressContext'

const AddressOrderFormProvider = ({
  children,
  updateOrderFormProfile,
  updateOrderFormShipping,
  updateOrderFormCheckin,
  addressQuery,
}) => {
  const { orderForm, loading, refetch } = addressQuery
  const value = useMemo(() => {
    return {
      address: {
        orderForm,
        loading,
        refetch,
        updateOrderFormProfile,
        updateOrderFormShipping,
        updateOrderFormCheckin,
      },
    }
  }, [
    orderForm,
    loading,
    refetch,
    updateOrderFormProfile,
    updateOrderFormShipping,
    updateOrderFormCheckin,
  ])
  return (
    <AddressContext.Provider value={value}>{children}</AddressContext.Provider>
  )
}

const optionsRefetch = {
  refetchQueries: [{ query: addressQuery }],
}

export default compose(
  graphql(addressQuery, {
    name: 'addressQuery',
    options: () => ({ ssr: false }),
  }),
  graphql(updateOrderFormProfile, {
    name: 'updateOrderFormProfile',
    options: optionsRefetch,
  }),
  graphql(updateOrderFormShipping, {
    name: 'updateOrderFormShipping',
    options: optionsRefetch,
  }),
  graphql(updateOrderFormCheckin, {
    name: 'updateOrderFormCheckin',
    options: optionsRefetch,
  })
)(AddressOrderFormProvider)
