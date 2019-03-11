import dayjs from 'dayjs';
import currencyjs from 'currency.js';

import {
  selectApplicableModifiers,
  selectBestGuestModifier,
} from './rate-plans';

/**
 * Determines a price for all of the guests for a single day
 * by using the selected rate plan and applying appropriate
 * modifier for every guest.
 *
 * @param  {Array<Object>} guests list of information about guests,
 * right now only the `age` and `id` fields are expected
 * @param  {Number} lengthOfStay
 * @param  {dayjs} dateDayjs
 * @param  {Object} ratePlan
 * @param  {string} currentCurrency
 * @return {Array<object>} Information about possible daily prices
 * for each guest like this (modifier being optional depending on
 * meeting the declare conditions):
 *
 * ```
 * [
 *   {
 *     "guestId": "guest id",
 *     "ratePlanId": "rate plan id",
 *     "basePrice": <currencyjs object>,
 *     "resultingPrice": <currencyjs object>,
 *     "modifier": {
 *       "conditions": {
 *         "minOccupants": 2
 *       },
 *       "unit": "percentage"
 *       "adjustment": -50,
 *       "change": -50
 *     }
 *   }
 * ]
 * ```
 *
 */
export const computeDailyPrice = (guests, lengthOfStay, dateDayjs, ratePlan, currentCurrency) => {
  const applicableModifiers = selectApplicableModifiers(
    ratePlan.modifiers, dateDayjs, lengthOfStay, guests.length
  );
  const guestPrices = [];
  let selectedModifier;
  let delta;
  for (let i = 0; i < guests.length; i += 1) {
    const guestResult = {
      guestId: guests[i].id,
      ratePlanId: ratePlan.id,
      basePrice: currencyjs(ratePlan.price, { symbol: currentCurrency }),
    };
    delta = 0;

    // Pick the best modifier for each guest and adjust the price
    selectedModifier = selectBestGuestModifier(ratePlan.price, applicableModifiers, guests[i].age);
    if (selectedModifier && selectedModifier.change) {
      delta = selectedModifier.change;
      guestResult.modifier = selectedModifier;
    }
    guestResult.resultingPrice = guestResult.basePrice.add(currencyjs(delta, { symbol: currentCurrency }));
    guestPrices.push(guestResult);
  }
  return guestPrices;
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
 *     "date": <dayjs instance>,
 *     "ratePlan": <RatePlan object>,
 *     "total": <currencyjs instance>,
 *     "guestPrices": <result of computeDailyPrice>
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
        // TODO allow for day-guest-rate plan combinations
        const dailyPrice = computeDailyPrice(
          guests, lengthOfStay, currentDate, currentRatePlan, currentCurrency,
        );
        dailyPrices[currentCurrency][i].push({
          date: currentDate,
          ratePlan: currentRatePlan,
          total: dailyPrice
            .reduce((a, b) => a.add(currencyjs(b.resultingPrice, { symbol: currentCurrency })), currencyjs(0, { symbol: currentCurrency })),
          guestPrices: dailyPrice,
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

export default {
  computeDailyRatePlans,
  computeDailyPrice,
};
