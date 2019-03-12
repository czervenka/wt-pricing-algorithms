import dayjs from 'dayjs';
import currencyjs from 'currency.js';
import {
  computeDailyRatePlans,
} from './utils';

import {
  selectApplicableRatePlans,
} from './rate-plans';

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
   * in https://github.com/windingtree/wiki/blob/868b5d2685b1cd70647020978141be820ddccd30/hotel-data-swagger.yaml
   * @param  {Array<Object>} ratePlans List of rate plans as defined in
   * https://github.com/windingtree/wiki/blob/868b5d2685b1cd70647020978141be820ddccd30/hotel-data-swagger.yaml
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
        ...ratePlansStrategy(dailyPrices, lengthOfStay),
      };
    });
  }

  /**
   * Returns the rate plan that covers the whole stay
   * with the best price. If needed, a components data
   * is available that you can use to inspect all of
   * the components adding up to the final price.
   *
   * @param  {mixed} bookingDate
   * @param  {mixed} arrivalDate
   * @param  {mixed} departureDate
   * @param  {Array<Object>} guests list of information about guests,
   * right now only the `age` and `id` fields are expected
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
   *         "ratePlan": <RatePlan object>,
   *         "components": {
   *           "stay": [
   *             {
   *               "date": "2018-01-01",
   *               "subtotal": 100,
   *               "guests": [
   *                 {
   *                   "guestId": "guest id 1",
   *                   "ratePlanId": "rate plan id",
   *                   "currency": "EUR",
   *                   "basePrice": 100,
   *                   "resultingPrice": 50,
   *                   "modifier": {
   *                     "conditions": {
   *                       "minOccupants": 2
   *                     },
   *                     "unit": "percentage"
   *                     "adjustment": -50
   *                   }
   *                 },
   *                 {
   *                   "guestId": "guest id 2",
   *                   "ratePlanId": "rate plan id",
   *                   "currency": "EUR",
   *                   "basePrice": 100,
   *                   "resultingPrice": 50,
   *                   "modifier": {
   *                     "conditions": {
   *                       "minOccupants": 2
   *                     },
   *                     "unit": "percentage"
   *                     "adjustment": -50
   *                   }
   *                 }
   *               ]
   *             }
   *           }
   *         ]
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
            ratePlanOccurrences[rp.ratePlan.id].dailyPrices.push(rp);
          });
        }

        const bestRatePlan = Object.values(ratePlanOccurrences)
          .filter((rp) => rp.dailyPrices.length === lengthOfStay)
          .map((rp) => ({
            ratePlan: rp.ratePlan,
            total: rp.dailyPrices.reduce((total, dp) => total.add(dp.total), currencyjs(0, { symbol: currencies[i] })),
            components: {
              stay: rp.dailyPrices.reduce((a, b) => {
                return a.concat([{
                  date: b.date.format('YYYY-MM-DD'),
                  subtotal: b.total,
                  guests: b.guestPrices,
                }]);
              }, []),
            },
          }))
          .sort((a, b) => a.total >= b.total ? -1 : 1)
          .pop();

        prices.push({
          currency: currencies[i],
          ...bestRatePlan,
        });
      }
      return {
        prices,
      };
    });
  }

  /**
   *
   * Returns all of the rate plans that cover the whole stay.
   * A client can choose the most fitting one for their purpose.
   * If needed, a components data is available that you can use
   * to inspect all of  the components adding up to the final price.
   *
   * @param  {mixed} bookingDate
   * @param  {mixed} arrivalDate
   * @param  {mixed} departureDate
   * @param  {Array<Object>} guests list of information about guests,
   * right now only the `age` and `id` fields are expected
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
   *             "total": <currencyjs object>,
   *             "components": {
   *               "stay": [
   *                 {
   *                   "date": "2018-01-01",
   *                   "subtotal": 100,
   *                   "guests": [
   *                     {
   *                       "guestId": "guest id 1",
   *                       "ratePlanId": "rate plan id",
   *                       "currency": "EUR",
   *                       "basePrice": 100,
   *                       "resultingPrice": 50,
   *                       "modifier": {
   *                         "conditions": {
   *                           "minOccupants": 2
   *                         },
   *                         "unit": "percentage"
   *                         "adjustment": -50
   *                       }
   *                     },
   *                     {
   *                       "guestId": "guest id 2",
   *                       "ratePlanId": "rate plan id",
   *                       "currency": "EUR",
   *                       "basePrice": 100,
   *                       "resultingPrice": 50,
   *                       "modifier": {
   *                         "conditions": {
   *                           "minOccupants": 2
   *                         },
   *                         "unit": "percentage"
   *                         "adjustment": -50
   *                       }
   *                     }
   *                   ]
   *                 }
   *               }
   *             ]
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
            ratePlanOccurrences[rp.ratePlan.id].dailyPrices.push(rp);
          });
        }
        prices.push({
          currency: currencies[i],
          ratePlans: Object.values(ratePlanOccurrences)
            .filter((rp) => rp.dailyPrices.length === lengthOfStay)
            .map((rp) => ({
              ratePlan: rp.ratePlan,
              total: rp.dailyPrices.reduce((total, dp) => total.add(dp.total), currencyjs(0, { symbol: currencies[i] })),
              components: {
                stay: rp.dailyPrices.reduce((a, b) => {
                  return a.concat([{
                    date: b.date.format('YYYY-MM-DD'),
                    subtotal: b.total,
                    guests: b.guestPrices,
                  }]);
                }, []),
              },
            })),
        });
      }
      return {
        prices,
      };
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
   * is empty. In the `components` field, one can find all parts that form
   * the total price.
   * ```
   * [
   *   {
   *     "id": "single-bed",
   *     "prices": [
   *       {
   *         "currency": "EUR",
   *         "total": 100,
   *         "components": [
   *           {
   *             "date": "2018-01-01",
   *             "subtotal": 100,
   *             "guests": [
   *               {
   *                 "guestId": "guest id 1",
   *                 "ratePlanId": "rate plan id",
   *                 "currency": "EUR",
   *                 "basePrice": 100,
   *                 "resultingPrice": 50,
   *                 "modifier": {
   *                   "conditions": {
   *                     "minOccupants": 2
   *                   },
   *                   "unit": "percentage"
   *                   "adjustment": -50
   *                 }
   *               },
   *               {
   *                 "guestId": "guest id 2",
   *                 "ratePlanId": "rate plan id",
   *                 "currency": "EUR",
   *                 "basePrice": 100,
   *                 "resultingPrice": 50,
   *                 "modifier": {
   *                   "conditions": {
   *                     "minOccupants": 2
   *                   },
   *                   "unit": "percentage"
   *                   "adjustment": -50
   *                 }
   *               }
   *             ]
   *           }
   *         ]
   *       },
   *       {
   *         "currency": "USD",
   *         "total": 100,
   *         "components": {
   *           "stay": [
   *             {
   *               "date": "2018-01-01",
   *               "subtotal": 100,
   *               "guests": [
   *                 {
   *                   "guestId": "guest id 1",
   *                   "ratePlanId": "rate plan id",
   *                   "currency": "EUR",
   *                   "basePrice": 100,
   *                   "resultingPrice": 50,
   *                   "modifier": {
   *                     "conditions": {
   *                       "minOccupants": 2
   *                     },
   *                     "unit": "percentage"
   *                     "adjustment": -50
   *                   }
   *                 },
   *                 {
   *                   "guestId": "guest id 2",
   *                   "ratePlanId": "rate plan id",
   *                   "currency": "EUR",
   *                   "basePrice": 100,
   *                   "resultingPrice": 50,
   *                   "modifier": {
   *                     "conditions": {
   *                       "minOccupants": 2
   *                     },
   *                     "unit": "percentage"
   *                     "adjustment": -50
   *                   }
   *                 }
   *               ]
   *             }
   *           }
   *         ]
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
      // Currencies
      for (let i = 0; i < currencies.length; i += 1) {
        const currentCurrency = dailyPrices[currencies[i]];
        const dailyBests = {};
        // Days
        for (let j = 0; j < currentCurrency.length; j += 1) {
          const dailyBest = currentCurrency[j]
            .reduce((agg, curr) => {
              if (!agg || !agg.total || agg.total.subtract(curr.total) >= 0) {
                return curr;
              }
              return agg;
            }, undefined);
          dailyBests[currentCurrency[j][0].date.format('YYYY-MM-DD')] = dailyBest;
        }
        prices.push({
          currency: currencies[i],
          total: Object.values(dailyBests)
            .reduce((a, b) => {
              return a.add(currencyjs(b.total, { symbol: currencies[i] }));
            }, currencyjs(0, { symbol: currencies[i] })),
          components: {
            stay: Object.keys(dailyBests).reduce((a, b) => {
              return a.concat([{
                date: b,
                subtotal: dailyBests[b].guestPrices.reduce((a, b) => {
                  return a.add(b.resultingPrice);
                }, currencyjs(0, { symbol: currencies[i] })),
                guests: dailyBests[b].guestPrices,
              }]);
            }, []),
          },
        });
      }
      return {
        prices,
      };
    });
  }
}

export default {
  PriceComputer,
  PriceComputerError,
};
