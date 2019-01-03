import dayjs from 'dayjs';
import currency from 'currency.js';
import { computePrices, computeStayPrices, computeDailyPrice } from '../../src/prices';

describe('prices.index', () => {
  let guests;
  let arrivalDateDayjs;
  let departureDateDayjs;
  let fallbackCurrency;
  let ratePlans;
  let roomTypes;

  beforeEach(() => {
    guests = [{ age: 18 }];
    arrivalDateDayjs = dayjs('2018-01-03');
    departureDateDayjs = dayjs('2018-01-05');
    fallbackCurrency = 'CZK';
    ratePlans = [
      {
        id: 'rpa',
        price: 100,
        roomTypeIds: ['rtb'],
        availableForReservation: {
          from: '2018-01-01',
          to: '2020-12-31',
        },
        availableForTravel: {
          from: '2016-06-01',
          to: '2020-12-31',
        },
      },
    ];
    roomTypes = [
      { id: 'rta' },
      { id: 'rtb' },
    ];
  });

  describe('computePrices', () => {
    it('should return null price if no rate plan matches the room type', () => {
      const result = computePrices(new Date(), '2018-01-03', '2018-01-05', guests, roomTypes, ratePlans, fallbackCurrency);
      expect(result.find(e => e.id === 'rta')).toHaveProperty('prices', []);
    });

    it('should return a single price if a rate plan matches the room type', () => {
      const result = computePrices(new Date(), '2018-01-03', '2018-01-05', guests, roomTypes, ratePlans, fallbackCurrency);
      const rtb = result.find(e => e.id === 'rtb');
      expect(rtb).toHaveProperty('prices');
      expect(rtb.prices.length).toBe(1);
      expect(rtb.prices[0].currency).toBe('CZK');
      expect(rtb.prices[0].total).toHaveProperty('s.symbol', 'CZK');
      expect(rtb.prices[0].total.format()).toBe(currency(200).format());
    });

    it('should return prices in multiple currencies', () => {
      ratePlans.push({
        id: 'rpa-eur',
        currency: 'EUR',
        price: 33,
        roomTypeIds: ['rtb'],
        availableForReservation: {
          from: '2018-01-01',
          to: '2020-12-31',
        },
        availableForTravel: {
          from: '2016-06-01',
          to: '2020-12-31',
        },
      });
      const result = computePrices(new Date(), '2018-01-03', '2018-01-05', guests, roomTypes, ratePlans, fallbackCurrency);
      const rtb = result.find(e => e.id === 'rtb');
      expect(rtb).toHaveProperty('prices');
      expect(rtb.prices.length).toBe(2);
      expect(rtb.prices[0].currency).toBe('CZK');
      expect(rtb.prices[0].total).toHaveProperty('s.symbol', 'CZK');
      expect(rtb.prices[0].total.format()).toBe(currency(200).format());
      expect(rtb.prices[1].currency).toBe('EUR');
      expect(rtb.prices[1].total).toHaveProperty('s.symbol', 'EUR');
      expect(rtb.prices[1].total.format()).toBe(currency(66).format());
    });
  });

  describe('computeStayPrices', () => {
    it('should return the lowest price if no modifiers are present and multiple rate plans fit', () => {
      ratePlans[1] = {
        id: 'rpb',
        price: 60,
        roomTypeIds: ['rtb'],
        availableForReservation: {
          from: '2018-01-01',
          to: '2020-12-31',
        },
        availableForTravel: {
          from: '2016-06-01',
          to: '2020-09-30',
        },
      };

      const result = computeStayPrices(
        arrivalDateDayjs, departureDateDayjs, guests,
        fallbackCurrency,
        ratePlans,
      );
      expect(result).toHaveProperty(fallbackCurrency);
      expect(result[fallbackCurrency].length).toBe(2);
      expect(result[fallbackCurrency][0].format()).toBe(currency(60).format());
      expect(result[fallbackCurrency][0]).toHaveProperty('s.symbol', fallbackCurrency);
      expect(result[fallbackCurrency][1].format()).toBe(currency(60).format());
      expect(result[fallbackCurrency][1]).toHaveProperty('s.symbol', fallbackCurrency);
    });

    it('should return the lowest price if no modifiers are present and multiple rate plans fit (one without availableForTravel)', () => {
      ratePlans[1] = {
        id: 'rpb',
        price: 60,
        roomTypeIds: ['rtb'],
      };

      const result = computeStayPrices(
        arrivalDateDayjs, departureDateDayjs, guests,
        fallbackCurrency,
        ratePlans,
      );
      expect(result).toHaveProperty(fallbackCurrency);
      expect(result[fallbackCurrency].length).toBe(2);
      expect(result[fallbackCurrency][0].format()).toBe(currency(60).format());
      expect(result[fallbackCurrency][0]).toHaveProperty('s.symbol', fallbackCurrency);
      expect(result[fallbackCurrency][1].format()).toBe(currency(60).format());
      expect(result[fallbackCurrency][1]).toHaveProperty('s.symbol', fallbackCurrency);
    });

    it('should combine multiple rate plans if the stay range hits both of them', () => {
      ratePlans[0] = Object.assign(
        {},
        ratePlans[0], {
          price: 73,
          availableForTravel: {
            from: '2018-10-02',
            to: '2018-10-06',
          },
        },
      );
      ratePlans[1] = {
        id: 'rpb',
        price: 60,
        roomTypeIds: ['rtb'],
        availableForReservation: {
          from: '2018-01-01',
          to: '2020-12-31',
        },
        availableForTravel: {
          from: '2018-10-07',
          to: '2018-10-10',
        },
      };

      const result = computeStayPrices(
        dayjs('2018-10-02'), dayjs('2018-10-10'), [{ age: 10 }, { age: 20 }, { age: 30 }],
        fallbackCurrency,
        ratePlans,
      );
      expect(result).toHaveProperty(fallbackCurrency);
      expect(result[fallbackCurrency].length).toBe(8);
      expect(result[fallbackCurrency][0].format()).toBe(currency(3 * 73).format()); // 10-02
      expect(result[fallbackCurrency][1].format()).toBe(currency(3 * 73).format()); // 10-03
      expect(result[fallbackCurrency][2].format()).toBe(currency(3 * 73).format()); // 10-04
      expect(result[fallbackCurrency][3].format()).toBe(currency(3 * 73).format()); // 10-05
      expect(result[fallbackCurrency][4].format()).toBe(currency(3 * 73).format()); // 10-06
      expect(result[fallbackCurrency][5].format()).toBe(currency(3 * 60).format()); // 10-07
      expect(result[fallbackCurrency][6].format()).toBe(currency(3 * 60).format()); // 10-08
      expect(result[fallbackCurrency][7].format()).toBe(currency(3 * 60).format()); // 10-09
      expect(result[fallbackCurrency][0].s.symbol).toBe(fallbackCurrency);
      expect(result[fallbackCurrency][1].s.symbol).toBe(fallbackCurrency);
      expect(result[fallbackCurrency][2].s.symbol).toBe(fallbackCurrency);
      expect(result[fallbackCurrency][3].s.symbol).toBe(fallbackCurrency);
      expect(result[fallbackCurrency][4].s.symbol).toBe(fallbackCurrency);
      expect(result[fallbackCurrency][5].s.symbol).toBe(fallbackCurrency);
      expect(result[fallbackCurrency][6].s.symbol).toBe(fallbackCurrency);
      expect(result[fallbackCurrency][7].s.symbol).toBe(fallbackCurrency);
    });

    it('should combine multiple rate plans if the stay range hits both of them (one without availableForTravel)', () => {
      ratePlans[0] = Object.assign(
        {},
        ratePlans[0], {
          price: 60,
          availableForTravel: {
            from: '2018-10-02',
            to: '2018-10-06',
          },
        },
      );
      ratePlans[1] = {
        id: 'rpb',
        price: 73,
        roomTypeIds: ['rtb'],
      };

      const result = computeStayPrices(
        dayjs('2018-10-02'), dayjs('2018-10-10'), [{ age: 10 }, { age: 20 }, { age: 30 }],
        fallbackCurrency,
        ratePlans,
      );
      expect(result).toHaveProperty(fallbackCurrency);
      expect(result[fallbackCurrency].length).toBe(8);
      expect(result[fallbackCurrency][0].format()).toBe(currency(3 * 60).format()); // 10-02
      expect(result[fallbackCurrency][1].format()).toBe(currency(3 * 60).format()); // 10-03
      expect(result[fallbackCurrency][2].format()).toBe(currency(3 * 60).format()); // 10-04
      expect(result[fallbackCurrency][3].format()).toBe(currency(3 * 60).format()); // 10-05
      expect(result[fallbackCurrency][4].format()).toBe(currency(3 * 60).format()); // 10-06
      expect(result[fallbackCurrency][5].format()).toBe(currency(3 * 73).format()); // 10-07
      expect(result[fallbackCurrency][6].format()).toBe(currency(3 * 73).format()); // 10-08
      expect(result[fallbackCurrency][7].format()).toBe(currency(3 * 73).format()); // 10-09
      expect(result[fallbackCurrency][0].s.symbol).toBe(fallbackCurrency);
      expect(result[fallbackCurrency][1].s.symbol).toBe(fallbackCurrency);
      expect(result[fallbackCurrency][2].s.symbol).toBe(fallbackCurrency);
      expect(result[fallbackCurrency][3].s.symbol).toBe(fallbackCurrency);
      expect(result[fallbackCurrency][4].s.symbol).toBe(fallbackCurrency);
      expect(result[fallbackCurrency][5].s.symbol).toBe(fallbackCurrency);
      expect(result[fallbackCurrency][6].s.symbol).toBe(fallbackCurrency);
      expect(result[fallbackCurrency][7].s.symbol).toBe(fallbackCurrency);
    });

    it('should not return an estimate if even a single date of a stay is not covered by a valid rate plan', () => {
      ratePlans[0] = Object.assign(
        {},
        ratePlans[0], {
          price: 73,
          availableForTravel: {
            from: '2018-10-02',
            to: '2018-10-04',
          },
        },
      );
      ratePlans[1] = {
        id: 'rpb',
        price: 60,
        roomTypeIds: ['rtb'],
        availableForReservation: {
          from: '2018-01-01',
          to: '2020-12-31',
        },
        availableForTravel: {
          from: '2018-10-07',
          to: '2018-10-10',
        },
      };

      const result = computeStayPrices(
        dayjs('2018-10-02'), dayjs('2018-10-10'), guests,
        fallbackCurrency,
        ratePlans,
      );
      expect(result).not.toHaveProperty(fallbackCurrency);
    });

    it('should not combine rate plans with different currencies', () => {
      ratePlans[0] = Object.assign(
        {},
        ratePlans[0], {
          price: 71,
          availableForTravel: {
            from: '2018-10-02',
            to: '2018-10-06',
          },
          currency: 'EUR',
        },
      );
      ratePlans[1] = {
        id: 'rpb',
        price: 17,
        roomTypeIds: ['rtb'],
        availableForReservation: {
          from: '2018-01-01',
          to: '2020-12-31',
        },
        availableForTravel: {
          from: '2018-10-07',
          to: '2018-10-10',
        },
        currency: 'GBP',
      };
      ratePlans[2] = {
        id: 'rpb',
        price: 21,
        roomTypeIds: ['rtb'],
        availableForReservation: {
          from: '2018-01-01',
          to: '2020-12-31',
        },
        availableForTravel: {
          from: '2018-10-07',
          to: '2018-10-10',
        },
        currency: 'EUR',
      };

      const result = computeStayPrices(
        dayjs('2018-10-02'), dayjs('2018-10-10'), guests,
        fallbackCurrency,
        ratePlans,
      );

      expect(result).not.toHaveProperty(fallbackCurrency);
      expect(result).not.toHaveProperty('GBP');
      expect(result).toHaveProperty('EUR');
      expect(result.EUR[0].format()).toBe(currency(71).format());
      expect(result.EUR[1].format()).toBe(currency(71).format());
      expect(result.EUR[2].format()).toBe(currency(71).format());
      expect(result.EUR[3].format()).toBe(currency(71).format());
      expect(result.EUR[4].format()).toBe(currency(71).format());
      expect(result.EUR[5].format()).toBe(currency(21).format());
      expect(result.EUR[6].format()).toBe(currency(21).format());
      expect(result.EUR[7].format()).toBe(currency(21).format());
      expect(result.EUR[0].s.symbol).toBe('EUR');
      expect(result.EUR[1].s.symbol).toBe('EUR');
      expect(result.EUR[2].s.symbol).toBe('EUR');
      expect(result.EUR[3].s.symbol).toBe('EUR');
      expect(result.EUR[4].s.symbol).toBe('EUR');
      expect(result.EUR[5].s.symbol).toBe('EUR');
      expect(result.EUR[6].s.symbol).toBe('EUR');
      expect(result.EUR[7].s.symbol).toBe('EUR');
    });
  });

  describe('computeDailyPrice', () => {
    it('should return base price if rate plan has no modifiers', () => {
      expect(computeDailyPrice([{ age: 18 }], 3, '2018-09-12', { price: 10 }).format()).toBe(currency(10).format());
      expect(computeDailyPrice((new Array(13)).map((i) => ({ age: 18 })), 3, '2018-09-12', { price: 10 }).format()).toBe(currency(130).format());
    });

    it('should pick the most pro-customer modifier (all positive)', () => {
      expect(computeDailyPrice([{ age: 18 }], 3, '2018-09-12', {
        price: 8,
        modifiers: [
          { adjustment: 25, conditions: {} },
          { adjustment: 50, conditions: {} },
        ],
      }).format()).toBe(currency(10).format());
    });

    it('should pick the most pro-customer modifier (all negative)', () => {
      expect(computeDailyPrice([{ age: 18 }], 3, '2018-09-12', {
        price: 8,
        modifiers: [
          { adjustment: -25, conditions: {} },
          { adjustment: -50, conditions: {} },
        ],
      }).format()).toBe(currency(4).format());
    });

    it('should pick the most pro-customer modifier (mixed)', () => {
      expect(computeDailyPrice([{ age: 18 }], 3, '2018-09-12', {
        price: 8,
        modifiers: [
          { adjustment: -25, conditions: {} },
          { adjustment: -10, conditions: {} },
          { adjustment: 13, conditions: {} },
          { adjustment: 50, conditions: {} },
        ],
      }).format()).toBe(currency(6).format());
    });

    describe('modifier combinations', () => {
      it('should pick the modifier with the best price if multiple are applicable', () => {
        expect(computeDailyPrice([{ age: 18 }, { age: 16 }], 3, '2018-09-12', {
          price: 8,
          modifiers: [
            { adjustment: -75, conditions: { minOccupants: 2 } },
            { adjustment: -50, conditions: { lengthOfStay: 3 } },
          ],
        }).format()).toBe(currency(2 * 2).format());
      });

      it('should pick the guest-specific modifier if multiple are applicable', () => {
        expect(computeDailyPrice([{ age: 18 }, { age: 16 }], 3, '2018-09-12', {
          price: 10,
          modifiers: [
            { adjustment: -25, conditions: { minOccupants: 2 } },
            { adjustment: -10, conditions: { lengthOfStay: 3 } },
            { adjustment: -20, conditions: { maxAge: 16 } },
          ],
        }).format()).toBe(currency(8 + 7.5).format());
      });

      it('combine maxAge + minOccupants', () => {
        expect(computeDailyPrice([{ age: 18 }, { age: 16 }], 3, '2018-09-12', {
          price: 10,
          modifiers: [
            { adjustment: -20, conditions: { minOccupants: 2, maxAge: 16 } },
            { adjustment: -25, conditions: { minOccupants: 3, maxAge: 16 } },
          ],
        }).format()).toBe(currency(10 + 8).format());
      });

      it('combine maxAge + lengthOfStay', () => {
        expect(computeDailyPrice([{ age: 18 }, { age: 16 }], 3, '2018-09-12', {
          price: 10,
          modifiers: [
            { adjustment: -20, conditions: { lengthOfStay: 2, maxAge: 16 } },
            { adjustment: -25, conditions: { lengthOfStay: 3, maxAge: 16 } },
          ],
        }).format()).toBe(currency(10 + 7.5).format());
      });

      it('combine maxAge + lengthOfStay + minOccupants', () => {
        expect(computeDailyPrice([{ age: 18 }, { age: 16 }], 3, '2018-09-12', {
          price: 10,
          modifiers: [
            { adjustment: -10, conditions: { lengthOfStay: 2, minOccupants: 2, maxAge: 16 } },
            { adjustment: -20, conditions: { lengthOfStay: 3, minOccupants: 3, maxAge: 16 } },
            { adjustment: -30, conditions: { lengthOfStay: 3, minOccupants: 2, maxAge: 16 } },
            { adjustment: -40, conditions: { lengthOfStay: 2, minOccupants: 3, maxAge: 16 } },
          ],
        }).format()).toBe(currency(10 + 7).format());
      });
    });

    describe('maxAge', () => {
      it('should apply modifier to some of the guests if they are under or on par with the limit', () => {
        expect(computeDailyPrice([{ age: 11 }, { age: 18 }, { age: 30 }], 3, '2018-09-12', {
          price: 8,
          modifiers: [
            { adjustment: -25, conditions: { maxAge: 18 } },
          ],
        }).format()).toBe(currency(8 * 1 + 6 * 2).format());
      });

      it('should apply a fitting modifier to each guests', () => {
        expect(computeDailyPrice([{ age: 25 }, { age: 18 }, { age: 16 }], 3, '2018-09-12', {
          price: 8,
          modifiers: [
            { adjustment: -10, conditions: { maxAge: 25 } },
            { adjustment: -50, conditions: { maxAge: 18 } },
            { adjustment: -25, conditions: { maxAge: 16 } },
          ],
        }).format()).toBe(currency(7.2 + 4 + 6).format());
      });
    });
  });
});
