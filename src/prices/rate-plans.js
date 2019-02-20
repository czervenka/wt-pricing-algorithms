import dayjs from 'dayjs';

/**
 * Picks rate plans modifiers applicable under given conditions.
 *
 * @param  {Array<Object>} modifiers List of rate plan modifiers as
 * defined in https://github.com/windingtree/wiki/blob/d64397e5fb6e439f8436ed856f60664d08ae9b48/hotel-data-swagger.yaml#L296
 * @param  {dayjs} dateDayjs A date for which we want to apply modifiers
 * @param  {Number} lengthOfStay
 * @param  {Number} numberOfGuests
 * @return {Array<Object>} List of modifiers that can be applied
 */
export const selectApplicableModifiers = (modifiers, dateDayjs, lengthOfStay, numberOfGuests) => {
  if (!modifiers || !modifiers.length) {
    return [];
  }
  // Drop modifiers not fitting the overall guest data
  let maxMinLOS;
  let maxMinOccupants;
  // Some modifiers might be affecting the same thing, but we can't
  // modify the original array while iterating over it, so they
  // get deleted later.
  const elementsToDrop = [];
  const applicableModifiers = modifiers.filter((mod) => {
    // no or invalid type - no modifier
    if (!mod.type || ['percentage', 'absolute'].indexOf(mod.type) === -1) {
      return false;
    }
    // no conditions - no modifier
    if (!mod.conditions) {
      return false;
    }
    // date limits
    if (mod.conditions.from && dayjs(mod.conditions.from).diff(dateDayjs, 'days') > 0) {
      return false;
    }
    if (mod.conditions.to && dayjs(mod.conditions.to).diff(dateDayjs, 'days') < 0) {
      return false;
    }
    // LOS condition
    if (mod.conditions.minLengthOfStay) {
      if (mod.conditions.minLengthOfStay > lengthOfStay) {
        return false;
      }
      if (maxMinLOS &&
        mod.conditions.minLengthOfStay < maxMinLOS.conditions.minLengthOfStay
      ) {
        return false;
      }
      if (maxMinLOS) {
        elementsToDrop.push(maxMinLOS);
      }
      maxMinLOS = mod;
      return true;
    }
    // Occupants condition
    if (mod.conditions.minOccupants) {
      if (mod.conditions.minOccupants > numberOfGuests) {
        return false;
      }
      if (maxMinOccupants &&
        mod.conditions.minOccupants < maxMinOccupants.conditions.minOccupants
      ) {
        return false;
      }
      if (maxMinOccupants) {
        elementsToDrop.push(maxMinOccupants);
      }
      maxMinOccupants = mod;
      return true;
    }
    return true;
  });
  return applicableModifiers.filter(mod => elementsToDrop.indexOf(mod) === -1);
};

/**
 * Selects a modifier that is most in favour of a guest
 * with given age. If no age based modifier is applicable,
 * the best one from non-specific modifiers is used.
 *
 * @param {currencyjs} Base price
 * @param  {Array<Object>} modifiers List of rate plan modifiers as
 * defined in https://github.com/windingtree/wiki/blob/d64397e5fb6e439f8436ed856f60664d08ae9b48/hotel-data-swagger.yaml#L296
 * @param  {Number} age Guest's age
 * @return {Object} The modifier with the best rate in
 * favour of a guest.
 */
export const selectBestGuestModifier = (basePrice, modifiers, age) => {
  const ageModifiers = modifiers.filter(mod => mod.conditions.maxAge !== undefined);
  const selectedAgeModifier = ageModifiers.reduce((best, current) => {
    if (current.conditions.maxAge >= age && ( // guest is under the bar
      !best || // no best has yet been setup
      // current has a closer limit than the best
      best.conditions.maxAge >= current.conditions.maxAge
    )) {
      const change = current.type === 'percentage' ? (current.adjustment / 100) * basePrice : current.adjustment;
      // always return pro-customer price for now
      if (!best || change <= best.change) {
        current.change = change;
        return current;
      }
    }
    return best;
  }, undefined);

  if (selectedAgeModifier) {
    return selectedAgeModifier;
  }
  // Fallback to a best offer, no age-specific modifier matched
  const genericModifiers = modifiers
    .filter(mod => mod.conditions && mod.conditions.maxAge === undefined)
    .map((mod) => {
      mod.change = mod.type === 'percentage' ? (mod.adjustment / 100) * basePrice : mod.adjustment;
      return mod;
    })
    .sort((a, b) => (a.change <= b.change ? -1 : 1));
  return genericModifiers[0];
};

