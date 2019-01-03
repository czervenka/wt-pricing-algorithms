import dayjs from 'dayjs';
import currencyjs from 'currency.js';
import {
  selectApplicableModifiers,
  selectBestGuestModifier,
  selectApplicableRatePlans,
} from './rate-plans';

/**
 * Determines a price for all of the guests for a single day
 * by using the selected rate plan and applying appropriate
 * modifier for every guest.
 *
 * @param  {Array<Object>} guests list of information about guests,
 * right now only the `age` field is expected
 * @param  {Number} lengthOfStay
 * @param  {dayjs} dateDayjs
 * @param  {Object} ratePlan
 * @param  {string} currentCurrency
 * @return {currencyjs} Total amount for all of the guests
 */
export const computeDailyPrice = (guests, lengthOfStay, dateDayjs, ratePlan, currentCurrency) => {
  const applicableModifiers = selectApplicableModifiers(
    ratePlan.modifiers, dateDayjs, lengthOfStay, guests.length
  );
  if (!applicableModifiers.length) {
    return currencyjs(ratePlan.price, { symbol: currentCurrency }).multiply(guests.length);
  }

  const guestPrices = [];
  let selectedModifier;
  let adjustment;
  for (let i = 0; i < guests.length; i += 1) {
    adjustment = 0;
    // Pick the best modifier for each guest and adjust the price
    selectedModifier = selectBestGuestModifier(applicableModifiers, guests[i].age);
    if (selectedModifier) {
      adjustment = (selectedModifier.adjustment / 100) * ratePlan.price;
    }
    guestPrices.push(ratePlan.price + adjustment);
  }
  return guestPrices.reduce((a, b) => a.add(currencyjs(b, { symbol: currentCurrency })), currencyjs(0, { symbol: currentCurrency }));
};

/**
 * Computes a best price for the whole stay for all
 * of the guests in every possible currency. To report
 * a price, rate plans in every currency have to cover
 * the whole period between `arrivalDateDayjs` and
 * `departureDateDayjs`.
 *
 * @param  {dayjs} arrivalDateDayjs
 * @param  {dayjs} departureDateDayjs
 * @param  {Array<Object>} guests list of information about guests,
 * right now only the `age` field is expected
 * @param  {string} hotelCurrency default hotel currency
 * @param  {Array<object>} applicableRatePlans list of possible rate plans
 * @return {Object} For every currency a record exists in this map. The value
 * is an array of currencyjs instances that denote the best price
 * for all guests for a single day.
 */
export const computeStayPrices = (arrivalDateDayjs, departureDateDayjs, guests, hotelCurrency, applicableRatePlans) => {
  const dailyPrices = {};
  const lengthOfStay = Math.abs(arrivalDateDayjs.diff(departureDateDayjs, 'days'));
  let currentDate = dayjs(arrivalDateDayjs);
  // Find an appropriate rate plan for every day
  for (let i = 0; i < lengthOfStay; i += 1) {
    let currentRatePlan;
    let currentCurrency;
    const bestDailyPrice = {};

    // loop over all rate plans and find the most fitting one for that day in all currencies
    for (let j = 0; j < applicableRatePlans.length; j += 1) {
      currentRatePlan = applicableRatePlans[j];
      currentCurrency = currentRatePlan.currency || hotelCurrency;
      if (!dailyPrices[currentCurrency]) {
        dailyPrices[currentCurrency] = [];
      }

      // Rate plan without date restriction can be applied at any time
      const availableForTravelFrom = currentRatePlan.availableForTravel
        ? dayjs(currentRatePlan.availableForTravel.from)
        : dayjs(currentDate);
      const availableForTravelTo = currentRatePlan.availableForTravel
        ? dayjs(currentRatePlan.availableForTravel.to)
        : dayjs(currentDate);
      // Deal with a rate plan ending sometimes during the stay
      if (currentDate >= availableForTravelFrom && currentDate <= availableForTravelTo) {
        const currentDailyPrice = computeDailyPrice(
          guests, lengthOfStay, currentDate, currentRatePlan, currentCurrency,
        );

        if (!bestDailyPrice[currentCurrency] ||
          currentDailyPrice.subtract(bestDailyPrice[currentCurrency]) <= 0) {
          bestDailyPrice[currentCurrency] = currentDailyPrice;
        }
      }
    }
    const currencies = Object.keys(bestDailyPrice);
    for (let j = 0; j < currencies.length; j += 1) {
      dailyPrices[currencies[j]].push(bestDailyPrice[currencies[j]]);
    }
    currentDate = currentDate.add(1, 'day');
  }

  // Filter out currencies that do not cover the whole stay range
  const allCurrencies = Object.keys(dailyPrices);
  for (let i = 0; i < allCurrencies.length; i += 1) {
    if (dailyPrices[allCurrencies[i]].length < lengthOfStay ||
      dailyPrices[allCurrencies[i]].indexOf(undefined) > -1) {
      delete dailyPrices[allCurrencies[i]];
    }
  }
  return dailyPrices;
};

