import dayjs from 'dayjs';
import currency from 'currency.js';
import { computeDailyRatePlans, computeDailyPrice } from '../../src/prices/utils';

describe('prices.index', () => {
  let guests;
  let arrivalDateDayjs;
  let departureDateDayjs;
  let fallbackCurrency;
  let ratePlans;

  beforeEach(() => {
    guests = [{ id: 'g1', age: 18 }];
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
  });

  describe('computeDailyRatePlans', () => {
    it('should return all possible rate plans for all days in a single currency', () => {
      ratePlans[1] = {
        id: 'rpb',
        price: 60,
        roomTypeIds: ['rtb'],
      };

      const result = computeDailyRatePlans(arrivalDateDayjs, departureDateDayjs, guests, fallbackCurrency, ratePlans);
      const czkResult = result[fallbackCurrency];
      expect(czkResult.length).toBe(2);
      for (let i = 0; i < 2; i++) {
        expect(czkResult[i].length).toBe(2);
        expect(czkResult[i][0]).toHaveProperty('ratePlan');
        expect(czkResult[i][0]).toHaveProperty('total');
        expect(czkResult[i][0]).toHaveProperty('date');
        expect(czkResult[i][0].guestPrices.length).toBe(1);
        expect(czkResult[i][0].guestPrices[0]).toHaveProperty('resultingPrice');
        expect(czkResult[i][0].guestPrices[0].resultingPrice.format()).toBe(currency(100).format());
        expect(czkResult[i][1].guestPrices.length).toBe(1);
        expect(czkResult[i][1]).toHaveProperty('ratePlan');
        expect(czkResult[i][1]).toHaveProperty('total');
        expect(czkResult[i][1]).toHaveProperty('date');
        expect(czkResult[i][1].guestPrices[0]).toHaveProperty('resultingPrice');
        expect(czkResult[i][1].guestPrices[0].resultingPrice.format()).toBe(currency(60).format());
      }
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
      const result = computeDailyRatePlans(dayjs('2018-10-02'), dayjs('2018-10-10'), [{ age: 10 }, { age: 20 }, { age: 30 }], fallbackCurrency, ratePlans);
      const czkResult = result[fallbackCurrency];
      // 8 days
      expect(czkResult.length).toBe(8);
      for (let i = 0; i < 8; i++) {
        // 1 rate plan
        expect(czkResult[i].length).toBe(1);
        expect(czkResult[i][0]).toHaveProperty('ratePlan');
        expect(czkResult[i][0]).toHaveProperty('total');
        expect(czkResult[i][0].guestPrices.length).toBe(3);
        expect(czkResult[i][0].guestPrices[0]).toHaveProperty('resultingPrice');
        expect(czkResult[i][0].guestPrices[0].resultingPrice.format()).toBe(currency(i < 5 ? 73 : 60).format());
        expect(czkResult[i][0].guestPrices[1]).toHaveProperty('resultingPrice');
        expect(czkResult[i][0].guestPrices[1].resultingPrice.format()).toBe(currency(i < 5 ? 73 : 60).format());
        expect(czkResult[i][0].guestPrices[2]).toHaveProperty('resultingPrice');
        expect(czkResult[i][0].guestPrices[2].resultingPrice.format()).toBe(currency(i < 5 ? 73 : 60).format());
      }
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

      const result = computeDailyRatePlans(dayjs('2018-10-02'), dayjs('2018-10-10'), [{ age: 10 }, { age: 20 }, { age: 30 }], fallbackCurrency, ratePlans);
      const czkResult = result[fallbackCurrency];
      // 8 days
      expect(czkResult.length).toBe(8);
      for (let i = 0; i < 8; i++) {
        expect(czkResult[i].length).toBe(i < 5 ? 2 : 1);
        expect(czkResult[i][0]).toHaveProperty('ratePlan');
        expect(czkResult[i][0]).toHaveProperty('total');
        expect(czkResult[i][0].guestPrices.length).toBe(3);
        if (i < 5) {
          expect(czkResult[i][0].guestPrices[0]).toHaveProperty('resultingPrice');
          expect(czkResult[i][0].guestPrices[0].resultingPrice.format()).toBe(currency(60).format());
          expect(czkResult[i][0].guestPrices[1]).toHaveProperty('resultingPrice');
          expect(czkResult[i][0].guestPrices[1].resultingPrice.format()).toBe(currency(60).format());
          expect(czkResult[i][0].guestPrices[2]).toHaveProperty('resultingPrice');
          expect(czkResult[i][0].guestPrices[2].resultingPrice.format()).toBe(currency(60).format());
          expect(czkResult[i][1].guestPrices[0]).toHaveProperty('resultingPrice');
          expect(czkResult[i][1].guestPrices[0].resultingPrice.format()).toBe(currency(73).format());
          expect(czkResult[i][1].guestPrices[1]).toHaveProperty('resultingPrice');
          expect(czkResult[i][1].guestPrices[1].resultingPrice.format()).toBe(currency(73).format());
          expect(czkResult[i][1].guestPrices[2]).toHaveProperty('resultingPrice');
          expect(czkResult[i][1].guestPrices[2].resultingPrice.format()).toBe(currency(73).format());
        } else {
          expect(czkResult[i][0].guestPrices[0]).toHaveProperty('resultingPrice');
          expect(czkResult[i][0].guestPrices[0].resultingPrice.format()).toBe(currency(73).format());
          expect(czkResult[i][0].guestPrices[1]).toHaveProperty('resultingPrice');
          expect(czkResult[i][0].guestPrices[1].resultingPrice.format()).toBe(currency(73).format());
          expect(czkResult[i][0].guestPrices[2]).toHaveProperty('resultingPrice');
          expect(czkResult[i][0].guestPrices[2].resultingPrice.format()).toBe(currency(73).format());
        }
      }
    });

    it('should not return anything if even a single date of a stay is not covered by a valid rate plan', () => {
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

      const result = computeDailyRatePlans(dayjs('2018-10-02'), dayjs('2018-10-10'), [{ age: 10 }, { age: 20 }, { age: 30 }], fallbackCurrency, ratePlans);
      expect(Object.keys(result).length).toBe(0);
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

      const result = computeDailyRatePlans(dayjs('2018-10-02'), dayjs('2018-10-10'), [{ age: 10 }, { age: 20 }, { age: 30 }], fallbackCurrency, ratePlans);
      expect(result).not.toHaveProperty('GBP');
      const eurResult = result.EUR;
      expect(eurResult.length).toBe(8);

      for (let i = 0; i < 8; i++) {
        expect(eurResult[i].length).toBe(1);
        expect(eurResult[i][0]).toHaveProperty('ratePlan');
        expect(eurResult[i][0]).toHaveProperty('total');
        expect(eurResult[i][0].total.format()).toBe(i < 5 ? currency(213).format() : currency(63).format());
        expect(eurResult[i][0].guestPrices.length).toBe(3);
      }
    });
  });

  describe('computeDailyPrice', () => {
    it('should return base price if rate plan has no modifiers', () => {
      const result = computeDailyPrice([{ id: 'g1', age: 18 }], 3, '2018-09-12', { price: 10 });
      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('guestId');
      expect(result[0]).toHaveProperty('ratePlanId');
      expect(result[0]).toHaveProperty('basePrice');
      expect(result[0]).not.toHaveProperty('modifier');
      expect(result[0]).toHaveProperty('resultingPrice');
      expect(result[0].basePrice.format()).toBe(currency(10).format());
      expect(result[0].resultingPrice.format()).toBe(currency(10).format());
    });

    it('should return base price if rate plan has no modifiers for many people', () => {
      const result = computeDailyPrice((new Array(13)).fill({}).map((i, j) => ({ id: `g${j}`, age: 18 })), 3, '2018-09-12', { price: 10 });
      expect(result.length).toBe(13);
      for (let i = 0; i < 13; i++) {
        expect(result[i]).toHaveProperty('guestId', `g${i}`);
        expect(result[i]).toHaveProperty('ratePlanId');
        expect(result[i]).toHaveProperty('basePrice');
        expect(result[i]).not.toHaveProperty('modifier');
        expect(result[i]).toHaveProperty('resultingPrice');
        expect(result[i].basePrice.format()).toBe(currency(10).format());
        expect(result[i].resultingPrice.format()).toBe(currency(10).format());
      }
    });

    describe('percentage', () => {
      it('should pick the most pro-customer modifier (all positive)', () => {
        const result = computeDailyPrice([{ id: 'g1', age: 18 }], 3, '2018-09-12', {
          id: 'rateplan1',
          price: 8,
          modifiers: [
            { adjustment: 25, unit: 'percentage', conditions: {} },
            { adjustment: 50, unit: 'percentage', conditions: {} },
          ],
        });
        expect(result.length).toBe(1);
        expect(result[0]).toHaveProperty('guestId', 'g1');
        expect(result[0]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[0]).toHaveProperty('basePrice');
        expect(result[0]).toHaveProperty('modifier');
        expect(result[0].modifier).toHaveProperty('conditions');
        expect(result[0].modifier).toHaveProperty('unit', 'percentage');
        expect(result[0].modifier).toHaveProperty('adjustment', 25);
        expect(result[0].modifier).not.toHaveProperty('change');
        expect(result[0].basePrice.format()).toBe(currency(8).format());
        expect(result[0].resultingPrice.format()).toBe(currency(10).format());
      });

      it('should pick the most pro-customer modifier (all negative)', () => {
        const result = computeDailyPrice([{ id: 'g1', age: 18 }], 3, '2018-09-12', {
          id: 'rateplan1',
          price: 8,
          modifiers: [
            { adjustment: -25, unit: 'percentage', conditions: {} },
            { adjustment: -50, unit: 'percentage', conditions: {} },
          ],
        });
        expect(result.length).toBe(1);
        expect(result[0]).toHaveProperty('guestId', 'g1');
        expect(result[0]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[0]).toHaveProperty('basePrice');
        expect(result[0]).toHaveProperty('modifier');
        expect(result[0].modifier).toHaveProperty('conditions');
        expect(result[0].modifier).toHaveProperty('unit', 'percentage');
        expect(result[0].modifier).toHaveProperty('adjustment', -50);
        expect(result[0].basePrice.format()).toBe(currency(8).format());
        expect(result[0].resultingPrice.format()).toBe(currency(4).format());
      });

      it('should pick the most pro-customer modifier (mixed)', () => {
        const result = computeDailyPrice([{ id: 'g1', age: 18 }], 3, '2018-09-12', {
          id: 'rateplan1',
          price: 8,
          modifiers: [
            { adjustment: -25, unit: 'percentage', conditions: {} },
            { adjustment: -10, unit: 'percentage', conditions: {} },
            { adjustment: 13, unit: 'percentage', conditions: {} },
            { adjustment: 50, unit: 'percentage', conditions: {} },
          ],
        });
        expect(result.length).toBe(1);
        expect(result[0]).toHaveProperty('guestId', 'g1');
        expect(result[0]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[0]).toHaveProperty('basePrice');
        expect(result[0]).toHaveProperty('modifier');
        expect(result[0].modifier).toHaveProperty('conditions');
        expect(result[0].modifier).toHaveProperty('unit', 'percentage');
        expect(result[0].modifier).toHaveProperty('adjustment', -25);
        expect(result[0].basePrice.format()).toBe(currency(8).format());
        expect(result[0].resultingPrice.format()).toBe(currency(6).format());
      });
    });

    describe('absolute', () => {
      it('should pick the most pro-customer modifier (all positive)', () => {
        const result = computeDailyPrice([{ id: 'g1', age: 18 }], 3, '2018-09-12', {
          id: 'rateplan1',
          price: 8,
          modifiers: [
            { adjustment: 25, unit: 'absolute', conditions: {} },
            { adjustment: 50, unit: 'absolute', conditions: {} },
          ],
        });
        expect(result.length).toBe(1);
        expect(result[0]).toHaveProperty('guestId', 'g1');
        expect(result[0]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[0]).toHaveProperty('basePrice');
        expect(result[0]).toHaveProperty('modifier');
        expect(result[0].modifier).toHaveProperty('conditions');
        expect(result[0].modifier).toHaveProperty('unit', 'absolute');
        expect(result[0].modifier).toHaveProperty('adjustment', 25);
        expect(result[0].basePrice.format()).toBe(currency(8).format());
        expect(result[0].resultingPrice.format()).toBe(currency(33).format());
      });

      it('should pick the most pro-customer modifier (all negative)', () => {
        const result = computeDailyPrice([{ id: 'g1', age: 18 }], 3, '2018-09-12', {
          id: 'rateplan1',
          price: 8,
          modifiers: [
            { adjustment: -25, unit: 'absolute', conditions: {} },
            { adjustment: -50, unit: 'absolute', conditions: {} },
          ],
        });
        expect(result.length).toBe(1);
        expect(result[0]).toHaveProperty('guestId', 'g1');
        expect(result[0]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[0]).toHaveProperty('basePrice');
        expect(result[0]).toHaveProperty('modifier');
        expect(result[0].modifier).toHaveProperty('conditions');
        expect(result[0].modifier).toHaveProperty('unit', 'absolute');
        expect(result[0].modifier).toHaveProperty('adjustment', -50);
        expect(result[0].basePrice.format()).toBe(currency(8).format());
        expect(result[0].resultingPrice.format()).toBe(currency(-42).format());
      });

      it('should pick the most pro-customer modifier (mixed)', () => {
        const result = computeDailyPrice([{ id: 'g1', age: 18 }], 3, '2018-09-12', {
          id: 'rateplan1',
          price: 8,
          modifiers: [
            { adjustment: -25, unit: 'absolute', conditions: {} },
            { adjustment: -10, unit: 'absolute', conditions: {} },
            { adjustment: 13, unit: 'absolute', conditions: {} },
            { adjustment: 50, unit: 'absolute', conditions: {} },
          ],
        });
        expect(result.length).toBe(1);
        expect(result[0]).toHaveProperty('guestId', 'g1');
        expect(result[0]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[0]).toHaveProperty('basePrice');
        expect(result[0]).toHaveProperty('modifier');
        expect(result[0].modifier).toHaveProperty('conditions');
        expect(result[0].modifier).toHaveProperty('unit', 'absolute');
        expect(result[0].modifier).toHaveProperty('adjustment', -25);
        expect(result[0].basePrice.format()).toBe(currency(8).format());
        expect(result[0].resultingPrice.format()).toBe(currency(-17).format());
      });
    });

    describe('combined', () => {
      it('should pick the most pro-customer modifier (all positive)', () => {
        const result = computeDailyPrice([{ id: 'g1', age: 18 }], 3, '2018-09-12', {
          id: 'rateplan1',
          price: 8,
          modifiers: [
            { adjustment: 25, unit: 'percentage', conditions: {} },
            { adjustment: 1, unit: 'absolute', conditions: {} },
          ],
        });
        expect(result.length).toBe(1);
        expect(result[0]).toHaveProperty('guestId', 'g1');
        expect(result[0]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[0]).toHaveProperty('basePrice');
        expect(result[0]).toHaveProperty('modifier');
        expect(result[0].modifier).toHaveProperty('conditions');
        expect(result[0].modifier).toHaveProperty('unit', 'absolute');
        expect(result[0].modifier).toHaveProperty('adjustment', 1);
        expect(result[0].basePrice.format()).toBe(currency(8).format());
        expect(result[0].resultingPrice.format()).toBe(currency(9).format());
      });

      it('should pick the most pro-customer modifier (all negative)', () => {
        const result = computeDailyPrice([{ id: 'g1', age: 18 }], 3, '2018-09-12', {
          id: 'rateplan1',
          price: 8,
          modifiers: [
            { adjustment: -25, unit: 'percentage', conditions: {} },
            { adjustment: -1, unit: 'absolute', conditions: {} },
          ],
        });
        expect(result.length).toBe(1);
        expect(result[0]).toHaveProperty('guestId', 'g1');
        expect(result[0]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[0]).toHaveProperty('basePrice');
        expect(result[0]).toHaveProperty('modifier');
        expect(result[0].modifier).toHaveProperty('conditions');
        expect(result[0].modifier).toHaveProperty('unit', 'percentage');
        expect(result[0].modifier).toHaveProperty('adjustment', -25);
        expect(result[0].basePrice.format()).toBe(currency(8).format());
        expect(result[0].resultingPrice.format()).toBe(currency(6).format());
      });

      it('should pick the most pro-customer modifier (mixed)', () => {
        const result = computeDailyPrice([{ id: 'g1', age: 18 }], 3, '2018-09-12', {
          id: 'rateplan1',
          price: 8,
          modifiers: [
            { adjustment: -25, unit: 'percentage', conditions: {} },
            { adjustment: -10, unit: 'percentage', conditions: {} },
            { adjustment: 1, unit: 'absolute', conditions: {} },
            { adjustment: -1, unit: 'absolute', conditions: {} },
          ],
        });
        expect(result.length).toBe(1);
        expect(result[0]).toHaveProperty('guestId', 'g1');
        expect(result[0]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[0]).toHaveProperty('basePrice');
        expect(result[0]).toHaveProperty('modifier');
        expect(result[0].modifier).toHaveProperty('conditions');
        expect(result[0].modifier).toHaveProperty('unit', 'percentage');
        expect(result[0].modifier).toHaveProperty('adjustment', -25);
        expect(result[0].basePrice.format()).toBe(currency(8).format());
        expect(result[0].resultingPrice.format()).toBe(currency(6).format());
      });
    });

    describe('modifier combinations', () => {
      it('should pick the modifier with the best price if multiple are applicable', () => {
        const result = computeDailyPrice([{ id: 'g1', age: 18 }, { id: 'g2', age: 16 }], 3, '2018-09-12', {
          id: 'rateplan1',
          price: 8,
          modifiers: [
            { adjustment: -75, unit: 'percentage', conditions: { minOccupants: 2 } },
            { adjustment: -50, unit: 'percentage', conditions: { lengthOfStay: 3 } },
          ],
        });
        expect(result.length).toBe(2);
        expect(result[0]).toHaveProperty('guestId', 'g1');
        expect(result[0]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[0].modifier).toHaveProperty('conditions');
        expect(result[0].modifier).toHaveProperty('unit', 'percentage');
        expect(result[0].modifier).toHaveProperty('adjustment', -75);
        expect(result[0].basePrice.format()).toBe(currency(8).format());
        expect(result[0].resultingPrice.format()).toBe(currency(2).format());
        expect(result[1]).toHaveProperty('guestId', 'g2');
        expect(result[1]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[1].modifier).toHaveProperty('conditions');
        expect(result[1].modifier).toHaveProperty('unit', 'percentage');
        expect(result[1].modifier).toHaveProperty('adjustment', -75);
        expect(result[1].basePrice.format()).toBe(currency(8).format());
        expect(result[1].resultingPrice.format()).toBe(currency(2).format());
      });

      it('should pick the guest-specific modifier if multiple are applicable', () => {
        const result = computeDailyPrice([{ id: 'g1', age: 18 }, { id: 'g2', age: 16 }], 3, '2018-09-12', {
          id: 'rateplan1',
          price: 10,
          modifiers: [
            { adjustment: -25, unit: 'percentage', conditions: { minOccupants: 2 } },
            { adjustment: -10, unit: 'percentage', conditions: { lengthOfStay: 3 } },
            { adjustment: -20, unit: 'percentage', conditions: { maxAge: 16 } },
          ],
        });
        expect(result.length).toBe(2);
        expect(result[0]).toHaveProperty('guestId', 'g1');
        expect(result[0]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[0].modifier).toHaveProperty('conditions');
        expect(result[0].modifier).toHaveProperty('unit', 'percentage');
        expect(result[0].modifier).toHaveProperty('adjustment', -25);
        expect(result[0].basePrice.format()).toBe(currency(10).format());
        expect(result[0].resultingPrice.format()).toBe(currency(7.5).format());
        expect(result[1]).toHaveProperty('guestId', 'g2');
        expect(result[1]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[1].modifier).toHaveProperty('conditions');
        expect(result[1].modifier).toHaveProperty('unit', 'percentage');
        expect(result[1].modifier).toHaveProperty('adjustment', -20);
        expect(result[1].basePrice.format()).toBe(currency(10).format());
        expect(result[1].resultingPrice.format()).toBe(currency(8).format());
      });

      it('combine maxAge + minOccupants', () => {
        const result = computeDailyPrice([{ id: 'g1', age: 18 }, { id: 'g2', age: 16 }], 3, '2018-09-12', {
          id: 'rateplan1',
          price: 10,
          modifiers: [
            { adjustment: -20, unit: 'percentage', conditions: { minOccupants: 2, maxAge: 16 } },
            { adjustment: -25, unit: 'percentage', conditions: { minOccupants: 3, maxAge: 16 } },
          ],
        });
        expect(result.length).toBe(2);
        expect(result[0]).toHaveProperty('guestId', 'g1');
        expect(result[0]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[0]).not.toHaveProperty('modifier');
        expect(result[0].basePrice.format()).toBe(currency(10).format());
        expect(result[0].resultingPrice.format()).toBe(currency(10).format());
        expect(result[1]).toHaveProperty('guestId', 'g2');
        expect(result[1]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[1].modifier).toHaveProperty('conditions');
        expect(result[1].modifier).toHaveProperty('unit', 'percentage');
        expect(result[1].modifier).toHaveProperty('adjustment', -20);
        expect(result[1].basePrice.format()).toBe(currency(10).format());
        expect(result[1].resultingPrice.format()).toBe(currency(8).format());
      });

      it('combine maxAge + lengthOfStay', () => {
        const result = computeDailyPrice([{ id: 'g1', age: 18 }, { id: 'g2', age: 16 }], 3, '2018-09-12', {
          id: 'rateplan1',
          price: 10,
          modifiers: [
            { adjustment: -20, unit: 'percentage', conditions: { lengthOfStay: 2, maxAge: 16 } },
            { adjustment: -25, unit: 'percentage', conditions: { lengthOfStay: 3, maxAge: 16 } },
          ],
        });
        expect(result.length).toBe(2);
        expect(result[0]).toHaveProperty('guestId', 'g1');
        expect(result[0]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[0]).not.toHaveProperty('modifier');
        expect(result[0].basePrice.format()).toBe(currency(10).format());
        expect(result[0].resultingPrice.format()).toBe(currency(10).format());
        expect(result[1]).toHaveProperty('guestId', 'g2');
        expect(result[1]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[1].modifier).toHaveProperty('conditions');
        expect(result[1].modifier).toHaveProperty('unit', 'percentage');
        expect(result[1].modifier).toHaveProperty('adjustment', -25);
        expect(result[1].basePrice.format()).toBe(currency(10).format());
        expect(result[1].resultingPrice.format()).toBe(currency(7.5).format());
      });

      it('combine maxAge + lengthOfStay + minOccupants', () => {
        const result = computeDailyPrice([{ id: 'g1', age: 18 }, { id: 'g2', age: 16 }], 3, '2018-09-12', {
          id: 'rateplan1',
          price: 10,
          modifiers: [
            { adjustment: -10, unit: 'percentage', conditions: { lengthOfStay: 2, minOccupants: 2, maxAge: 16 } },
            { adjustment: -20, unit: 'percentage', conditions: { lengthOfStay: 3, minOccupants: 3, maxAge: 16 } },
            { adjustment: -30, unit: 'percentage', conditions: { lengthOfStay: 3, minOccupants: 2, maxAge: 16 } },
            { adjustment: -40, unit: 'percentage', conditions: { lengthOfStay: 2, minOccupants: 3, maxAge: 16 } },
          ],
        });
        expect(result.length).toBe(2);
        expect(result[0]).toHaveProperty('guestId', 'g1');
        expect(result[0]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[0]).not.toHaveProperty('modifier');
        expect(result[0].basePrice.format()).toBe(currency(10).format());
        expect(result[0].resultingPrice.format()).toBe(currency(10).format());
        expect(result[1]).toHaveProperty('guestId', 'g2');
        expect(result[1]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[1].modifier).toHaveProperty('conditions');
        expect(result[1].modifier).toHaveProperty('unit', 'percentage');
        expect(result[1].modifier).toHaveProperty('adjustment', -30);
        expect(result[1].basePrice.format()).toBe(currency(10).format());
        expect(result[1].resultingPrice.format()).toBe(currency(7).format());
      });
    });

    describe('maxAge', () => {
      it('should apply modifier to some of the guests if they are under or on par with the limit', () => {
        const result = computeDailyPrice([{ id: 'g1', age: 11 }, { id: 'g2', age: 18 }, { id: 'g3', age: 30 }], 3, '2018-09-12', {
          id: 'rateplan1',
          price: 8,
          modifiers: [
            { adjustment: -25, unit: 'percentage', conditions: { maxAge: 18 } },
          ],
        });

        expect(result.length).toBe(3);
        expect(result[0]).toHaveProperty('guestId', 'g1');
        expect(result[0]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[0].modifier).toHaveProperty('conditions');
        expect(result[0].modifier).toHaveProperty('unit', 'percentage');
        expect(result[0].modifier).toHaveProperty('adjustment', -25);
        expect(result[0].basePrice.format()).toBe(currency(8).format());
        expect(result[0].resultingPrice.format()).toBe(currency(6).format());
        expect(result[1]).toHaveProperty('guestId', 'g2');
        expect(result[1]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[1].modifier).toHaveProperty('conditions');
        expect(result[1].modifier).toHaveProperty('unit', 'percentage');
        expect(result[1].modifier).toHaveProperty('adjustment', -25);
        expect(result[1].basePrice.format()).toBe(currency(8).format());
        expect(result[1].resultingPrice.format()).toBe(currency(6).format());
        expect(result[2]).toHaveProperty('guestId', 'g3');
        expect(result[2]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[2]).not.toHaveProperty('modifier');
        expect(result[2].basePrice.format()).toBe(currency(8).format());
        expect(result[2].resultingPrice.format()).toBe(currency(8).format());
      });

      it('should apply a fitting modifier to each guests', () => {
        const result = computeDailyPrice([{ id: 'g1', age: 25 }, { id: 'g2', age: 18 }, { id: 'g3', age: 16 }], 3, '2018-09-12', {
          id: 'rateplan1',
          price: 8,
          modifiers: [
            { adjustment: -10, unit: 'percentage', conditions: { maxAge: 25 } },
            { adjustment: -50, unit: 'percentage', conditions: { maxAge: 18 } },
            { adjustment: -25, unit: 'percentage', conditions: { maxAge: 16 } },
          ],
        });
        expect(result.length).toBe(3);
        expect(result[0]).toHaveProperty('guestId', 'g1');
        expect(result[0]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[0].modifier).toHaveProperty('conditions');
        expect(result[0].modifier).toHaveProperty('unit', 'percentage');
        expect(result[0].modifier).toHaveProperty('adjustment', -10);
        expect(result[0].basePrice.format()).toBe(currency(8).format());
        expect(result[0].resultingPrice.format()).toBe(currency(7.2).format());
        expect(result[1]).toHaveProperty('guestId', 'g2');
        expect(result[1]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[1].modifier).toHaveProperty('conditions');
        expect(result[1].modifier).toHaveProperty('unit', 'percentage');
        expect(result[1].modifier).toHaveProperty('adjustment', -50);
        expect(result[1].basePrice.format()).toBe(currency(8).format());
        expect(result[1].resultingPrice.format()).toBe(currency(4).format());
        expect(result[2]).toHaveProperty('guestId', 'g3');
        expect(result[2]).toHaveProperty('ratePlanId', 'rateplan1');
        expect(result[2].modifier).toHaveProperty('conditions');
        expect(result[2].modifier).toHaveProperty('unit', 'percentage');
        expect(result[2].modifier).toHaveProperty('adjustment', -50);
        expect(result[2].basePrice.format()).toBe(currency(8).format());
        expect(result[2].resultingPrice.format()).toBe(currency(4).format());
      });
    });
  });
});
