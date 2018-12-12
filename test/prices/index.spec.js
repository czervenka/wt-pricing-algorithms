import dayjs from 'dayjs';
import currency from 'currency.js';
import { computePrices, computeStayPrices, computeDailyPrice } from '../../src/prices';

describe('prices.index', () => {
  let guestData;
  let hotel;

  beforeEach(() => {
    guestData = {
      arrival: '2018-01-03',
      departure: '2018-01-05',
      guests: [{ age: 18 }],
      helpers: {
        arrivalDateDayjs: dayjs('2018-01-03'),
        departureDateDayjs: dayjs('2018-01-05'),
        lengthOfStay: 2,
        numberOfGuests: 1,
      },
    };
    hotel = {
      id: '0x933198455e38925bccb4bfe9fb59bac31d00b4d3',
      currency: 'CZK',
      ratePlans: {
        rpa: {
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
      },
      roomTypes: {
        rta: { id: 'rta' },
        rtb: { id: 'rtb' },
      },
    };
  });

  describe('computePrices', () => {
    // TODO multiple currencies
    it('should return null price if no rate plan matches the room type', () => {
      const result = computePrices(guestData, hotel);
      expect(result.find(e => e.id === 'rta')).toHaveProperty('price', undefined);
      expect(result.find(e => e.id === 'rta')).toHaveProperty('currency', hotel.currency);
    });
  });

  describe('computeStayPrices', () => {
    it('should return the lowest price if no modifiers are present and multiple rate plans fit', () => {
      hotel.ratePlans.rpb = {
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
        guestData,
        hotel.currency,
        Object.values(hotel.ratePlans),
      );
      expect(result).toHaveProperty(hotel.currency);
      expect(result[hotel.currency].length).toBe(2);
      expect(result[hotel.currency][0].format()).toBe(currency(60).format());
      expect(result[hotel.currency][1].format()).toBe(currency(60).format());
    });

    it('should return the lowest price if no modifiers are present and multiple rate plans fit (one without availableForTravel)', () => {
      hotel.ratePlans.rpb = {
        id: 'rpb',
        price: 60,
        roomTypeIds: ['rtb'],
      };

      const result = computeStayPrices(
        guestData,
        hotel.currency,
        Object.values(hotel.ratePlans),
      );
      expect(result).toHaveProperty(hotel.currency);
      expect(result[hotel.currency].length).toBe(2);
      expect(result[hotel.currency][0].format()).toBe(currency(60).format());
      expect(result[hotel.currency][1].format()).toBe(currency(60).format());
    });

    it('should combine multiple rate plans if the stay range hits both of them', () => {
      hotel.ratePlans.rpa = Object.assign(
        {},
        hotel.ratePlans.rpa, {
          price: 73,
          availableForTravel: {
            from: '2018-10-02',
            to: '2018-10-06',
          },
        },
      );
      hotel.ratePlans.rpb = {
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
      guestData = Object.assign({}, guestData, {
        arrival: '2018-10-02',
        departure: '2018-10-10',
        guests: [{ age: 10 }, { age: 20 }, { age: 30 }],
        helpers: {
          arrivalDateDayjs: dayjs('2018-10-02'),
          departureDateDayjs: dayjs('2018-10-10'),
          lengthOfStay: 8,
          numberOfGuests: 3,
        },
      });

      const result = computeStayPrices(
        guestData,
        hotel.currency,
        Object.values(hotel.ratePlans),
      );
      expect(result).toHaveProperty(hotel.currency);
      expect(result[hotel.currency].length).toBe(8);
      expect(result[hotel.currency][0].format()).toBe(currency(3 * 73).format()); // 10-02
      expect(result[hotel.currency][1].format()).toBe(currency(3 * 73).format()); // 10-03
      expect(result[hotel.currency][2].format()).toBe(currency(3 * 73).format()); // 10-04
      expect(result[hotel.currency][3].format()).toBe(currency(3 * 73).format()); // 10-05
      expect(result[hotel.currency][4].format()).toBe(currency(3 * 73).format()); // 10-06
      expect(result[hotel.currency][5].format()).toBe(currency(3 * 60).format()); // 10-07
      expect(result[hotel.currency][6].format()).toBe(currency(3 * 60).format()); // 10-08
      expect(result[hotel.currency][7].format()).toBe(currency(3 * 60).format()); // 10-09
    });

    it('should combine multiple rate plans if the stay range hits both of them (one without availableForTravel)', () => {
      hotel.ratePlans.rpa = Object.assign(
        {},
        hotel.ratePlans.rpa, {
          price: 60,
          availableForTravel: {
            from: '2018-10-02',
            to: '2018-10-06',
          },
        },
      );
      hotel.ratePlans.rpb = {
        id: 'rpb',
        price: 73,
        roomTypeIds: ['rtb'],
      };
      guestData = Object.assign({}, guestData, {
        arrival: '2018-10-02',
        departure: '2018-10-10',
        guests: [{ age: 10 }, { age: 20 }, { age: 30 }],
        helpers: {
          arrivalDateDayjs: dayjs('2018-10-02'),
          departureDateDayjs: dayjs('2018-10-10'),
          lengthOfStay: 8,
          numberOfGuests: 3,
        },
      });

      const result = computeStayPrices(
        guestData,
        hotel.currency,
        Object.values(hotel.ratePlans),
      );
      expect(result).toHaveProperty(hotel.currency);
      expect(result[hotel.currency].length).toBe(8);
      expect(result[hotel.currency][0].format()).toBe(currency(3 * 60).format()); // 10-02
      expect(result[hotel.currency][1].format()).toBe(currency(3 * 60).format()); // 10-03
      expect(result[hotel.currency][2].format()).toBe(currency(3 * 60).format()); // 10-04
      expect(result[hotel.currency][3].format()).toBe(currency(3 * 60).format()); // 10-05
      expect(result[hotel.currency][4].format()).toBe(currency(3 * 60).format()); // 10-06
      expect(result[hotel.currency][5].format()).toBe(currency(3 * 73).format()); // 10-07
      expect(result[hotel.currency][6].format()).toBe(currency(3 * 73).format()); // 10-08
      expect(result[hotel.currency][7].format()).toBe(currency(3 * 73).format()); // 10-09
    });

    it('should not return an estimate if even a single date of a stay is not covered by a valid rate plan', () => {
      hotel.ratePlans.rpa = Object.assign(
        {},
        hotel.ratePlans.rpa, {
          price: 73,
          availableForTravel: {
            from: '2018-10-02',
            to: '2018-10-04',
          },
        },
      );
      hotel.ratePlans.rpb = {
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
      guestData = Object.assign({}, guestData, {
        arrival: '2018-10-02',
        departure: '2018-10-10',
        helpers: {
          arrivalDateDayjs: dayjs('2018-10-02'),
          departureDateDayjs: dayjs('2018-10-10'),
          lengthOfStay: 8,
        },
      });
      const result = computeStayPrices(
        guestData,
        hotel.currency,
        Object.values(hotel.ratePlans),
      );
      expect(result).not.toHaveProperty(hotel.currency);
    });

    it('should not combine rate plans with different currencies', () => {
      hotel.ratePlans.rpa = Object.assign(
        {},
        hotel.ratePlans.rpa, {
          price: 71,
          availableForTravel: {
            from: '2018-10-02',
            to: '2018-10-06',
          },
          currency: 'EUR',
        },
      );
      hotel.ratePlans.rpb = {
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
      hotel.ratePlans.rpc = {
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
      guestData = Object.assign({}, guestData, {
        arrival: '2018-10-02',
        departure: '2018-10-10',
        helpers: {
          arrivalDateDayjs: dayjs('2018-10-02'),
          departureDateDayjs: dayjs('2018-10-10'),
          lengthOfStay: 8,
          numberOfGuests: 1,
        },
      });

      const result = computeStayPrices(
        guestData,
        hotel.currency,
        Object.values(hotel.ratePlans),
      );

      expect(result).not.toHaveProperty(hotel.currency);
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
    });
  });

  describe('computeDailyPrice', () => {
    it('should return base price if rate plan has no modifiers', () => {
      expect(computeDailyPrice({ helpers: { numberOfGuests: 1, lengthOfStay: 3 } }, '2018-09-12', { price: 10 }).format()).toBe(currency(10).format());
      expect(computeDailyPrice({ helpers: { numberOfGuests: 13, lengthOfStay: 3 } }, '2018-09-12', { price: 10 }).format()).toBe(currency(130).format());
    });

    it('should pick the most pro-customer modifier (all positive)', () => {
      expect(computeDailyPrice({ guests: [{ age: 18 }], helpers: { lengthOfStay: 3, numberOfGuests: 1 } }, '2018-09-12', {
        price: 8,
        modifiers: [
          { adjustment: 25, conditions: {} },
          { adjustment: 50, conditions: {} },
        ],
      }).format()).toBe(currency(10).format());
    });

    it('should pick the most pro-customer modifier (all negative)', () => {
      expect(computeDailyPrice({ guests: [{ age: 18 }], helpers: { lengthOfStay: 3, numberOfGuests: 1 } }, '2018-09-12', {
        price: 8,
        modifiers: [
          { adjustment: -25, conditions: {} },
          { adjustment: -50, conditions: {} },
        ],
      }).format()).toBe(currency(4).format());
    });

    it('should pick the most pro-customer modifier (mixed)', () => {
      expect(computeDailyPrice({ guests: [{ age: 18 }], helpers: { lengthOfStay: 3, numberOfGuests: 1 } }, '2018-09-12', {
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
        expect(computeDailyPrice({ guests: [{ age: 18 }, { age: 16 }], helpers: { lengthOfStay: 3, numberOfGuests: 2 } }, '2018-09-12', {
          price: 8,
          modifiers: [
            { adjustment: -75, conditions: { minOccupants: 2 } },
            { adjustment: -50, conditions: { lengthOfStay: 3 } },
          ],
        }).format()).toBe(currency(2 * 2).format());
      });

      it('should pick the guest-specific modifier if multiple are applicable', () => {
        expect(computeDailyPrice({ guests: [{ age: 18 }, { age: 16 }], helpers: { lengthOfStay: 3, numberOfGuests: 2 } }, '2018-09-12', {
          price: 10,
          modifiers: [
            { adjustment: -25, conditions: { minOccupants: 2 } },
            { adjustment: -10, conditions: { lengthOfStay: 3 } },
            { adjustment: -20, conditions: { maxAge: 16 } },
          ],
        }).format()).toBe(currency(8 + 7.5).format());
      });

      it('combine maxAge + minOccupants', () => {
        expect(computeDailyPrice({ guests: [{ age: 18 }, { age: 16 }], helpers: { lengthOfStay: 3, numberOfGuests: 2 } }, '2018-09-12', {
          price: 10,
          modifiers: [
            { adjustment: -20, conditions: { minOccupants: 2, maxAge: 16 } },
            { adjustment: -25, conditions: { minOccupants: 3, maxAge: 16 } },
          ],
        }).format()).toBe(currency(10 + 8).format());
      });

      it('combine maxAge + lengthOfStay', () => {
        expect(computeDailyPrice({ guests: [{ age: 18 }, { age: 16 }], helpers: { lengthOfStay: 3, numberOfGuests: 2 } }, '2018-09-12', {
          price: 10,
          modifiers: [
            { adjustment: -20, conditions: { lengthOfStay: 2, maxAge: 16 } },
            { adjustment: -25, conditions: { lengthOfStay: 3, maxAge: 16 } },
          ],
        }).format()).toBe(currency(10 + 7.5).format());
      });

      it('combine maxAge + lengthOfStay + minOccupants', () => {
        expect(computeDailyPrice({ guests: [{ age: 18 }, { age: 16 }], helpers: { lengthOfStay: 3, numberOfGuests: 2 } }, '2018-09-12', {
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
        expect(computeDailyPrice({ guests: [{ age: 11 }, { age: 18 }, { age: 30 }], helpers: { lengthOfStay: 3, numberOfGuests: 3 } }, '2018-09-12', {
          price: 8,
          modifiers: [
            { adjustment: -25, conditions: { maxAge: 18 } },
          ],
        }).format()).toBe(currency(8 * 1 + 6 * 2).format());
      });

      it('should apply a fitting modifier to each guests', () => {
        expect(computeDailyPrice({ guests: [{ age: 25 }, { age: 18 }, { age: 16 }], helpers: { lengthOfStay: 3, numberOfGuests: 3 } }, '2018-09-12', {
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
