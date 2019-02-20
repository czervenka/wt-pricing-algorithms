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
  let delta;
  for (let i = 0; i < guests.length; i += 1) {
    delta = 0;
    // Pick the best modifier for each guest and adjust the price
    selectedModifier = selectBestGuestModifier(ratePlan.price, applicableModifiers, guests[i].age);
    if (selectedModifier && selectedModifier.change) {
      delta = selectedModifier.change;
    }
    guestPrices.push(ratePlan.price + delta);
  }
  return guestPrices.reduce((a, b) => a.add(currencyjs(b, { symbol: currentCurrency })), currencyjs(0, { symbol: currentCurrency }));
};

/**
 * Computes all daily prices for all rate plans that
 * can be applied for every day of the stay and groups
 * them by currency. If we are not able to cover all days
 * for any given currency, the whole currency gets dropped.
 *
 * This allows for flexible rate plan combination strategies
 * and various end-user price combinations.
 *
 * This does not allow a combination on a day-guest level, i. e.
 * a different rate plan can not be picked for different people on the
 * same day.
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
 * @return {Object} Every key is a currency code and its value is
 * an array (every index represents a single day). For every day
 * there is a list of usable daily prices computed from a certain rate plan.
 *
 * ```
 * [
 *   {
 *     "ratePlan": <RatePlan object>,
 *     "dailyPrice": <Result of computeDailyPrice>
 *   }
 * ]
 * ```
 */
export const computeDailyRatePlans = (arrivalDateDayjs, departureDateDayjs, guests, hotelCurrency, applicableRatePlans) => {
  const dailyPrices = {};
  const lengthOfStay = Math.abs(arrivalDateDayjs.diff(departureDateDayjs, 'days'));
  let currentDate = dayjs(arrivalDateDayjs);

  // Find an appropriate rate plan for every day
  for (let i = 0; i < lengthOfStay; i += 1) {
    let currentRatePlan;
    let currentCurrency;
    // loop over all rate plans and find the usable ones for that day in all currencies
    for (let j = 0; j < applicableRatePlans.length; j += 1) {
      currentRatePlan = applicableRatePlans[j];
      currentCurrency = currentRatePlan.currency || hotelCurrency;
      if (!dailyPrices[currentCurrency]) {
        dailyPrices[currentCurrency] = [];
      }
      if (!dailyPrices[currentCurrency][i]) {
        dailyPrices[currentCurrency][i] = [];
      }

      // Rate plan without date restriction can be applied at any time
      const availableForTravelFrom = currentRatePlan.availableForTravel
        ? dayjs(currentRatePlan.availableForTravel.from)
        : dayjs(currentDate);
      const availableForTravelTo = currentRatePlan.availableForTravel
        ? dayjs(currentRatePlan.availableForTravel.to)
        : dayjs(currentDate);

      // Count only rate plan ending sometimes during the stay
      if (currentDate >= availableForTravelFrom && currentDate <= availableForTravelTo) {
        dailyPrices[currentCurrency][i].push({
          ratePlan: currentRatePlan,
          dailyPrice: computeDailyPrice(
            guests, lengthOfStay, currentDate, currentRatePlan, currentCurrency,
          ),
        });
      }
    }
    currentDate = currentDate.add(1, 'day');
  }

  // Filter out currencies that do not cover the whole stay range
  const allCurrencies = Object.keys(dailyPrices);
  for (let i = 0; i < allCurrencies.length; i += 1) {
    const filteredLength = dailyPrices[allCurrencies[i]].filter((f) => f.length > 0).length;
    if (filteredLength < lengthOfStay) {
      delete dailyPrices[allCurrencies[i]];
    }
  }
  return dailyPrices;
};

/**
 * Error scoped to PriceComputer
 */
export class PriceComputerError extends Error {};

/**
 * A class for computing prices. It contains
 * multiple price resolution strategies for
 * hotels.
 */
