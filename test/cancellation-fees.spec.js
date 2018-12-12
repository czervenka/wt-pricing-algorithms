import dayjs from 'dayjs';
import {
  computeCancellationFees, normalizePolicyDates, createFeeSchedule, reduceFeeSchedule,
} from '../src/cancellation-fees';

describe('cancellation-fees', () => {
  const defaultCancellationAmount = 11;
  const today = dayjs('2018-03-13');
  const arrival = dayjs('2018-07-21');

  describe('normalizePolicyDates', () => {
    it('should filter out policies totally out of bounds in the past', () => {
      const result = normalizePolicyDates(today, arrival, [
        {
          from: '2017-01-01', to: '2017-07-21', deadline: 365, amount: 22,
        },
      ]);
      expect(result.length).toBe(0);
    });

    it('should filter out policies totally out of bounds in the future', () => {
      const result = normalizePolicyDates(today, arrival, [
        {
          from: '2019-01-01', to: '2019-07-21', deadline: 365, amount: 22,
        },
      ]);
      expect(result.length).toBe(0);
    });

    it('should keep policies applicable during stay starting after today', () => {
      const result = normalizePolicyDates(today, arrival, [
        {
          from: '2018-07-01', to: '2019-07-21', deadline: 9, amount: 22,
        },
      ]);
      expect(result.length).toBe(1);
    });

    it('should set from to today if missing', () => {
      const result = normalizePolicyDates(today, arrival, [
        { to: '2018-07-21', deadline: 365, amount: 22 },
      ]);
      expect(result.length).toBe(1);
      expect(result[0].from.format('YYYY-MM-DD')).toBe(today.format('YYYY-MM-DD'));
    });

    it('should adjust from to today if before the period', () => {
      const result = normalizePolicyDates(today, arrival, [
        {
          from: '2018-01-01', to: '2018-12-31', deadline: 365, amount: 22,
        },
      ]);
      expect(result.length).toBe(1);
      expect(result[0].from.format('YYYY-MM-DD')).toBe(today.format('YYYY-MM-DD'));
    });

    it('should set to to arrival if missing', () => {
      const result = normalizePolicyDates(today, arrival, [
        { from: '2018-03-13', deadline: 365, amount: 22 },
      ]);
      expect(result.length).toBe(1);
      expect(result[0].to.format('YYYY-MM-DD')).toBe(arrival.format('YYYY-MM-DD'));
    });

    it('should adjust to to arrival if after the period', () => {
      const result = normalizePolicyDates(today, arrival, [
        {
          from: '2018-03-13', to: '2018-12-31', deadline: 365, amount: 22,
        },
      ]);
      expect(result.length).toBe(1);
      expect(result[0].to.format('YYYY-MM-DD')).toBe(arrival.format('YYYY-MM-DD'));
    });

    it('should adjust from to a deadline if it is inside the period', () => {
      const result = normalizePolicyDates(today, arrival, [
        {
          from: '2018-01-01', to: '2018-12-31', deadline: 10, amount: 22,
        },
      ]);
      expect(result.length).toBe(1);
      const startingDate = dayjs(arrival).subtract(10, 'days');
      expect(result[0].from.format('YYYY-MM-DD')).toBe(startingDate.format('YYYY-MM-DD'));
    });

    it('should set from to deadline and keep to if both are within the period', () => {
      const result = normalizePolicyDates(today, arrival, [
        {
          from: '2018-01-01', to: '2018-07-06', deadline: 10, amount: 22,
        },
      ]);
      expect(result.length).toBe(1);
      const startingDate = dayjs(arrival).subtract(10, 'days');
      expect(result[0].from.format('YYYY-MM-DD')).toBe(startingDate.format('YYYY-MM-DD'));
      expect(result[0].to.format('YYYY-MM-DD')).toBe('2018-07-06');
    });

    it('should work for multiple cancellationPolicies at the same time', () => {
      const result = normalizePolicyDates(today, arrival, [
        {
          from: '2017-01-01', to: '2017-07-21', deadline: 365, amount: 22,
        },
        {
          from: '2018-01-01', to: '2018-07-06', deadline: 10, amount: 22,
        },
        {
          from: '2018-03-25', to: '2018-07-15', deadline: 70, amount: 22,
        },
      ]);
      expect(result.length).toBe(2);
      const startingDate = dayjs(arrival).subtract(10, 'days');
      expect(result[0].from.format('YYYY-MM-DD')).toBe(startingDate.format('YYYY-MM-DD'));
      expect(result[0].to.format('YYYY-MM-DD')).toBe('2018-07-06');
      expect(result[1].from.format('YYYY-MM-DD')).toBe('2018-05-12');
      expect(result[1].to.format('YYYY-MM-DD')).toBe('2018-07-15');
    });
  });

  describe('createFreeSchedule', () => {
    const policies = [
      { from: dayjs('2018-07-10'), to: dayjs('2018-07-25'), amount: 22 },
      { from: dayjs('2018-05-11'), to: dayjs('2018-07-14'), amount: 33 },
    ];

    it('should expand existing policy', () => {
      const result = createFeeSchedule(dayjs('2018-07-10'), dayjs('2018-07-25'), [policies[0]], defaultCancellationAmount);
      expect(Object.keys(result).length).toBe(16);
      for (let i = 10; i < 26; i += 1) {
        expect(result[`2018-07-${i}`].dateDayjs.format('YYYY-MM-DD')).toBe(`2018-07-${i}`);
        expect(result[`2018-07-${i}`].amount).toBe(22);
      }
    });

    it('should expand existing non-overlapping policies', () => {
      const result = createFeeSchedule(dayjs('2018-07-10'), dayjs('2018-07-20'), [
        { from: dayjs('2018-07-10'), to: dayjs('2018-07-13'), amount: 22 },
        { from: dayjs('2018-07-14'), to: dayjs('2018-07-20'), amount: 33 },
      ], defaultCancellationAmount);
      expect(Object.keys(result).length).toBe(11);
      for (let i = 10; i < 21; i += 1) {
        expect(result[`2018-07-${i}`].dateDayjs.format('YYYY-MM-DD')).toBe(`2018-07-${i}`);
        expect(result[`2018-07-${i}`].amount).toBe(i < 14 ? 22 : 33);
      }
    });

    it('should pick the most pro-hotel cancellationAmount if policies overlap', () => {
      const result = createFeeSchedule(dayjs('2018-07-10'), dayjs('2018-07-20'), [
        { from: dayjs('2018-07-10'), to: dayjs('2018-07-17'), amount: 22 },
        { from: dayjs('2018-07-13'), to: dayjs('2018-07-20'), amount: 33 },
      ], defaultCancellationAmount);
      expect(Object.keys(result).length).toBe(11);
      for (let i = 10; i < 21; i += 1) {
        expect(result[`2018-07-${i}`].dateDayjs.format('YYYY-MM-DD')).toBe(`2018-07-${i}`);
        expect(result[`2018-07-${i}`].amount).toBe(i < 13 ? 22 : 33);
      }
    });

    it('should fill in blanks with defaulCancellationAmount', () => {
      const result = createFeeSchedule(dayjs('2018-07-10'), dayjs('2018-07-25'), [
        { from: dayjs('2018-07-12'), to: dayjs('2018-07-17'), amount: 22 },
        { from: dayjs('2018-07-13'), to: dayjs('2018-07-20'), amount: 33 },
      ], defaultCancellationAmount);
      expect(Object.keys(result).length).toBe(16);
      for (let i = 10; i < 26; i += 1) {
        let expected = defaultCancellationAmount;
        if (i >= 12 && i <= 12) {
          expected = 22;
        }
        if (i >= 13 && i <= 20) {
          expected = 33;
        }
        expect(result[`2018-07-${i}`].dateDayjs.format('YYYY-MM-DD')).toBe(`2018-07-${i}`);
        expect(result[`2018-07-${i}`].amount).toBe(expected);
      }
    });
  });

  describe('reduceFeeSchedule', () => {
    it('should compact neighbouring dates with the same amount', () => {
      const schedule = {
        '2018-07-10': { dateDayjs: dayjs('2018-07-10'), amount: 11 },
        '2018-07-11': { dateDayjs: dayjs('2018-07-11'), amount: 11 },
        '2018-07-12': { dateDayjs: dayjs('2018-07-12'), amount: 22 },
        '2018-07-13': { dateDayjs: dayjs('2018-07-13'), amount: 22 },
        '2018-07-14': { dateDayjs: dayjs('2018-07-14'), amount: 22 },
        '2018-07-15': { dateDayjs: dayjs('2018-07-15'), amount: 22 },
        '2018-07-16': { dateDayjs: dayjs('2018-07-16'), amount: 22 },
        '2018-07-17': { dateDayjs: dayjs('2018-07-17'), amount: 22 },
        '2018-07-18': { dateDayjs: dayjs('2018-07-18'), amount: 33 },
        '2018-07-19': { dateDayjs: dayjs('2018-07-19'), amount: 33 },
        '2018-07-20': { dateDayjs: dayjs('2018-07-20'), amount: 33 },
        '2018-07-21': { dateDayjs: dayjs('2018-07-21'), amount: 11 },
        '2018-07-22': { dateDayjs: dayjs('2018-07-22'), amount: 11 },
        '2018-07-23': { dateDayjs: dayjs('2018-07-23'), amount: 11 },
        '2018-07-24': { dateDayjs: dayjs('2018-07-24'), amount: 11 },
        '2018-07-25': { dateDayjs: dayjs('2018-07-25'), amount: 11 },
      };
      const result = reduceFeeSchedule(schedule);
      expect(result.length).toBe(4);
      expect(result[0].from).toBe('2018-07-10');
      expect(result[0].to).toBe('2018-07-11');
      expect(result[0].amount).toBe(11);
      expect(result[1].from).toBe('2018-07-12');
      expect(result[1].to).toBe('2018-07-17');
      expect(result[1].amount).toBe(22);
      expect(result[2].from).toBe('2018-07-18');
      expect(result[2].to).toBe('2018-07-20');
      expect(result[2].amount).toBe(33);
      expect(result[3].from).toBe('2018-07-21');
      expect(result[3].to).toBe('2018-07-25');
      expect(result[3].amount).toBe(11);
    });

    it('should work for a consistent amount over the whole period', () => {
      const schedule = {
        '2018-07-10': { dateDayjs: dayjs('2018-07-10'), amount: 11 },
        '2018-07-11': { dateDayjs: dayjs('2018-07-11'), amount: 11 },
        '2018-07-12': { dateDayjs: dayjs('2018-07-12'), amount: 11 },
        '2018-07-13': { dateDayjs: dayjs('2018-07-13'), amount: 11 },
        '2018-07-14': { dateDayjs: dayjs('2018-07-14'), amount: 11 },
      };
      const result = reduceFeeSchedule(schedule);
      expect(result.length).toBe(1);
      expect(result[0].from).toBe('2018-07-10');
      expect(result[0].to).toBe('2018-07-14');
      expect(result[0].amount).toBe(11);
    });
  });

  describe('computeCancellationFees', () => {
    it('should fallback to a defaultCancellationAmount if no policies are specified', () => {
      const result = computeCancellationFees(today, arrival, [], defaultCancellationAmount);
      expect(result.length).toBe(1);
      expect(result[0].from).toBe(today.format('YYYY-MM-DD'));
      expect(result[0].to).toBe(arrival.format('YYYY-MM-DD'));
      expect(result[0].amount).toBe(defaultCancellationAmount);
    });

    it('should fallback to a defaultCancellationAmount if no policies can be applied', () => {
      const result = computeCancellationFees(today, arrival, [
        {
          from: '2017-01-01', to: '2017-12-31', deadline: 200, amount: 22,
        },
      ], defaultCancellationAmount);
      expect(result.length).toBe(1);
      expect(result[0].from).toBe(today.format('YYYY-MM-DD'));
      expect(result[0].to).toBe(arrival.format('YYYY-MM-DD'));
      expect(result[0].amount).toBe(defaultCancellationAmount);
    });

    it('should use the only applicable policy if it covers the whole today-arrival period', () => {
      const result = computeCancellationFees(today, arrival, [
        {
          from: '2018-01-01', to: '2018-12-31', deadline: 200, amount: 22,
        },
      ], defaultCancellationAmount);
      expect(result.length).toBe(1);
      expect(result[0].from).toBe(today.format('YYYY-MM-DD'));
      expect(result[0].to).toBe(arrival.format('YYYY-MM-DD'));
      expect(result[0].amount).toBe(22);
    });

    it('should use the only applicable policy if it covers only part of the today-arrival period', () => {
      const result = computeCancellationFees(today, arrival, [
        {
          from: '2018-01-01', to: '2018-12-31', deadline: 30, amount: 22,
        },
      ], defaultCancellationAmount);
      expect(result.length).toBe(2);
      expect(result[0].from).toBe(today.format('YYYY-MM-DD'));
      expect(result[0].to).toBe('2018-06-20');
      expect(result[0].amount).toBe(11);
      expect(result[1].from).toBe('2018-06-21');
      expect(result[1].to).toBe(arrival.format('YYYY-MM-DD'));
      expect(result[1].amount).toBe(22);
    });

    it('should use the only applicable policy if it starts in the middle of the today-arrival period', () => {
      const result = computeCancellationFees(today, arrival, [
        {
          from: '2018-06-15', to: '2018-12-31', deadline: 200, amount: 22,
        },
      ], defaultCancellationAmount);
      expect(result.length).toBe(2);
      expect(result[0].from).toBe(today.format('YYYY-MM-DD'));
      expect(result[0].to).toBe('2018-06-14');
      expect(result[0].amount).toBe(11);
      expect(result[1].from).toBe('2018-06-15');
      expect(result[1].to).toBe(arrival.format('YYYY-MM-DD'));
      expect(result[1].amount).toBe(22);
    });

    it('should use the only applicable policy if it ends in the middle of the today-arrival period', () => {
      const result = computeCancellationFees(today, arrival, [
        {
          from: '2018-01-01', to: '2018-06-15', deadline: 200, amount: 22,
        },
      ], defaultCancellationAmount);
      expect(result.length).toBe(2);
      expect(result[0].from).toBe(today.format('YYYY-MM-DD'));
      expect(result[0].to).toBe('2018-06-15');
      expect(result[0].amount).toBe(22);
      expect(result[1].from).toBe('2018-06-16');
      expect(result[1].to).toBe(arrival.format('YYYY-MM-DD'));
      expect(result[1].amount).toBe(11);
    });

    it('should use the only applicable policy if it has no from specified', () => {
      const result = computeCancellationFees(today, arrival, [
        { to: '2018-12-31', deadline: 200, amount: 22 },
      ], defaultCancellationAmount);
      expect(result.length).toBe(1);
      expect(result[0].from).toBe(today.format('YYYY-MM-DD'));
      expect(result[0].to).toBe(arrival.format('YYYY-MM-DD'));
      expect(result[0].amount).toBe(22);
    });

    it('should use the only applicable policy if it has no to specified', () => {
      const result = computeCancellationFees(today, arrival, [
        { from: '2018-01-01', deadline: 200, amount: 22 },
      ], defaultCancellationAmount);
      expect(result.length).toBe(1);
      expect(result[0].from).toBe(today.format('YYYY-MM-DD'));
      expect(result[0].to).toBe(arrival.format('YYYY-MM-DD'));
      expect(result[0].amount).toBe(22);
    });

    it('should work for random time of day', () => {
      const t = dayjs('2018-11-16 15:34');
      const a = dayjs('2018-11-26');
      const result = computeCancellationFees(t, a, [
        {
          from: '2018-01-01', to: '2018-11-30', deadline: 200, amount: 22,
        },
      ], defaultCancellationAmount);
      expect(result.length).toBe(1);
      expect(result[0].from).toBe(t.format('YYYY-MM-DD'));
      expect(result[0].to).toBe(a.format('YYYY-MM-DD'));
      expect(result[0].amount).toBe(22);
    });

    it('should work for a complex example', () => {
      // example taken randomly from https://github.com/windingtree/wt-booking-api/blob/ef4ff2e2a5816bba0789a44f07dff3d5f5232cf3/test/services/adapter.spec.js#L171
      const result = computeCancellationFees(dayjs('2018-12-01'), dayjs('2019-03-28'), [
        {
          from: '2018-01-01', to: '2018-12-31', amount: 29, deadline: 86,
        },
        {
          /* from: '2018-01-01', */ to: '2018-12-31', amount: 49, deadline: 51,
        },
        {
          from: '2018-01-01', to: '2018-12-31', amount: 74, deadline: 35,
        },
        { from: '2019-01-01', /* to: '2019-12-31', */ amount: 50, deadline: 51 },
        {
          from: '2019-01-01', to: '2019-12-31', amount: 30, deadline: 86,
        },
        { from: '2019-01-01', /* to: '2019-12-31', */ amount: 75, deadline: 35 },
      ], 10);
      expect(result.length).toBe(4);
      expect(result[0].from).toBe('2018-12-01');
      expect(result[0].to).toBe('2018-12-31');
      expect(result[0].amount).toBe(10);
      expect(result[1].from).toBe('2019-01-01');
      expect(result[1].to).toBe('2019-02-04');
      expect(result[1].amount).toBe(30);
      expect(result[2].from).toBe('2019-02-05');
      expect(result[2].to).toBe('2019-02-20');
      expect(result[2].amount).toBe(50);
      expect(result[3].from).toBe('2019-02-21');
      expect(result[3].to).toBe('2019-03-28');
      expect(result[3].amount).toBe(75);
    });
  });
});
