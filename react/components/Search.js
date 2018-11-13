import React, { Component, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { FormattedMessage } from 'react-intl'
import PropTypes from 'prop-types'
import { withScriptjs } from 'react-google-maps'
import { Adopt } from 'react-adopt'
import { graphql } from 'react-apollo'
import { compose, branch, mapProps, renderComponent } from 'recompose'

import logisticsQuery from '../queries/logistics.gql'
import { StandaloneSearchBox } from 'react-google-maps/lib/components/places/StandaloneSearchBox'
import alpha2ToAlpha3 from 'country-iso-2-to-3'
import { Alert, Button, Input, Spinner } from 'vtex.styleguide'
import { contextPropTypes } from 'vtex.store/OrderFormContext'
import LocationInputIcon from './LocationInputIcon'

/**
 * Geolocation error codes. Can be found here:
 * https://developer.mozilla.org/en-US/docs/Web/API/PositionError
 */
const ERROR_POSITION_DENIED = 1
const ERROR_POSITION_UNAVAILABLE = 2
const ERROR_TIMEOUT = 3
const ERROR_ADDRESS_NOT_FOUND = 9 // custom ad hoc error code

const GEOLOCATION_TIMEOUT = 30*1000

/**
 * Component responsible for searching the user address in Google Maps API, when
 * inserting it or using navigator geolocation to get current position
 */
class AddressSearch extends Component {
  static propTypes = {
    /* Google Maps Geolocation API key */
    googleMapKey: PropTypes.string,
    /* Function that will be called after updating the orderform */
    onOrderFormUpdated: PropTypes.func,
    /* Context used to call address mutation and retrieve the orderForm */
    orderFormContext: contextPropTypes,
    /* Set to loading mode */
    loading: PropTypes.bool,
  }

  state = {
    address: null,
    formattedAddress: '',
    shouldDisplayNumberInput: false,
    isLoading: false,
    inputError: null,
    inputPostalCodeError: null,
    AlertMessage: false,
    shouldDisplayPostalCodeInput: false,
    hasSearchedPostalCode: false,
  }

  searchBox = React.createRef()

  handlePlacesChanged = () => {
    const place = this.searchBox.current.getPlaces()[0]
    this.setAddressProperties(place)
  }

  /* Use the navigator geolocation to get the user position and retrieve his address using Google Maps API */
  handleSetCurrentPosition = () => {
    if (navigator.geolocation) {
      this.setState({ isLoading: true })
      const geolocationOptions = {
        enableHighAccuracy: true,
        timeout: GEOLOCATION_TIMEOUT,
        maximumAge: 0,
      }

      navigator.geolocation.getCurrentPosition(async position => {
        const { latitude, longitude } = position.coords
        const rawResponse = await fetch(this.getApiUrlFromCoordinates(latitude, longitude))
        const parsedResponse = await rawResponse.json()

        if (!parsedResponse.results.length) {
          return this.setState({
            inputError: ERROR_ADDRESS_NOT_FOUND,
            isLoading: false,
          })
        }

        const place = parsedResponse.results[0]
        this.setAddressProperties(place)
      }, error => {
        this.setState({
          inputError: error.code,
          isLoading: false,
        })
      }, geolocationOptions)
    }
  }

  /**
   * Returns Google Maps API geocode URL according to given latlng
   */
  getApiUrlFromCoordinates = (latitude, longitude) => {
    const { googleMapKey } = this.props

    return `https://maps.googleapis.com/maps/api/geocode/json?key=${googleMapKey}&latlng=${latitude},${longitude}`
  }

  getApiUrlFromPostalCode = (postalCode) => {
    const { googleMapKey } = this.props

    return `https://maps.googleapis.com/maps/api/geocode/json?key=${googleMapKey}&address=${postalCode}`
  }

  setAddressProperties = place => {
    const address = this.getParsedAddress(place)

    if (!address.city) {
      return this.setState({
        AlertMessage: <FormattedMessage id="address-locator.address-search-invalid-address" />,
        address: null,
        formattedAddress: '',
        shouldDisplayNumberInput: false,
        isLoading: false,
        inputError: null,
        inputPostalCodeError: null,
        shouldDisplayPostalCodeInput: false,
        hasSearchedPostalCode: false,
      })
    }

    this.setState({
      address,
      formattedAddress: place.formatted_address,
      shouldDisplayNumberInput: address.postalCode ? !address.number : false,
      isLoading: false,
      inputError: null,
      inputPostalCodeError: null,
      AlertMessage: null,
      shouldDisplayPostalCodeInput: !address.postalCode,
      hasSearchedPostalCode: false,
    })
  }

  /**
   * The place object returned from Google Maps API has some extra informations about the address that won't be used when sending
   * to orderform. So, this function will reduce nested address information into a simpler consumable object.
   *
   * @param {Object} place The place object returned from Google Maps API
   * @returns {Object} The reduced address data with only necessary fields/information
   */
  getParsedAddress = place => {
    const parsedAddressComponents = place.address_components.reduce((accumulator, address) => {
      const parsedItem = address.types.reduce(
        (accumulator, type) => ({ ...accumulator, [type]: address.short_name }),
        {}
      )
      return { ...accumulator, ...parsedItem }
    }, {})

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

  handleFormSubmit = async e => {
    e.preventDefault()

    this.setState({
      isLoading: true,
      inputError: null,
      AlertMessage: null,
    })
    const { orderFormContext, onOrderFormUpdated } = this.props
    const { address } = this.state

    try {
      const response = await orderFormContext.updateOrderFormShipping({
        variables: {
          orderFormId: orderFormContext.orderForm.orderFormId,
          address,
        },
      })

      const { shippingData } = response.data.updateOrderFormShipping
      if (!this.getIsAddressValid(shippingData.address)) {
        return this.setState({
          isLoading: false,
          inputError: ERROR_ADDRESS_NOT_FOUND,
        })
      }

      if (onOrderFormUpdated) {
        onOrderFormUpdated()
      }
    } catch (e) {
      this.setState({
        isLoading: false,
        AlertMessage: <FormattedMessage id="address-locator.graphql-error" />,
      })
    }
  }

  getIsAddressValid = address => address.city && address.street && address.number

  handleAddressKeyChanged = (e, key) => {
    const { address } = this.state
    address[key] = e.target.value
    this.setState({ address })
  }

  handleAddressChanged = e =>
    this.setState({
      address: undefined,
      formattedAddress: e.target.value,
    })

  handleCloseAlert = () => this.setState({ AlertMessage: null })

  canUsePortal = () => Boolean(document && document.body)

  getErrorMessage = errorCode => {
    switch (errorCode) {
      case ERROR_ADDRESS_NOT_FOUND:
        return <FormattedMessage id="address-locator.address-search-not-found-error" />
      case ERROR_TIMEOUT:
        return <FormattedMessage id="address-locator.address-search-timeout-error" />
      case ERROR_POSITION_UNAVAILABLE:
        return <FormattedMessage id="address-locator.address-search-position-unavailable-error" />
      case ERROR_POSITION_DENIED:
        return <FormattedMessage id="address-locator.address-search-position-denied-error" />
      default:
        return null
    }
  }

  renderExtraDataInput = (field, type) => {
    const { address } = this.state;
    if (!address) return null;

    return (
      <Adopt
        mapper={{
          placeholder: (
            <FormattedMessage id={`address-locator.address-search-${field}-placeholder`} />
          ),
          label: <FormattedMessage id={`address-locator.address-search-${field}-label`} />,
        }}
      >
        {({ placeholder, label }) => (
          <Input
            type={type}
            value={address[field]}
            placeholder={placeholder}
            size="large"
            label={label}
            onChange={e => this.handleAddressKeyChanged(e, field)}
          />
        )}
      </Adopt>
    );
  }

  canSubmit = () => {
    const { address } = this.state;
    return address && address.number && address.street && address.neighborhood && address.postalCode;
  }

  validatePostalCode = async () => {
    const { address } = this.state;
    try {
      const rawResponse = await fetch(this.getApiUrlFromPostalCode(address.postalCode))
      const parsedResponse = await rawResponse.json()
      if (!parsedResponse.results.length) {
        return this.setState({
          inputPostalCodeError: ERROR_ADDRESS_NOT_FOUND,
          isLoading: false,
        })
      }

      const place = parsedResponse.results[0]
      const newAddress = this.getParsedAddress(place)
      this.setState({
        address: newAddress,
        shouldDisplayNumberInput: true,
        isLoading: false,
        inputError: null,
        inputPostalCodeError: null,
        AlertMessage: null,
        shouldDisplayPostalCodeInput: true,
        hasSearchedPostalCode: true,
      })
    } catch(err) {
      return this.setState({
        inputPostalCodeError: ERROR_ADDRESS_NOT_FOUND,
        isLoading: false,
      })
    }
  }

  onPostalCodeKeyPress = (e) => {
    if (e.key === 'Enter') {
      this.validatePostalCode();
    }
  }

  renderPostalCodeInput = () => {
    const { shouldDisplayPostalCodeInput, inputPostalCodeError } = this.state;
    if (!shouldDisplayPostalCodeInput) return null;
    return (
      <Adopt
        mapper={{
          placeholder: (
            <FormattedMessage id={`address-locator.address-search-postalCode-placeholder`} />
          ),
          label: <FormattedMessage id={`address-locator.address-search-postalCode-label`} />,
        }}
      >
        {({ placeholder, label }) => (
          <Input
            type="text"
            errorMessage={this.getErrorMessage(inputPostalCodeError)}
            placeholder={placeholder}
            size="large"
            label={label}
            onChange={e => this.handleAddressKeyChanged(e, 'postalCode')}
            suffix={<LocationInputIcon onClick={this.validatePostalCode} />}
            onKeyPress={this.onPostalCodeKeyPress}
          />
        )}
      </Adopt>
    );
  }

  render() {
    const {
      formattedAddress,
      isLoading,
      inputError,
      AlertMessage,
      shouldDisplayPostalCodeInput,
      hasSearchedPostalCode,
      shouldDisplayNumberInput,
    } = this.state

    const isDisabled = this.props.loading

    const searchInput = (
      <Adopt
        mapper={{
          placeholder: <FormattedMessage id="address-locator.address-search-placeholder" />,
          label: <FormattedMessage id="address-locator.address-search-label" />,
        }}
      >
        {({ placeholder, label }) => (
          <Input
            key="input"
            type="text"
            value={formattedAddress}
            errorMessage={this.getErrorMessage(inputError)}
            placeholder={placeholder}
            size="large"
            label={label}
            onChange={this.handleAddressChanged}
            suffix={<LocationInputIcon onClick={this.handleSetCurrentPosition} />}
          />
        )}
      </Adopt>
    )

    return (
      <Fragment>
        {AlertMessage &&
          this.canUsePortal() &&
          createPortal(
            <div className="fixed top-0 z-max">
              <Alert type="warning" onClose={this.handleCloseAlert}>
                {AlertMessage}
              </Alert>
            </div>,
            document.body
          )}
        <form className="address-search w-100 pv7 ph6" onSubmit={this.handleFormSubmit}>
          <div className="relative input--icon-right">
            { isDisabled 
              ? searchInput
              : (
                <StandaloneSearchBox ref={this.searchBox} onPlacesChanged={this.handlePlacesChanged}>
                  {searchInput}
                </StandaloneSearchBox>
              )
            }
          </div>
          {this.renderPostalCodeInput()}
          {shouldDisplayPostalCodeInput && hasSearchedPostalCode && this.renderExtraDataInput('neighborhood', 'text')}
          {shouldDisplayPostalCodeInput && hasSearchedPostalCode && this.renderExtraDataInput('street', 'text')}
          {shouldDisplayNumberInput && this.renderExtraDataInput('number', 'number')}
          {(!shouldDisplayPostalCodeInput || hasSearchedPostalCode) && this.renderExtraDataInput('complement', 'text')}
          <Button
            className="w-100"
            type="submit"
            disabled={!this.canSubmit() || isDisabled}
            isLoading={isLoading}
            block
          >
            <FormattedMessage id="address-locator.address-search-button" />
          </Button>
        </form>
      </Fragment>
    )
  }
}

export default compose(
  graphql(logisticsQuery, {
    name: 'logisticsQuery',
  }),
  branch(
    props => !props.logisticsQuery.loading,
    compose(
      mapProps(ownerProps => {
        const { googleMapsKey } = ownerProps.logisticsQuery.logistics
        const { onOrderFormUpdated, orderFormContext } = ownerProps

        return {
          googleMapKey: googleMapsKey,
          googleMapURL: `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&v=3.exp&libraries=places`,
          loadingElement: <AddressSearch loading />,
          onOrderFormUpdated: onOrderFormUpdated,
          orderFormContext: orderFormContext,
        }
      }),
      withScriptjs
    ),
    renderComponent(Spinner)
  )
)(AddressSearch)
