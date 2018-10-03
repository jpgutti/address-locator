import React, { Component } from 'react'
import { FormattedMessage } from 'react-intl'
import PropTypes from 'prop-types'
import { withScriptjs } from 'react-google-maps'
import { Adopt } from 'react-adopt'
import { StandaloneSearchBox } from 'react-google-maps/lib/components/places/StandaloneSearchBox'
import { alpha2ToAlpha3 } from 'i18n-iso-countries'
import Input from 'vtex.styleguide/Input'
import Button from 'vtex.styleguide/Button'
import {
  orderFormConsumer,
  contextPropTypes,
} from 'vtex.store/OrderFormContext'
import LocationInputIcon from './LocationInputIcon'

class AddressSearch extends Component {
  static propTypes = {
    /* Context used to call address mutation and retrieve the orderForm */
    orderFormContext: contextPropTypes,
    /* Google Maps Geolocation API key */
    googleMapKey: PropTypes.string,
    /* Function that will be called after updating the orderform */
    onOrderFormUpdated: PropTypes.func,
  }

  state = {
    address: null,
    formattedAddress: '',
    shouldDisplayNumberInput: false,
    isLoading: false,
  }

  handleSearchBoxMounted = ref => {
    this.searchBox = ref
  }

  handlePlacesChanged = () => {
    const place = this.searchBox.getPlaces()[0]
    this.setAddressProperties(place)
  }

  handleSetCurrentPosition = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        (async () => {
          const { latitude, longitude } = position.coords
          const { googleMapKey } = this.props
          const rawResponse = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?key=${googleMapKey}&latlng=${latitude},${longitude}`)
          const parsedResponse = await rawResponse.json()
          const place = parsedResponse.results[0]
          this.setAddressProperties(place)
        })()
      })
    }
  }

  setAddressProperties = place => {
    const address = this.getParsedAddress(place)
    this.setState({
      address,
      formattedAddress: place.formatted_address,
      shouldDisplayNumberInput: !address.number,
    })
  }

  /**
   * Reduces Google Maps API of array address components into a simpler consumable object
   */
  getParsedAddress = place => {
    const parsedAddressComponents = place.address_components.reduce(
      (prev, curr) => {
        const parsedItem = curr.types.reduce(
          (prev, type) => ({ ...prev, [type]: curr.short_name }),
          {}
        )
        return { ...prev, ...parsedItem }
      },
      {}
    )

    const address = {
      addressType: 'residential',
      city: parsedAddressComponents.administrative_area_level_2,
      complement: '',
      /* Google Maps API returns Alpha-2 ISO codes, but checkout API requires Alpha-3 */
      country: alpha2ToAlpha3(parsedAddressComponents.country),
      neighborhood: parsedAddressComponents.sublocality_level_1,
      number: parsedAddressComponents.street_number || '',
      postalCode: parsedAddressComponents.postal_code,
      receiverName: '',
      state: parsedAddressComponents.administrative_area_level_1,
      street: parsedAddressComponents.route,
    }

    return address
  }

  handleFormSubmit = e => {
    e.preventDefault()

    this.setState({
      isLoading: true,
    })

    const { orderFormContext, onOrderFormUpdated } = this.props
    const { address } = this.state

    orderFormContext
      .updateOrderFormShipping({
        variables: {
          orderFormId: orderFormContext.orderForm.orderFormId,
          address,
        },
      })
      .then(() => {
        if (onOrderFormUpdated) {
          onOrderFormUpdated()
        }
        orderFormContext.refetch()
        this.setState({
          isLoading: false,
        })
      })
  }

  handleAddressKeyChanged = (e, key) => {
    const { address } = this.state
    address[key] = e.target.value
    this.setState({ address })
  }

  handleAddressChanged = e => {
    this.setState({
      address: undefined,
      formattedAddress: e.target.value,
    })
  }

  render() {
    const { address, formattedAddress, shouldDisplayNumberInput, isLoading } = this.state

    return (
      <form className="address-search w-100 pv7 ph6" onSubmit={this.handleFormSubmit}>
        <div className="relative input--icon-right">
          <StandaloneSearchBox
            ref={this.handleSearchBoxMounted}
            onPlacesChanged={this.handlePlacesChanged}
          >
            <Adopt mapper={{
              placeholder: <FormattedMessage id="address-locator.address-search-placeholder" />,
              label: <FormattedMessage id="address-locator.address-search-label" />,
            }}>
              {({ placeholder, label }) => (
                <Input
                  type="text"
                  value={formattedAddress}
                  placeholder={placeholder}
                  size="large"
                  label={label}
                  onChange={this.handleAddressChanged}
                />
              )}
            </Adopt>
          </StandaloneSearchBox>
          <LocationInputIcon onClick={this.handleSetCurrentPosition} />
        </div>
        {(address && shouldDisplayNumberInput) && (
          <Adopt mapper={{
            placeholder: <FormattedMessage id="address-locator.address-search-number-placeholder" />,
            label: <FormattedMessage id="address-locator.address-search-number-label" />,
          }}>
            {({ placeholder, label }) => (
              <Input
                type="number"
                value={address.number}
                placeholder={placeholder}
                size="large"
                label={label}
                onChange={e => this.handleAddressKeyChanged(e, 'number')}
              />
            )}
          </Adopt>
        )}
        {address && (
          <Adopt mapper={{
            placeholder: <FormattedMessage id="address-locator.address-search-complement-placeholder" />,
            label: <FormattedMessage id="address-locator.address-search-complement-label" />,
          }}>
            {({ placeholder, label }) => (
              <Input
                type="text"
                value={address.complement}
                placeholder={placeholder}
                size="large"
                label={label}
                onChange={e => this.handleAddressKeyChanged(e, 'complement')}
              />
            )}
          </Adopt>
        )}
        <Adopt mapper={{
          text: <FormattedMessage id="address-locator.address-search-button" />,
        }}>
          {({ text }) => (
            <Button
              className="w-100"
              type="submit"
              disabled={!address || !address.number}
              isLoading={isLoading}
              block
            >
              {text}
            </Button>
          )}
        </Adopt>
      </form>
    )
  }
}

export default orderFormConsumer(withScriptjs(AddressSearch))