/**
 * Computes the best prices for all room types
 * for given period of time and a party of guests.
 *
 * @param  {mixed} bookingDate anything parseable by dayjs
 * @param  {mixed} arrivalDate anything parseable by dayjs
 * @param  {mixed} departureDate anything parseable by dayjs
 * @param  {Array<Object>} guests List of information about guests
 * @param  {Array<Object>} roomTypes List of room types as defined
 * in https://github.com/windingtree/wiki/blob/d64397e5fb6e439f8436ed856f60664d08ae9b48/hotel-data-swagger.yaml#L136
 * @param  {Array<Object>} ratePlans List of rate plans as defined in
 * https://github.com/windingtree/wiki/blob/d64397e5fb6e439f8436ed856f60664d08ae9b48/hotel-data-swagger.yaml#L212
 * @param  {string} fallbackCurrency currency used when a rate plan has
 * no currency specified
 * @param  {string} preferredCurrency you can limit the results only
 * to this currency
 * @return {Array} List of prices for every room type. Every item in
 * the array contains an id (roomTypeId) and a list of `prices` for all
 * applicable currencies such as this. The total sum is an instance
 * of currencyjs. In case of no applicable rate plans, the prices array
 * is empty.
 * ```
 * [
 *   {
 *     "id": "single-bed",
 *     "prices": [
 *       {
 *         "currency": "EUR",
 *         "total": 123.12
 *       },
 *       {
 *         "currency": "USD",
 *         "total": 130
 *       }
 *     ]
 *   }
 * ]
 * ```
 */
export const computePrices = (
  bookingDate,
  arrivalDate,
  departureDate,
  guests,
  roomTypes,
  ratePlans,
  fallbackCurrency,
  preferredCurrency = null
) => {
  const bookingDateDayjs = dayjs(bookingDate);
  const arrivalDateDayjs = dayjs(arrivalDate);
  const departureDateDayjs = dayjs(departureDate);
  return roomTypes.map((roomType) => {
    const applicableRatePlans = selectApplicableRatePlans(
      roomType.id, ratePlans, bookingDateDayjs, arrivalDateDayjs, departureDateDayjs, fallbackCurrency, preferredCurrency
    );
    const response = {
      id: roomType.id,
      prices: [],
    };
    // no rate plans available at all, bail
    if (!applicableRatePlans.length) {
      return response;
    }

    const dailyPrices = computeStayPrices(
      arrivalDateDayjs, departureDateDayjs, guests, fallbackCurrency, applicableRatePlans,
    );

    response.prices = Object.keys(dailyPrices).map((currency) => {
      return {
        currency,
        total: dailyPrices[currency]
          .reduce((a, b) => a.add(currencyjs(b, { symbol: currency })), currencyjs(0, { symbol: currency })),
      };
    });

    return response;
  });
};

export default {
  computeStayPrices,
  computeDailyPrice,
  computePrices,
  ratePlans: {
    selectApplicableModifiers,
    selectBestGuestModifier,
    selectApplicableRatePlans,
  },
};