export class PriceComputer {
  /**
   * @param  {Array<Object>} roomTypes List of room types as defined
   * in https://github.com/windingtree/wiki/blob/368a2a6fb752ad00dac326e09a9b1877d4591755/hotel-data-swagger.yaml
   * @param  {Array<Object>} ratePlans List of rate plans as defined in
   * https://github.com/windingtree/wiki/blob/368a2a6fb752ad00dac326e09a9b1877d4591755/hotel-data-swagger.yaml
   * @param  {string} defaultCurrency currency used when a rate plan has
   * no currency specified
   */
  constructor (roomTypes, ratePlans, defaultCurrency) {
    if (!roomTypes) {
      throw new PriceComputerError('Missing roomTypes');
    }
    if (!ratePlans) {
      throw new PriceComputerError('Missing ratePlans');
    }
    if (!defaultCurrency) {
      throw new PriceComputerError('Missing defaultCurrency');
    }
    this.roomTypes = roomTypes;
    this.ratePlans = ratePlans;
    this.defaultCurrency = defaultCurrency;
  }

  _determinePrices (bookingDate, arrivalDate, departureDate, guests, currency, roomTypeId, ratePlansStrategy) {
    const bookingDateDayjs = dayjs(bookingDate);
    const arrivalDateDayjs = dayjs(arrivalDate);
    const departureDateDayjs = dayjs(departureDate);
    const lengthOfStay = Math.abs(arrivalDateDayjs.diff(departureDateDayjs, 'days'));
    const roomTypes = roomTypeId ? this.roomTypes.filter((rt) => rt.id === roomTypeId) : this.roomTypes;
    
    return roomTypes.map((roomType) => {
      const applicableRatePlans = selectApplicableRatePlans(
        roomType.id, this.ratePlans, bookingDateDayjs, arrivalDateDayjs, departureDateDayjs, this.defaultCurrency, currency
      );
      // no rate plans available at all, bail
      if (!applicableRatePlans.length) {
        return {
          id: roomType.id,
          prices: [],
        };
      }

      const dailyPrices = computeDailyRatePlans(arrivalDateDayjs, departureDateDayjs, guests, this.defaultCurrency, applicableRatePlans);
      return {
        id: roomType.id,
        prices: ratePlansStrategy(dailyPrices, lengthOfStay),
      };
    });
  }

  /**
   * Returns the rate plan that covers the whole stay
   * with the best price.
   *
   * @param  {mixed} bookingDate
   * @param  {mixed} arrivalDate
   * @param  {mixed} departureDate
   * @param  {Array<Object>} guests list of information about guests,
   * right now only the `age` field is expected
   * @param  {string} currency optional filter by currency
   * @param  {string} roomTypeId optional filter by roomTypeId
   * @return {Array<Object>} List of roomTypes and their prices
   *
   * ```
   * [
   *   {
   *     "id": "RoomTypeId",
   *     "prices": [
   *       {
   *         "currency": "CZK",
   *         "total": <currencyjs instance>,
   *         "ratePlan": <RatePlan object>
   *       }
   *     ]
   *   }
   * ]
   * ```
   */
  getBestPriceWithSingleRatePlan (bookingDate, arrivalDate, departureDate, guests, currency, roomTypeId) {
    return this._determinePrices(bookingDate, arrivalDate, departureDate, guests, currency, roomTypeId, (dailyPrices, lengthOfStay) => {
      const prices = [];
      const currencies = Object.keys(dailyPrices);
      // Currencies
      for (let i = 0; i < currencies.length; i += 1) {
        const currentCurrency = dailyPrices[currencies[i]];
        const ratePlanOccurrences = {};
        // Days
        for (let j = 0; j < currentCurrency.length; j += 1) {
          currentCurrency[j].map((rp) => {
            if (!ratePlanOccurrences[rp.ratePlan.id]) {
              ratePlanOccurrences[rp.ratePlan.id] = {
                ratePlan: rp.ratePlan,
                dailyPrices: [],
              };
            }
            ratePlanOccurrences[rp.ratePlan.id].dailyPrices.push(rp.dailyPrice);
          });
        }
        const bestRatePlan = Object.values(ratePlanOccurrences)
          .filter((rp) => rp.dailyPrices.length === lengthOfStay)
          .map((rp) => ({
            ratePlan: rp.ratePlan,
            total: rp.dailyPrices.reduce((total, dp) => total.add(dp), currencyjs(0, { symbol: currencies[i] })),
          }))
          .sort((a, b) => a.total >= b.total ? -1 : 1)
          .pop();

        prices.push({
          currency: currencies[i],
          total: bestRatePlan.total,
          ratePlan: bestRatePlan.ratePlan,
        });
      }
      return prices;
    });
  }