/**
 * Filters out rate plans that cannot be used under
 * given conditions.
 *
 * @param  {string} roomTypeId
 * @param  {Array<Object>} ratePlans list of rate plans as defined in
 * https://github.com/windingtree/wiki/blob/d64397e5fb6e439f8436ed856f60664d08ae9b48/hotel-data-swagger.yaml#L212
 * @param  {dayjs} bookingDateDayjs
 * @param  {dayjs} arrivalDateDayjs
 * @param  {dayjs} departureDateDayjs
 * @param  {string} fallbackCurrency used when rate plans does not have
 * a currency defined
 * @param  {string|null|undefined} preferredCurrency You can limit the results to
 * this single currency for faster processing
 * @return {Array<Object>} List of usable rate plans.
 */
export const selectApplicableRatePlans = (
  roomTypeId,
  ratePlans,
  bookingDateDayjs,
  arrivalDateDayjs,
  departureDateDayjs,
  fallbackCurrency,
  preferredCurrency = null
) => {
  const lengthOfStay = Math.abs(arrivalDateDayjs.diff(departureDateDayjs, 'days'));
  return ratePlans.filter((rp) => {
    // Rate plan is not tied to this room type
    if (rp.roomTypeIds.indexOf(roomTypeId) === -1) {
      return false;
    }

    // Rate plan has a different currency than requested.
    if (preferredCurrency && (rp.currency || fallbackCurrency) !== preferredCurrency) {
      return false;
    }

    // Filter out rate plans by dates
    if (rp.availableForReservation) {
    // Rate plan cannot be used for this date
      const availableForReservationFrom = dayjs(rp.availableForReservation.from);
      const availableForReservationTo = dayjs(rp.availableForReservation.to);
      if (availableForReservationTo.isBefore(bookingDateDayjs) ||
          availableForReservationFrom.isAfter(bookingDateDayjs)) {
        return false;
      }
    }
    if (rp.availableForTravel) {
      // Rate plan is totally out of bounds of travel dates
      const availableForTravelFrom = dayjs(rp.availableForTravel.from);
      const availableForTravelTo = dayjs(rp.availableForTravel.to);
      if (availableForTravelTo.isBefore(arrivalDateDayjs) ||
          availableForTravelFrom.isAfter(departureDateDayjs)) {
        return false;
      }
    }

    // apply general restrictions if any
    if (rp.restrictions) {
      if (rp.restrictions.bookingCutOff) {
        if (rp.restrictions.bookingCutOff.min &&
          dayjs(arrivalDateDayjs)
            .subtract(rp.restrictions.bookingCutOff.min, 'days')
            .isBefore(bookingDateDayjs)
        ) {
          return false;
        }

        if (rp.restrictions.bookingCutOff.max &&
          dayjs(arrivalDateDayjs)
            .subtract(rp.restrictions.bookingCutOff.max, 'days')
            .isAfter(bookingDateDayjs)
        ) {
          return false;
        }
      }
      if (rp.restrictions.lengthOfStay) {
        if (rp.restrictions.lengthOfStay.min &&
          rp.restrictions.lengthOfStay.min > lengthOfStay
        ) {
          return false;
        }

        if (rp.restrictions.lengthOfStay.max &&
          rp.restrictions.lengthOfStay.max < lengthOfStay
        ) {
          return false;
        }
      }
    }
    return true;
  });
};

export default {
  selectApplicableModifiers,
  selectBestGuestModifier,
  selectApplicableRatePlans,
};
