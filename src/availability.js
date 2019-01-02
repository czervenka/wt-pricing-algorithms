import dayjs from 'dayjs';

/**
 * Transforms raw array of availability records to an
 * object indexeed by roomTypeId and date.
 *
 * @param  {Array} availability as defined in https://github.com/windingtree/wiki/blob/d64397e5fb6e439f8436ed856f60664d08ae9b48/hotel-data-swagger.yaml#L373
 * @return {Object} such as
 * ```
 * {
 *   "single-bed": {
 *     "2018-01-01": {
 *       "quantity": 3,
 *       "date": "2018-01-01",
 *       "roomTypeId": "single-bed"
 *     }
 *   },
 *   "double-bed": {
 *     "2018-01-01": {
 *       "quantity": 3,
 *       "date": "2018-01-01",
 *       "roomTypeId": "single-bed"
 *     }
 *   }
 * }
 * ```
 */
export const indexAvailability = (availability) => {
  return availability.reduce((agg, curr) => Object.assign({}, agg, {
    [curr.roomTypeId]: Object.assign({}, agg[curr.roomTypeId], {
      [curr.date]: curr,
    }),
  }), {});
};

/**
 * Aggregates total quantity of available room types during given period.
 * If data for any day (including arrival and departure) is missing, `undefined`
 * is returned, otherwise a number is returned.
 * 
 * @param  {mixed} arrivalDate anything parseable by dayjs
 * @param  {mixed} departureDate anything parseable by dayjs
 * @param  {number} numberOfGuests
 * @param  {Array<Object>} roomTypes
 * @param  {Object} indexedAvailability result of `indexAvailability` method
 * @return {Array<Object>}
 * ```
 * [
 *   { "roomTypeId": "rta", "quantity": 1 },
 *   { "roomTypeId": "rtb", "quantity": 1 },
 *   { "roomTypeId": "rtc", "quantity": undefined }
 * ]
 * ```
 */
export const computeAvailability = (arrivalDate, departureDate, numberOfGuests, roomTypes, indexedAvailability) => {
  const arrivalDateDayjs = dayjs(arrivalDate);
  const departureDateDayjs = dayjs(departureDate);
  const lengthOfStay = Math.abs(arrivalDateDayjs.diff(departureDateDayjs, 'days'));
  return roomTypes.map((rt) => {
    // Drop out if availability data is not available
    if (!indexedAvailability[rt.id]) {
      return {
        roomTypeId: rt.id,
        quantity: undefined,
      };
    }
    // Drop out if guest data does not fit the desired room occupancy
    if (rt.occupancy &&
      (
        (rt.occupancy.min &&
        rt.occupancy.min > numberOfGuests) ||
        (rt.occupancy.max &&
        rt.occupancy.max < numberOfGuests)
      )
    ) {
      return {
        roomTypeId: rt.id,
        quantity: 0,
      };
    }
    let currentDate = dayjs(arrivalDateDayjs);
    let currentAvailability;
    let dailyAvailability = [];

    for (let j = 0; j < lengthOfStay; j += 1) {
      currentAvailability = indexedAvailability[rt.id][currentDate.format('YYYY-MM-DD')];
      if (currentAvailability) {
        const isRestrictedForArrival = j === 0 &&
        currentAvailability.restrictions &&
        currentAvailability.restrictions.noArrival;
        if (isRestrictedForArrival) {
          return {
            roomTypeId: rt.id,
            quantity: 0,
          };
        }
        dailyAvailability.push(currentAvailability.quantity);
      }
      currentDate = currentDate.add(1, 'day');
    }
    // Deal with the departure date:
    // - noDeparture restriction, it's a
    // special one - it is applied to the date *after* the last night
    currentAvailability = indexedAvailability[rt.id][currentDate.format('YYYY-MM-DD')];
    if (
      currentAvailability &&
      currentAvailability.restrictions &&
      currentAvailability.restrictions.noDeparture
    ) {
      return {
        roomTypeId: rt.id,
        quantity: 0,
      };
    } else if (currentAvailability !== undefined) {
      // Departure date quantity is not actually relevant
      dailyAvailability.push(1);
    }
    // Filter out missing data and applied restrictions
    // +1 means the date of departure
    if (dailyAvailability.length === lengthOfStay + 1) {
      return {
        roomTypeId: rt.id,
        quantity: dailyAvailability.reduce((agg, da) => {
          if (agg === undefined) {
            return da;
          }
          return Math.min(da, agg);
        }, undefined),
      };
    } else {
      return {
        roomTypeId: rt.id,
        quantity: undefined,
      };
    }
  });
};

export default {
  indexAvailability,
  computeAvailability,
};