  /**
   *
   * Returns all of the rate plans that cover the whole stay.
   * A client can choose the most fitting one for their purpose.
   *
   * @param  {mixed} bookingDate
   * @param  {mixed} arrivalDate
   * @param  {mixed} departureDate
   * @param  {Array<Object>} guests list of information about guests,
   * right now only the `age` field is expected
   * @param  {string} currency optional filter by currency
   * @param  {string} roomTypeId optional filter by roomTypeId
   * @return {Array<Object>} List of roomTypes and their prices
   *
   * ```
   * [
   *   {
   *     "id": "RoomTypeId",
   *     "prices": [
   *       {
   *         "currency": "CZK",
   *         "ratePlans": [
   *           {
   *             "ratePlan": <RatePlan object>,
   *             "dailyPrices": [
   *               <Result of computeDailyPrice>,
   *               <Result of computeDailyPrice>,
   *               ...
   *             ],
   *             "total": <currencyjs object>
   *           }
   *         ]
   *       }
   *     ]
   *   }
   * ]
   * ```
   */
  getPossiblePricesWithSingleRatePlan (bookingDate, arrivalDate, departureDate, guests, currency, roomTypeId) {
    return this._determinePrices(bookingDate, arrivalDate, departureDate, guests, currency, roomTypeId, (dailyPrices, lengthOfStay) => {
      const prices = [];
      const currencies = Object.keys(dailyPrices);
      // Currencies
      for (let i = 0; i < currencies.length; i += 1) {
        const currentCurrency = dailyPrices[currencies[i]];
        const ratePlanOccurrences = {};
        // Days
        for (let j = 0; j < currentCurrency.length; j += 1) {
          currentCurrency[j].map((rp) => {
            if (!ratePlanOccurrences[rp.ratePlan.id]) {
              ratePlanOccurrences[rp.ratePlan.id] = {
                ratePlan: rp.ratePlan,
                dailyPrices: [],
              };
            }
            ratePlanOccurrences[rp.ratePlan.id].dailyPrices.push(rp.dailyPrice);
          });
        }
        prices.push({
          currency: currencies[i],
          ratePlans: Object.values(ratePlanOccurrences)
            .filter((rp) => rp.dailyPrices.length === lengthOfStay)
            .map((rp) => ({
              ratePlan: rp.ratePlan,
              dailyPrices: rp.dailyPrices,
              total: rp.dailyPrices.reduce((total, dp) => total.add(dp), currencyjs(0, { symbol: currencies[i] })),
            })),
        });
      }
      return prices;
    });
  }

  /**
   * Computes the best prices for given period of time and
   * a party of guests. This picks the best rate plan
   * for every guest for every single day.
   *
   * If no currency or roomTypeId is specified, all variants
   * are computed.
   *
   * To report
   * a price, a combination of rate plans in every currency
   * has to cover the whole period between `arrivalDateDayjs`
   * and `departureDateDayjs`.
   *
   * @param  {mixed} bookingDate anything parseable by dayjs
   * @param  {mixed} arrivalDate anything parseable by dayjs
   * @param  {mixed} departureDate anything parseable by dayjs
   * @param  {Array<Object>} guests List of information about guests
   * @param  {string} currency you can limit the results only
   * to this currency
   * @param  {string} roomTypeId you can limit the results only to
   * this roomTypeId
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
  getBestPrice (bookingDate, arrivalDate, departureDate, guests, currency, roomTypeId) {
    return this._determinePrices(bookingDate, arrivalDate, departureDate, guests, currency, roomTypeId, (dailyPrices) => {
      const prices = [];
      const currencies = Object.keys(dailyPrices);
      for (let i = 0; i < currencies.length; i += 1) {
        const currentCurrency = dailyPrices[currencies[i]];
        const dailyBests = [];
        for (let j = 0; j < currentCurrency.length; j += 1) {
          const price = currentCurrency[j]
            .reduce((agg, curr) => {
              if (!agg || agg.subtract(curr.dailyPrice) >= 0) {
                return curr.dailyPrice;
              }
              return agg;
            }, undefined);
          dailyBests.push(price);
        }
        prices.push({
          currency: currencies[i],
          total: dailyBests.reduce((a, b) => a.add(currencyjs(b, { symbol: currencies[i] })), currencyjs(0, { symbol: currencies[i] })),
        });
      }
      return prices;
    });
  }
}

export default {
  PriceComputer,
  PriceComputerError,
  computeDailyRatePlans,
  computeDailyPrice,
  ratePlans: {
    selectApplicableModifiers,
    selectBestGuestModifier,
    selectApplicableRatePlans,
  },
};
