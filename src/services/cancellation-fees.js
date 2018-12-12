import dayjs from 'dayjs';

export const normalizePolicyDates = (todayDayjs, arrivalDayjs,
  cancellationPolicies) => cancellationPolicies
  .filter((cp) => {
    if (cp.from && dayjs(cp.from).isAfter(arrivalDayjs)) {
      return false;
    }

    if (cp.to && dayjs(cp.to).isBefore(todayDayjs)) {
      return false;
    }
    return true;
  })
  .map((cp) => {
    const deadlineStartDayjs = dayjs(arrivalDayjs).subtract(cp.deadline, 'days');
    const fromOptions = [todayDayjs, deadlineStartDayjs];
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
      deadline: cp.deadline,
    };
  });

export const createFeeSchedule = (todayDayjs, arrivalDayjs,
  normalizedCancellationPolicies, defaultCancellationAmount) => {
  // We have to cover from today to the date of arrival (including)
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

  currentDate = dayjs(todayDayjs);
  while (!currentDate.isAfter(arrivalDayjs)) {
    if (cancellationFees[currentDate.format('YYYY-MM-DD')] === undefined || cancellationFees[currentDate.format('YYYY-MM-DD')].amount === undefined) {
      cancellationFees[currentDate.format('YYYY-MM-DD')] = {
        dateDayjs: currentDate,
        amount: defaultCancellationAmount,
      };
    }
    currentDate = currentDate.add(1, 'day');
  }

  return cancellationFees;
};

export const reduceFeeSchedule = (feeSchedule) => {
  const orderedSchedule = Object.values(feeSchedule)
    .sort((a, b) => (a.dateDayjs.isBefore(b.dateDayjs) ? -1 : 1));
  const periods = [];
  let currentPeriod = { from: orderedSchedule[0].dateDayjs.format('YYYY-MM-DD'), amount: orderedSchedule[0].amount };
  for (let i = 0; i < orderedSchedule.length; i += 1) {
    if (orderedSchedule[i].amount !== currentPeriod.amount) {
      currentPeriod.to = orderedSchedule[i].dateDayjs.subtract(1, 'day').format('YYYY-MM-DD');
      periods.push(currentPeriod);
      currentPeriod = { from: orderedSchedule[i].dateDayjs.format('YYYY-MM-DD'), amount: orderedSchedule[i].amount };
    }
  }
  // close the dangling period
  currentPeriod.to = orderedSchedule[orderedSchedule.length - 1].dateDayjs.format('YYYY-MM-DD');
  periods.push(currentPeriod);
  return periods;
};

export const computeCancellationFees = (todayDayjs, arrivalDayjs,
  cancellationPolicies, defaultCancellationAmount) => {
  const todayDayjsSOD = dayjs(todayDayjs).set('hour', 0).set('minute', 0).set('second', 0);
  const arrivalDayjsEOD = dayjs(arrivalDayjs).set('hour', 23).set('minute', 59).set('second', 59);
  // Fallback to defaultCancellationAmount
  if (!cancellationPolicies || !cancellationPolicies.length) {
    return [
      {
        from: todayDayjs.format('YYYY-MM-DD'),
        to: arrivalDayjs.format('YYYY-MM-DD'),
        amount: defaultCancellationAmount,
      },
    ];
  }
  const normalizedPolicies = normalizePolicyDates(
    todayDayjsSOD,
    arrivalDayjsEOD,
    cancellationPolicies,
  );
  return reduceFeeSchedule(createFeeSchedule(
    todayDayjsSOD,
    arrivalDayjsEOD,
    normalizedPolicies,
    defaultCancellationAmount,
  ));
};

export default {
  computeCancellationFees,
};
