import dayjs from 'dayjs';

/**
 * Sorts out real dates for cancellation policies by applying
 * deadline where possible.
 *
 * @param  {dayjs} bookingDateDayjs is used to determine how far in the
 * future will the actual stay happen.
 * @param  {dayjs} arrivalDayjs is a date of arrival
 * @param  {Array<Object>} cancellationPolicies List of all declared
 * policies
 * @return {Array<object>} Normalized list of policies where each
 * record contains from, to, and an appropriate amount.
 */
export const normalizePolicyDates = (bookingDateDayjs, arrivalDayjs,
  cancellationPolicies) => cancellationPolicies
  .filter((cp) => {
    if (cp.from && dayjs(cp.from).isAfter(arrivalDayjs)) {
      return false;
    }

    if (cp.to && dayjs(cp.to).isBefore(bookingDateDayjs)) {
      return false;
    }
    return true;
  })
  .map((cp) => {
    const deadlineStartDayjs = dayjs(arrivalDayjs).subtract(cp.deadline, 'days');
    const fromOptions = [bookingDateDayjs, deadlineStartDayjs];
    if (cp.from) {
      fromOptions.push(dayjs(cp.from));
    }
    const from = fromOptions
      .sort((a, b) => (a.isAfter(b) ? -1 : 1))
      .find(x => x.isBefore(arrivalDayjs) || x.isSame(arrivalDayjs));
    let to = arrivalDayjs;
    if (cp.to) {
      const toDayjs = dayjs(cp.to);
      if (toDayjs.isBefore(arrivalDayjs)) {
        to = toDayjs;
      }
    }

    return {
      from,
      to,
      amount: cp.amount,
    };
  });

/**
 * Determines the most benefitial cancellation fee for a hotel
 * for every day between `bookingDateDayjs` and `arrivalDayjs`
 * (inclusive on both sides).
 *
 * @param  {dayjs} bookingDateDayjs is used to determine where to start.
 * @param  {dayjs} arrivalDayjs is a date of arrival
 * @param  {Array<Object>} normalizedCancellationPolicies result of
 * `normalizePolicyDates`
 * @param  {Number} defaultCancellationAmount a default that is used
 * in case there is no special policy applicable to any given date.
 * @return {Array<Object>} A list of fees best for a hotel. Items
 * contain an object containing dateDayjs and amount and are ordered
 * by date in an ascending order.
 */
export const createFeeSchedule = (bookingDateDayjs, arrivalDayjs,
  normalizedCancellationPolicies, defaultCancellationAmount) => {
  // We have to cover from the booking date to the date of arrival (including)
  let currentPolicy;
  let currentDate;
  const cancellationFees = {};
  for (let i = 0; i < normalizedCancellationPolicies.length; i += 1) {
    currentPolicy = normalizedCancellationPolicies[i];
    currentDate = dayjs(currentPolicy.from);
    while (currentDate.isBefore(currentPolicy.to) || currentDate.isSame(currentPolicy.to)) {
      if (cancellationFees[currentDate.format('YYYY-MM-DD')]) {
        cancellationFees[currentDate.format('YYYY-MM-DD')].amount = Math.max(cancellationFees[currentDate.format('YYYY-MM-DD')].amount, currentPolicy.amount);
      } else {
        cancellationFees[currentDate.format('YYYY-MM-DD')] = {
          dateDayjs: currentDate,
          amount: currentPolicy.amount,
        };
      }
      currentDate = currentDate.add(1, 'day');
    }
  }

  currentDate = dayjs(bookingDateDayjs);
  while (!currentDate.isAfter(arrivalDayjs)) {
    if (cancellationFees[currentDate.format('YYYY-MM-DD')] === undefined || cancellationFees[currentDate.format('YYYY-MM-DD')].amount === undefined) {
      cancellationFees[currentDate.format('YYYY-MM-DD')] = {
        dateDayjs: currentDate,
        amount: defaultCancellationAmount,
      };
    }
    currentDate = currentDate.add(1, 'day');
  }
  return Object.values(cancellationFees)
    .sort((a, b) => (a.dateDayjs.isBefore(b.dateDayjs) ? -1 : 1));
};

/**
 * Compacts a fee schedule into continuous intervals
 * with the same amount.
 *
 * @param  {Array<Object>} feeSchedule ordered result of createFeeSchedule
 * @return {Array<Object>} List of periods, each containing from,
 * to and amount.
 */
export const reduceFeeSchedule = (orderedSchedule) => {
  const periods = [];
  let currentPeriod = {
    from: orderedSchedule[0].dateDayjs.format('YYYY-MM-DD'),
    amount: orderedSchedule[0].amount,
  };
  for (let i = 0; i < orderedSchedule.length; i += 1) {
    if (orderedSchedule[i].amount !== currentPeriod.amount) {
      currentPeriod.to = orderedSchedule[i].dateDayjs.subtract(1, 'day').format('YYYY-MM-DD');
      periods.push(currentPeriod);
      currentPeriod = {
        from: orderedSchedule[i].dateDayjs.format('YYYY-MM-DD'),
        amount: orderedSchedule[i].amount,
      };
    }
  }
  // close the dangling period
  currentPeriod.to = orderedSchedule[orderedSchedule.length - 1].dateDayjs.format('YYYY-MM-DD');
  periods.push(currentPeriod);
  return periods;
};

/**
 * Determines the cancellation fees for any given arrival date
 * in the future.
 *
 * @param  {mixed} bookingDate anything parseable by dayjs marking
 * a date on which the booking is happening
 * @param  {mixed} arrivalDate anything parseable by dayjs marking
 * a date on which the consumer will arrive
 * @param  {Array<Object>} cancellationPolicies list of policies as defined
 * in https://github.com/windingtree/wiki/blob/d64397e5fb6e439f8436ed856f60664d08ae9b48/hotel-data-swagger.yaml#L129
 * @param  {Number} defaultCancellationAmount fallback amount as defined in
 * https://github.com/windingtree/wiki/blob/d64397e5fb6e439f8436ed856f60664d08ae9b48/hotel-data-swagger.yaml#L124
 * @return {Array<Object>} Result of `reduceFeeSchedule`
 */
export const computeCancellationFees = (bookingDate, arrivalDate,
  cancellationPolicies, defaultCancellationAmount) => {
  // We need to cover the whole days
  const bookingDateDayjsSOD = dayjs(bookingDate).set('hour', 0).set('minute', 0).set('second', 0);
  const arrivalDayjsEOD = dayjs(arrivalDate).set('hour', 23).set('minute', 59).set('second', 59);
  // Fallback to defaultCancellationAmount
  if (!cancellationPolicies || !cancellationPolicies.length) {
    return [
      {
        from: bookingDateDayjsSOD.format('YYYY-MM-DD'),
        to: arrivalDayjsEOD.format('YYYY-MM-DD'),
        amount: defaultCancellationAmount,
      },
    ];
  }
  const normalizedPolicies = normalizePolicyDates(
    bookingDateDayjsSOD,
    arrivalDayjsEOD,
    cancellationPolicies,
  );
  return reduceFeeSchedule(createFeeSchedule(
    bookingDateDayjsSOD,
    arrivalDayjsEOD,
    normalizedPolicies,
    defaultCancellationAmount,
  ));
};

export default {
  normalizePolicyDates,
  createFeeSchedule,
  reduceFeeSchedule,
  computeCancellationFees,
};
