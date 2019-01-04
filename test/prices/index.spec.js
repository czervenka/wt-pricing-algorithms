import dayjs from 'dayjs';
import currency from 'currency.js';
import { PriceComputer, computeDailyPrice } from '../../src/prices';

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

  describe('PriceComputer', () => {
    let computer;

    beforeEach(() => {
      computer = new PriceComputer(roomTypes, ratePlans, fallbackCurrency);
    });

    describe('constructor', () => {
      it('should throw when there are no roomTypes', () => {
        expect(() => {
          // eslint-disable-next-line no-new
          new PriceComputer(null, ratePlans, fallbackCurrency);
        }).toThrow();
      });

      it('should throw when there are no ratePlans', () => {
        expect(() => {
          // eslint-disable-next-line no-new
          new PriceComputer(roomTypes, null, fallbackCurrency);
        }).toThrow();
      });

      it('should throw when there is no defaultCurrency', () => {
        expect(() => {
          // eslint-disable-next-line no-new
          new PriceComputer(roomTypes, ratePlans, null);
        }).toThrow();
      });
    });

    describe('getBestPrice', () => {
      it('should return null price if no rate plan matches the room type', () => {
        const result = computer.getBestPrice(new Date(), '2018-01-03', '2018-01-05', guests);
        expect(result.find(e => e.id === 'rta')).toHaveProperty('prices', []);
      });

      it('should return a single price if a rate plan matches the room type', () => {
        const result = computer.getBestPrice(new Date(), '2018-01-03', '2018-01-05', guests);
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
        const result = computer.getBestPrice(new Date(), '2018-01-03', '2018-01-05', guests);
        expect(result.length).toBe(2);
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

      it('should return a price in a single currency if requested', () => {
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
        const result = computer.getBestPrice(new Date(), '2018-01-03', '2018-01-05', guests, 'EUR');
        expect(result.length).toBe(2);
        const rtb = result.find(e => e.id === 'rtb');
        expect(rtb).toHaveProperty('prices');
        expect(rtb.prices.length).toBe(1);
        expect(rtb.prices[0].currency).toBe('EUR');
        expect(rtb.prices[0].total).toHaveProperty('s.symbol', 'EUR');
        expect(rtb.prices[0].total.format()).toBe(currency(66).format());
      });

      it('should return a price for a single room type if requested', () => {
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
        const result = computer.getBestPrice(new Date(), '2018-01-03', '2018-01-05', guests, null, 'rtb');
        expect(result.length).toBe(1);
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
      
      it('should return a price for a single room type and currency if requested', () => {
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
        const result = computer.getBestPrice(new Date(), '2018-01-03', '2018-01-05', guests, 'CZK', 'rtb');
        expect(result.length).toBe(1);
        const rtb = result.find(e => e.id === 'rtb');
        expect(rtb).toHaveProperty('prices');
        expect(rtb.prices.length).toBe(1);
        expect(rtb.prices[0].currency).toBe('CZK');
        expect(rtb.prices[0].total).toHaveProperty('s.symbol', 'CZK');
        expect(rtb.prices[0].total.format()).toBe(currency(200).format());
      });

      it('should return the lowest price if no modifiers are present and multiple rate plans fit', () => {
        computer.ratePlans[1] = {
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
        const result = computer.getBestPrice(new Date(), arrivalDateDayjs, departureDateDayjs, guests, fallbackCurrency, 'rtb');
        const rtbResult = result.find((r) => r.id === 'rtb');
        expect(rtbResult).toHaveProperty('prices');
        expect(rtbResult.prices.length).toBe(1);
        expect(rtbResult.prices[0]).toHaveProperty('currency', fallbackCurrency);
        expect(rtbResult.prices[0]).toHaveProperty('total');
        expect(rtbResult.prices[0].total.format()).toBe(currency(60 + 60).format());
      });

      it('should return the lowest price if no modifiers are present and multiple rate plans fit (one without availableForTravel)', () => {
        computer.ratePlans[1] = {
          id: 'rpb',
          price: 60,
          roomTypeIds: ['rtb'],
        };
        const result = computer.getBestPrice(new Date(), arrivalDateDayjs, departureDateDayjs, guests, fallbackCurrency);
        const rtbResult = result.find((r) => r.id === 'rtb');
        expect(rtbResult).toHaveProperty('prices');
        expect(rtbResult.prices.length).toBe(1);
        expect(rtbResult.prices[0]).toHaveProperty('currency', fallbackCurrency);
        expect(rtbResult.prices[0]).toHaveProperty('total');
        expect(rtbResult.prices[0].total.format()).toBe(currency(60 + 60).format());
      });

      it('should combine multiple rate plans if the stay range hits both of them', () => {
        computer.ratePlans[0] = Object.assign(
          {},
          computer.ratePlans[0], {
            price: 73,
            availableForTravel: {
              from: '2018-10-02',
              to: '2018-10-06',
            },
          },
        );
        computer.ratePlans[1] = {
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
        const result = computer.getBestPrice('2018-09-01', '2018-10-02', '2018-10-10', [{ age: 10 }, { age: 20 }, { age: 30 }], fallbackCurrency, 'rtb');
        const rtbResult = result.find((r) => r.id === 'rtb');
        expect(rtbResult).toHaveProperty('prices');
        expect(rtbResult.prices.length).toBe(1);
        expect(rtbResult.prices[0]).toHaveProperty('currency', fallbackCurrency);
        expect(rtbResult.prices[0]).toHaveProperty('total');
        expect(rtbResult.prices[0].total.format()).toBe(currency((5 * 3 * 73) + (3 * 3 * 60)).format());
        expect(rtbResult.prices[0].total).toHaveProperty('s.symbol', fallbackCurrency);
      });

      it('should combine multiple rate plans if the stay range hits both of them (one without availableForTravel)', () => {
        computer.ratePlans[0] = Object.assign(
          {},
          computer.ratePlans[0], {
            price: 60,
            availableForTravel: {
              from: '2018-10-02',
              to: '2018-10-06',
            },
          },
        );
        computer.ratePlans[1] = {
          id: 'rpb',
          price: 73,
          roomTypeIds: ['rtb'],
        };

        const result = computer.getBestPrice(new Date(), '2018-10-02', '2018-10-10', [{ age: 10 }, { age: 20 }, { age: 30 }], fallbackCurrency, 'rtb');
        const rtbResult = result.find((r) => r.id === 'rtb');
        expect(rtbResult).toHaveProperty('prices');
        expect(rtbResult.prices.length).toBe(1);
        expect(rtbResult.prices[0]).toHaveProperty('currency', fallbackCurrency);
        expect(rtbResult.prices[0]).toHaveProperty('total');
        expect(rtbResult.prices[0].total.format()).toBe(currency((5 * 3 * 60) + (3 * 3 * 73)).format());
        expect(rtbResult.prices[0].total).toHaveProperty('s.symbol', fallbackCurrency);
      });

      it('should not return an estimate if even a single date of a stay is not covered by a valid rate plan', () => {
        computer.ratePlans[0] = Object.assign(
          {},
          computer.ratePlans[0], {
            price: 73,
            availableForTravel: {
              from: '2018-10-02',
              to: '2018-10-04',
            },
          },
        );
        computer.ratePlans[1] = {
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

        const result = computer.getBestPrice('2018-09-01', '2018-10-02', '2018-10-10', guests, fallbackCurrency, 'rtb');
        const rtbResult = result.find((r) => r.id === 'rtb');
        expect(rtbResult).toHaveProperty('prices');
        expect(rtbResult.prices.length).toBe(0);
      });

      it('should not combine rate plans with different currencies', () => {
        computer.ratePlans[0] = Object.assign(
          {},
          computer.ratePlans[0], {
            price: 71,
            availableForTravel: {
              from: '2018-10-02',
              to: '2018-10-06',
            },
            currency: 'EUR',
          },
        );
        computer.ratePlans[1] = {
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
        computer.ratePlans[2] = {
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

        const result = computer.getBestPrice('2018-09-01', '2018-10-02', '2018-10-10', guests);
        const rtbResult = result.find((r) => r.id === 'rtb');
        expect(rtbResult).toHaveProperty('prices');
        expect(rtbResult.prices.length).toBe(1);
        expect(rtbResult.prices[0]).toHaveProperty('currency', 'EUR');
        expect(rtbResult.prices[0]).toHaveProperty('total');
        expect(rtbResult.prices[0].total.format()).toBe(currency((5 * 71) + (3 * 21)).format());
        expect(rtbResult.prices[0].total).toHaveProperty('s.symbol', 'EUR');
      });
    });

    describe('getPossiblePricesWithSingleRatePlan', () => {

    });
  });

  describe('computeDailyRatePlans', () => {
    // This is mainly covered in various PriceComputer strategies
    // TODO make separate tests
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
