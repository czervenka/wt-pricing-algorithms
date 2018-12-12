import dayjs from 'dayjs';
import {
  selectApplicableModifiers,
  selectBestGuestModifier,
  getApplicableRatePlans,
} from '../../src/prices/rate-plans';

describe('prices.rate-plans', () => {
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

  describe('getApplicableRatePlans', () => {
    it('should not use a rate plan if it is not available for reservation based on current date', () => {
      // make sure the rate plan for rtb does not work for today
      hotel.ratePlans.rpa.availableForReservation = {
        from: '2015-01-01',
        to: '2015-10-10',
      };
      const result = getApplicableRatePlans(
        guestData,
        hotel.roomTypes.rtb,
        [hotel.ratePlans.rpa],
      );
      expect(result.length).toBe(0);
    });

    it('should not use a rate plan if it is not available for travel based on guest data', () => {
      // make sure the rate plan for rtb does not work for current estimates.guestData
      hotel.ratePlans.rpa.availableForTravel = {
        from: '2015-01-01',
        to: '2015-10-10',
      };
      const result = getApplicableRatePlans(
        guestData,
        hotel.roomTypes.rtb,
        [hotel.ratePlans.rpa],
      );
      expect(result.length).toBe(0);
    });

    it('should return the only fitting rate plan', () => {
      const result = getApplicableRatePlans(
        guestData,
        hotel.roomTypes.rtb,
        [hotel.ratePlans.rpa],
      );
      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('price', 100);
    });

    it('should return rate plan without availableForTravel', () => {
      hotel.ratePlans.rpa.availableForTravel = undefined;
      const result = getApplicableRatePlans(
        guestData,
        hotel.roomTypes.rtb,
        [hotel.ratePlans.rpa],
      );
      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('price', 100);
    });

    it('should return rate plan without availableForReservation', () => {
      hotel.ratePlans.rpa.availableForReservation = undefined;
      const result = getApplicableRatePlans(
        guestData,
        hotel.roomTypes.rtb,
        [hotel.ratePlans.rpa],
      );
      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('price', 100);
    });

    it('should return multiple fitting rate plans', () => {
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
      const result = getApplicableRatePlans(
        guestData,
        hotel.roomTypes.rtb,
        Object.values(hotel.ratePlans),
      );
      expect(result.length).toBe(2);
    });

    describe('restrictions', () => {
      let currentGuestData;
      let ratePlans;
      let today;

      beforeEach(() => {
        today = dayjs();
        currentGuestData = {
          arrival: dayjs(today).add(5, 'days').format('YYYY-MM-DD'),
          departure: dayjs(today).add(7, 'days').format('YYYY-MM-DD'),
          guests: [{ age: 18 }],
          helpers: {
            arrivalDateDayjs: dayjs(today).add(5, 'days'),
            departureDateDayjs: dayjs(today).add(7, 'days'),
            lengthOfStay: 2,
            numberOfGuests: 1,
          },
        };
        ratePlans = [
          {
            id: 'rpb',
            price: 60,
            roomTypeIds: ['rtb'],
            availableForReservation: {
              from: dayjs(today).subtract(20, 'days').format('YYYY-MM-DD'),
              to: dayjs(today).add(20, 'days').format('YYYY-MM-DD'),
            },
            availableForTravel: {
              from: dayjs(today).subtract(20, 'days').format('YYYY-MM-DD'),
              to: dayjs(today).add(20, 'days').format('YYYY-MM-DD'),
            },
          },
          {
            id: 'rpc',
            price: 100,
            roomTypeIds: ['rtb'],
            availableForReservation: {
              from: dayjs(today).subtract(20, 'days').format('YYYY-MM-DD'),
              to: dayjs(today).add(20, 'days').format('YYYY-MM-DD'),
            },
            availableForTravel: {
              from: dayjs(today).subtract(20, 'days').format('YYYY-MM-DD'),
              to: dayjs(today).add(20, 'days').format('YYYY-MM-DD'),
            },
          },
        ];
      });

      describe('bookingCutOff', () => {
        it('should drop rate plan if booking happens after min bookingCutOff', () => {
          ratePlans[0].restrictions = {
            bookingCutOff: {
              min: 20,
            },
          };
          const result = getApplicableRatePlans(
            currentGuestData,
            hotel.roomTypes.rtb,
            ratePlans,
          );
          expect(result.length).toBe(1);
        });

        it('should drop rate plan if booking happens before max bookingCutOff', () => {
          ratePlans[0].restrictions = {
            bookingCutOff: {
              max: 2,
            },
          };
          const result = getApplicableRatePlans(
            currentGuestData,
            hotel.roomTypes.rtb,
            ratePlans,
          );
          expect(result.length).toBe(1);
        });

        it('should keep rate plan if booking happens in the desired cut off interval', () => {
          ratePlans[0].restrictions = {
            bookingCutOff: {
              min: 4,
              max: 8,
            },
          };
          const result = getApplicableRatePlans(
            currentGuestData,
            hotel.roomTypes.rtb,
            ratePlans,
          );
          expect(result.length).toBe(2);
        });
      });

      describe('lengthOfStay', () => {
        it('should drop rate plan if stay does not have min lengthOfStay', () => {
          ratePlans[0].restrictions = {
            lengthOfStay: {
              min: 4,
            },
          };
          const result = getApplicableRatePlans(
            currentGuestData,
            hotel.roomTypes.rtb,
            ratePlans,
          );
          expect(result.length).toBe(1);
        });

        it('should drop rate plan if stay is longer than max lengthOfStay', () => {
          ratePlans[0].restrictions = {
            lengthOfStay: {
              max: 1,
            },
          };
          const result = getApplicableRatePlans(
            currentGuestData,
            hotel.roomTypes.rtb,
            ratePlans,
          );
          expect(result.length).toBe(1);
        });

        it('should keep rate plan if stay is in between the desired lengthOfStay', () => {
          ratePlans[0].restrictions = {
            lengthOfStay: {
              min: 2,
              max: 10,
            },
          };
          const result = getApplicableRatePlans(
            currentGuestData,
            hotel.roomTypes.rtb,
            ratePlans,
          );
          expect(result.length).toBe(2);
        });
      });
    });
  });

  describe('selectApplicableModifiers', () => {
    it('should drop modifiers without conditions', () => {
      const modifiers = selectApplicableModifiers(
        { guests: [{ age: 18 }], helpers: { lengthOfStay: 3, numberOfGuests: 1 } },
        [
          { adjustment: 10 },
        ], dayjs('2018-09-12'),
      );
      expect(modifiers.length).toBe(0);
    });

    it('should pass through guest specific modifiers', () => {
      const modifiers = selectApplicableModifiers(
        { guests: [{ age: 18 }], helpers: { lengthOfStay: 3, numberOfGuests: 1 } },
        [
          { adjustment: -25, conditions: { maxAge: 10 } },
          { adjustment: -33, conditions: { maxAge: 12 } },
        ], dayjs('2018-09-12'),
      );
      expect(modifiers.length).toBe(2);
    });

    describe('time interval from, to', () => {
      it('should keep modifiers if date is within interval', () => {
        const modifiers = selectApplicableModifiers(
          { guests: [{ age: 18 }], helpers: { lengthOfStay: 3, numberOfGuests: 1 } },
          [
            {
              adjustment: -25,
              conditions: {
                from: '2018-01-09',
                to: '2018-09-20',
              },
            },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(1);
      });

      it('should keep modifier starting on a stay date', () => {
        const modifiers = selectApplicableModifiers(
          { guests: [{ age: 18 }], helpers: { lengthOfStay: 3, numberOfGuests: 1 } },
          [
            {
              adjustment: -25,
              conditions: {
                from: '2018-09-12',
                to: '2018-09-20',
              },
            },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(1);
      });

      it('should keep modifier ending on a stay date', () => {
        const modifiers = selectApplicableModifiers(
          { guests: [{ age: 18 }], helpers: { lengthOfStay: 3, numberOfGuests: 1 } },
          [
            {
              adjustment: -25,
              conditions: {
                from: '2018-09-10',
                to: '2018-09-12',
              },
            },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(1);
      });

      it('should drop modidifer if stay date is not within interval', () => {
        const modifiers = selectApplicableModifiers(
          { guests: [{ age: 18 }], helpers: { lengthOfStay: 3, numberOfGuests: 1 } }, [
            {
              adjustment: -25,
              conditions: {
                from: '2018-09-10',
                to: '2018-08-12',
              },
            },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(0);
      });

      it('should keep modifier if only from is set and stay date is in', () => {
        const modifiers = selectApplicableModifiers(
          { guests: [{ age: 18 }], helpers: { lengthOfStay: 3, numberOfGuests: 1 } },
          [
            {
              adjustment: -25,
              conditions: {
                from: '2018-09-10',
              },
            },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(1);
      });

      it('should drop modifier if only from is set and stay date is out', () => {
        const modifiers = selectApplicableModifiers(
          { guests: [{ age: 18 }], helpers: { lengthOfStay: 3, numberOfGuests: 1 } },
          [
            {
              adjustment: -25,
              conditions: {
                from: '2018-09-16',
              },
            },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(0);
      });

      it('should keep modifier if only to is set and stay date is in', () => {
        const modifiers = selectApplicableModifiers(
          { guests: [{ age: 18 }], helpers: { lengthOfStay: 3, numberOfGuests: 1 } },
          [
            {
              adjustment: -25,
              conditions: {
                to: '2018-09-13',
              },
            },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(1);
      });

      it('should drop modifier if only to is set and stay date is out', () => {
        const modifiers = selectApplicableModifiers(
          { guests: [{ age: 18 }], helpers: { lengthOfStay: 3, numberOfGuests: 1 } },
          [
            {
              adjustment: -25,
              conditions: {
                to: '2018-09-10',
              },
            },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(0);
      });
    });

    describe('minLengthOfStay', () => {
      it('should not apply modifier if LOS is shorter', () => {
        const modifiers = selectApplicableModifiers(
          { guests: [{ age: 18 }], helpers: { lengthOfStay: 3, numberOfGuests: 1 } },
          [
            { adjustment: -25, conditions: { minLengthOfStay: 5 } },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(0);
      });

      it('should apply modifier if LOS is equal', () => {
        const modifiers = selectApplicableModifiers(
          { guests: [{ age: 18 }], helpers: { lengthOfStay: 3, numberOfGuests: 1 } },
          [
            { adjustment: -25, conditions: { minLengthOfStay: 3 } },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(1);
      });

      it('should apply modifier if LOS is longer', () => {
        const modifiers = selectApplicableModifiers(
          { guests: [{ age: 18 }], helpers: { lengthOfStay: 7, numberOfGuests: 1 } },
          [
            { adjustment: -25, conditions: { minLengthOfStay: 5 } },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(1);
      });

      it('should apply modifier with the biggest applicable LOS', () => {
        let modifiers = selectApplicableModifiers(
          { guests: [{ age: 18 }], helpers: { lengthOfStay: 7, numberOfGuests: 1 } },
          [
            { adjustment: -25, conditions: { minLengthOfStay: 5 } },
            { adjustment: -10, conditions: { minLengthOfStay: 7 } },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(1);
        expect(modifiers[0].adjustment).toBe(-10);

        modifiers = selectApplicableModifiers(
          { guests: [{ age: 18 }], helpers: { lengthOfStay: 7, numberOfGuests: 1 } },
          [
            { adjustment: -10, conditions: { minLengthOfStay: 7 } },
            { adjustment: -25, conditions: { minLengthOfStay: 5 } },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(1);
        expect(modifiers[0].adjustment).toBe(-10);

        modifiers = selectApplicableModifiers(
          { guests: [{ age: 18 }], helpers: { lengthOfStay: 7, numberOfGuests: 1 } },
          [
            { adjustment: -50, conditions: { minLengthOfStay: 6 } },
            { adjustment: -10, conditions: { minLengthOfStay: 7 } },
            { adjustment: -25, conditions: { minLengthOfStay: 5 } },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(1);
        expect(modifiers[0].adjustment).toBe(-10);
      });
    });

    describe('minOccupants', () => {
      it('should not apply modifier if number of guests is smaller', () => {
        const modifiers = selectApplicableModifiers(
          { guests: [{ age: 18 }], helpers: { lengthOfStay: 3, numberOfGuests: 1 } },
          [
            { adjustment: -25, conditions: { minOccupants: 5 } },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(0);
      });

      it('should apply modifier if number of guests is equal', () => {
        const modifiers = selectApplicableModifiers(
          {
            guests: [
              { age: 10 }, { age: 20 }, { age: 30 },
            ],
            helpers: { lengthOfStay: 3, numberOfGuests: 3 },
          },
          [
            { adjustment: -25, conditions: { minOccupants: 3 } },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(1);
      });

      it('should apply modifier if number of guests is larger', () => {
        const modifiers = selectApplicableModifiers(
          {
            guests: [
              { age: 9 }, { age: 10 }, { age: 11 }, { age: 12 }, { age: 13 },
              { age: 14 }, { age: 15 }, { age: 16 }, { age: 17 }, { age: 18 },
            ],
            helpers: { lengthOfStay: 3, numberOfGuests: 10 },
          },
          [
            { adjustment: -25, conditions: { minOccupants: 5 } },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(1);
      });

      it('should apply modifier with the biggest applicable minOccupants', () => {
        const modifiers = selectApplicableModifiers(
          {
            guests: [
              { age: 10 }, { age: 11 }, { age: 12 }, { age: 13 }, { age: 14 },
              { age: 15 }, { age: 16 },
            ],
            helpers: { lengthOfStay: 3, numberOfGuests: 7 },
          },
          [
            { adjustment: -10, conditions: { minOccupants: 7 } },
            { adjustment: -25, conditions: { minOccupants: 5 } },
          ], dayjs('2018-09-12'),
        );
        expect(modifiers.length).toBe(1);
        expect(modifiers[0].adjustment).toBe(-10);
      });
    });
  });

  describe('selectBestGuestModifier', () => {
    describe('maxAge', () => {
      it('should not apply modifier to a guest over the limit', () => {
        const modifier = selectBestGuestModifier([
          { adjustment: -25, conditions: { maxAge: 10 } },
        ], 11);
        expect(modifier).toBeUndefined();
      });

      it('should apply modifier to a guest under the limit', () => {
        const modifier = selectBestGuestModifier([
          { adjustment: -25, conditions: { maxAge: 10 } },
        ], 9);
        expect(modifier).not.toBeUndefined();
      });

      it('should apply modifier to a guest at the limit', () => {
        const modifier = selectBestGuestModifier([
          { adjustment: -25, conditions: { maxAge: 10 } },
        ], 10);
        expect(modifier).not.toBeUndefined();
      });

      it('should apply modifier with the highest fitting limit', () => {
        const modifier = selectBestGuestModifier([
          { adjustment: -10, conditions: { maxAge: 25 } },
          { adjustment: -50, conditions: { maxAge: 18 } },
          { adjustment: -25, conditions: { maxAge: 16 } },
        ], 16);
        expect(modifier).not.toBeUndefined();
        expect(modifier.adjustment).toBe(-25);
      });

      it('should apply a fitting modifier with best adjustment', () => {
        const modifier = selectBestGuestModifier([
          { adjustment: -75, conditions: { maxAge: 18 } },
          { adjustment: -25, conditions: { maxAge: 16 } },
          { adjustment: -50, conditions: { maxAge: 18 } },
          { adjustment: -10, conditions: { maxAge: 16 } },
        ], 16);
        expect(modifier).not.toBeUndefined();
        expect(modifier.adjustment).toBe(-25);
      });
    });
  });
});
