import React, { Fragment } from 'react';
import { injectIntl, intlShape } from 'react-intl'
import Map from './Map';

import { compose, withProps, lifecycle } from 'recompose'
import { withScriptjs } from "react-google-maps"
import { StandaloneSearchBox } from 'react-google-maps/lib/components/places/StandaloneSearchBox'

import InputSearch from 'vtex.styleguide/InputSearch'
import Button from 'vtex.styleguide/Button'
import Popover from './Popover';

const SearchMap = compose(
  withProps({
    googleMapURL: "https://maps.googleapis.com/maps/api/js?key=AIzaSyCUbzqhN6HZoty-UigCHG4bitF-Vl2GU7U&v=3.exp&libraries=geometry,drawing,places",
    loadingElement: <div style={{ height: `100%` }} />,
    containerElement: <div style={{ height: `400px` }} />,
  }),
  lifecycle({
    componentWillMount() {
      const refs = {}
      this.setState({
        selectedPlace: undefined,
        
        onSearchBoxMounted: ref => {
          refs.searchBox = ref;
        },

        onPlacesChanged: () => {
          const place = refs.searchBox.getPlaces()[0];
          this.setState({
            selectedPlace: {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            },
          });
        },

        setCurrentPosition: () => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
              this.setState({
                selectedPlace: {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                }
              })
            })
          }
        }
      })
    }
  }),
  withScriptjs
)(({ selectedPlace, onSearchBoxMounted, bounds, onPlacesChanged, setCurrentPosition, intl }) => {
  const placeholder = intl.formatMessage({id: "address-locator.enter-address"});
  const popoverTitle = intl.formatMessage({id: "address-locator.popover.title"});
  const popoverDescription = intl.formatMessage({id: "address-locator.popover.description"});
  const popoverButton = intl.formatMessage({id: "address-locator.popover.button"});

  return (
    <div className="w-100">
      <StandaloneSearchBox
        ref={onSearchBoxMounted}
        bounds={bounds}
        onPlacesChanged={onPlacesChanged}
      >
        <InputSearch type="text" placeholder={placeholder} size="x-large" />
      </StandaloneSearchBox>
      <Button onClick={setCurrentPosition}>{intl.formatMessage({id: 'address-locator.current-location'})}</Button>

      {selectedPlace && (
        <Fragment>
          <Popover
            titleText={popoverTitle}
            descriptionText={popoverDescription}
            buttonText={popoverButton}
          />
          <Map marker={selectedPlace} />
        </Fragment>
      )}
    </div>
  )
})

SearchMap.propTypes = { intl: intlShape.isRequired }

export default injectIntl(SearchMap)