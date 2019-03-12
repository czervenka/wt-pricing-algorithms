import dayjs from 'dayjs';
import currency from 'currency.js';
import { PriceComputer } from '../../src/prices';

describe('prices.index', () => {
  let guests;
  let arrivalDateDayjs;
  let departureDateDayjs;
  let fallbackCurrency;
  let ratePlans;
  let roomTypes;

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

    describe('_determinePrices', () => {
      it('should return null price if no rate plan matches the room type', () => {
        computer._determinePrices(new Date(), '2018-01-03', '2018-01-05', guests, fallbackCurrency, 'rta', (dailyPrices, lengthOfStay) => {
          throw new ('should have never been called')();
        });
      });

      it('should return a single price if a rate plan matches the room type', () => {
        computer._determinePrices(new Date(), '2018-01-03', '2018-01-05', guests, fallbackCurrency, 'rtb',
          (dailyPrices, lengthOfStay) => {
            expect(dailyPrices).toHaveProperty(fallbackCurrency);
            expect(dailyPrices[fallbackCurrency].length).toBe(2);
            expect(dailyPrices[fallbackCurrency][0][0]).toHaveProperty('ratePlan');
            expect(dailyPrices[fallbackCurrency][0][0].total.format()).toBe(currency(100).format());
            expect(dailyPrices[fallbackCurrency][0][0]).toHaveProperty('guestPrices');
            expect(dailyPrices[fallbackCurrency][0][0].guestPrices.length).toBe(1);
            expect(dailyPrices[fallbackCurrency][1][0]).toHaveProperty('ratePlan');
            expect(dailyPrices[fallbackCurrency][1][0].total.format()).toBe(currency(100).format());
            expect(dailyPrices[fallbackCurrency][1][0]).toHaveProperty('guestPrices');
            expect(dailyPrices[fallbackCurrency][1][0].guestPrices.length).toBe(1);
          });
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
        computer._determinePrices(new Date(), '2018-01-03', '2018-01-05', guests, null, 'rtb', (dailyPrices) => {
          expect(dailyPrices).toHaveProperty('CZK');
          expect(dailyPrices).toHaveProperty('EUR');
          expect(dailyPrices.CZK[0][0].total.format()).toBe(currency(100).format());
          expect(dailyPrices.EUR[0][0].total.format()).toBe(currency(33).format());
        });
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
        computer._determinePrices(new Date(), '2018-01-03', '2018-01-05', guests, 'EUR', 'rtb', (dailyPrices) => {
          expect(dailyPrices).not.toHaveProperty('CZK');
          expect(dailyPrices).toHaveProperty('EUR');
        });
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
        const result = computer._determinePrices(new Date(), '2018-01-03', '2018-01-05', guests, null, 'rtb', () => {});
        expect(result.length).toBe(1);
      });
    });

    describe('getBestPrice', () => {
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
          modifiers: [
            { adjustment: -50,
              unit: 'percentage',
              conditions: {
                maxAge: 20,
              } },
          ],
        };
        const result = computer.getBestPrice(new Date(), arrivalDateDayjs, departureDateDayjs, [
          { id: 'g1', age: 18 },
          { id: 'g2', age: 21 },
        ], fallbackCurrency, 'rtb');
        const rtbResult = result.find((r) => r.id === 'rtb');
        expect(rtbResult).toHaveProperty('prices');
        expect(rtbResult.prices.length).toBe(1);
        expect(rtbResult.prices[0]).toHaveProperty('currency', fallbackCurrency);
        expect(rtbResult.prices[0]).toHaveProperty('total');
        expect(rtbResult.prices[0].total.format()).toBe(currency(60 + 60 + 30 + 30).format());
        expect(rtbResult.prices[0]).toHaveProperty('components');
        expect(rtbResult.prices[0].components).toHaveProperty('stay');
        expect(rtbResult.prices[0].components.stay.length).toBe(2); // 2 days
        expect(rtbResult.prices[0].components.stay[0]).toHaveProperty('date', '2018-01-03');
        expect(rtbResult.prices[0].components.stay[0]).toHaveProperty('subtotal');
        expect(rtbResult.prices[0].components.stay[0].subtotal.format()).toBe(currency(60 + 30).format());
        expect(rtbResult.prices[0].components.stay[1]).toHaveProperty('date', '2018-01-04');
        expect(rtbResult.prices[0].components.stay[1].subtotal.format()).toBe(currency(60 + 30).format());
        expect(rtbResult.prices[0].components.stay[0].guests.length).toBe(2); // 2 people
        expect(rtbResult.prices[0].components.stay[0].guests[0]).toHaveProperty('guestId', 'g1');
        expect(rtbResult.prices[0].components.stay[0].guests[0]).toHaveProperty('ratePlanId', 'rpb');
        expect(rtbResult.prices[0].components.stay[0].guests[0]).toHaveProperty('basePrice');
        expect(rtbResult.prices[0].components.stay[0].guests[0]).toHaveProperty('modifier');
        expect(rtbResult.prices[0].components.stay[0].guests[0].modifier).toHaveProperty('adjustment', -50);
        expect(rtbResult.prices[0].components.stay[0].guests[0].modifier).toHaveProperty('unit', 'percentage');
        expect(rtbResult.prices[0].components.stay[0].guests[0].modifier).toHaveProperty('conditions');
        expect(rtbResult.prices[0].components.stay[0].guests[0].modifier.conditions).toHaveProperty('maxAge', 20);
        expect(rtbResult.prices[0].components.stay[0].guests[0]).toHaveProperty('resultingPrice');
        expect(rtbResult.prices[0].components.stay[0].guests[0].basePrice.format()).toBe(currency(60).format());
        expect(rtbResult.prices[0].components.stay[0].guests[0].resultingPrice.format()).toBe(currency(30).format());
        expect(rtbResult.prices[0].components.stay[0].guests[1]).toHaveProperty('guestId', 'g2');
        expect(rtbResult.prices[0].components.stay[0].guests[1]).toHaveProperty('ratePlanId', 'rpb');
        expect(rtbResult.prices[0].components.stay[0].guests[1]).toHaveProperty('basePrice');
        expect(rtbResult.prices[0].components.stay[0].guests[1]).not.toHaveProperty('modifier');
        expect(rtbResult.prices[0].components.stay[0].guests[1]).toHaveProperty('resultingPrice');
        expect(rtbResult.prices[0].components.stay[0].guests[1].basePrice.format()).toBe(currency(60).format());
        expect(rtbResult.prices[0].components.stay[0].guests[1].resultingPrice.format()).toBe(currency(60).format());
      });
    });

    describe('getPossiblePricesWithSingleRatePlan', () => {
      it('should return all rate plans that fit consecutively', () => {
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
          modifiers: [
            { adjustment: -50,
              unit: 'percentage',
              conditions: {
                maxAge: 20,
              } },
          ],
        };
        const result = computer.getPossiblePricesWithSingleRatePlan(new Date(), arrivalDateDayjs, departureDateDayjs, [
          { id: 'g1', age: 18 },
          { id: 'g2', age: 21 },
        ], fallbackCurrency, 'rtb');
        const rtbResult = result.find((r) => r.id === 'rtb');
        expect(rtbResult).toHaveProperty('prices');
        expect(rtbResult.prices.length).toBe(1);
        expect(rtbResult.prices[0]).toHaveProperty('currency', fallbackCurrency);
        expect(rtbResult.prices[0]).toHaveProperty('ratePlans');
        expect(rtbResult.prices[0].ratePlans.length).toBe(2);
        expect(rtbResult.prices[0].ratePlans[0]).toHaveProperty('total');
        expect(rtbResult.prices[0].ratePlans[0].total.format()).toBe(currency(100 + 100 + 100 + 100).format());
        expect(rtbResult.prices[0].ratePlans[0]).toHaveProperty('components.stay');
        expect(rtbResult.prices[0].ratePlans[0].components.stay.length).toBe(2); // 2 days
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0]).toHaveProperty('date', '2018-01-03');
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0]).toHaveProperty('subtotal');
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0].subtotal.format()).toBe(currency(100 + 100).format());
        expect(rtbResult.prices[0].ratePlans[0].components.stay[1]).toHaveProperty('date', '2018-01-04');
        expect(rtbResult.prices[0].ratePlans[0].components.stay[1].subtotal.format()).toBe(currency(100 + 100).format());
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0].guests.length).toBe(2); // 2 people
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0].guests[0]).toHaveProperty('guestId', 'g1');
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0].guests[0]).toHaveProperty('ratePlanId', 'rpa');
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0].guests[0]).toHaveProperty('basePrice');
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0].guests[0]).not.toHaveProperty('modifier');
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0].guests[0]).toHaveProperty('resultingPrice');
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0].guests[0].basePrice.format()).toBe(currency(100).format());
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0].guests[0].resultingPrice.format()).toBe(currency(100).format());
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0].guests[1]).toHaveProperty('guestId', 'g2');
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0].guests[1]).toHaveProperty('ratePlanId', 'rpa');
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0].guests[1]).toHaveProperty('basePrice');
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0].guests[1]).not.toHaveProperty('modifier');
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0].guests[1]).toHaveProperty('resultingPrice');
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0].guests[1].basePrice.format()).toBe(currency(100).format());
        expect(rtbResult.prices[0].ratePlans[0].components.stay[0].guests[1].resultingPrice.format()).toBe(currency(100).format());
        expect(rtbResult.prices[0].ratePlans[1].components.stay.length).toBe(2); // 2 days
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0]).toHaveProperty('date', '2018-01-03');
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0]).toHaveProperty('subtotal');
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].subtotal.format()).toBe(currency(60 + 30).format());
        expect(rtbResult.prices[0].ratePlans[1].components.stay[1]).toHaveProperty('date', '2018-01-04');
        expect(rtbResult.prices[0].ratePlans[1].components.stay[1].subtotal.format()).toBe(currency(60 + 30).format());
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests.length).toBe(2); // 2 people
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[0]).toHaveProperty('guestId', 'g1');
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[0]).toHaveProperty('ratePlanId', 'rpb');
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[0]).toHaveProperty('basePrice');
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[0]).toHaveProperty('modifier');
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[0].modifier).toHaveProperty('adjustment', -50);
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[0].modifier).toHaveProperty('unit', 'percentage');
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[0].modifier).toHaveProperty('conditions');
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[0].modifier.conditions).toHaveProperty('maxAge', 20);
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[0]).toHaveProperty('resultingPrice');
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[0].basePrice.format()).toBe(currency(60).format());
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[0].resultingPrice.format()).toBe(currency(30).format());
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[1]).toHaveProperty('guestId', 'g2');
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[1]).toHaveProperty('ratePlanId', 'rpb');
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[1]).toHaveProperty('basePrice');
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[1]).not.toHaveProperty('modifier');
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[1]).toHaveProperty('resultingPrice');
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[1].basePrice.format()).toBe(currency(60).format());
        expect(rtbResult.prices[0].ratePlans[1].components.stay[0].guests[1].resultingPrice.format()).toBe(currency(60).format());
      });
    });

    describe('getBestPriceWithSingleRatePlan', () => {
      it('should return the best rate plan that fits consecutively', () => {
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
          modifiers: [
            { adjustment: -50,
              unit: 'percentage',
              conditions: {
                maxAge: 20,
              } },
          ],
        };

        const result = computer.getBestPriceWithSingleRatePlan(new Date(), arrivalDateDayjs, departureDateDayjs, [
          { id: 'g1', age: 18 },
          { id: 'g2', age: 21 },
        ], fallbackCurrency, 'rtb');
        const rtbResult = result.find((r) => r.id === 'rtb');

        expect(rtbResult).toHaveProperty('prices');
        expect(rtbResult.prices.length).toBe(1);
        expect(rtbResult.prices[0]).toHaveProperty('ratePlan');
        expect(rtbResult.prices[0].ratePlan).toHaveProperty('id', 'rpb');
        expect(rtbResult.prices[0]).toHaveProperty('currency', fallbackCurrency);
        expect(rtbResult.prices[0]).toHaveProperty('total');
        expect(rtbResult.prices[0].total.format()).toBe(currency(60 + 60 + 30 + 30).format());
        expect(rtbResult.prices[0]).toHaveProperty('components.stay');
        expect(rtbResult.prices[0].components.stay.length).toBe(2); // 2 days
        expect(rtbResult.prices[0].components.stay[0]).toHaveProperty('date', '2018-01-03');
        expect(rtbResult.prices[0].components.stay[0]).toHaveProperty('subtotal');
        expect(rtbResult.prices[0].components.stay[0].subtotal.format()).toBe(currency(60 + 30).format());
        expect(rtbResult.prices[0].components.stay[1]).toHaveProperty('date', '2018-01-04');
        expect(rtbResult.prices[0].components.stay[1].subtotal.format()).toBe(currency(60 + 30).format());
        expect(rtbResult.prices[0].components.stay[0].guests.length).toBe(2); // 2 people
        expect(rtbResult.prices[0].components.stay[0].guests[0]).toHaveProperty('guestId', 'g1');
        expect(rtbResult.prices[0].components.stay[0].guests[0]).toHaveProperty('ratePlanId', 'rpb');
        expect(rtbResult.prices[0].components.stay[0].guests[0]).toHaveProperty('basePrice');
        expect(rtbResult.prices[0].components.stay[0].guests[0]).toHaveProperty('modifier');
        expect(rtbResult.prices[0].components.stay[0].guests[0].modifier).toHaveProperty('adjustment', -50);
        expect(rtbResult.prices[0].components.stay[0].guests[0].modifier).toHaveProperty('unit', 'percentage');
        expect(rtbResult.prices[0].components.stay[0].guests[0].modifier).toHaveProperty('conditions');
        expect(rtbResult.prices[0].components.stay[0].guests[0].modifier.conditions).toHaveProperty('maxAge', 20);
        expect(rtbResult.prices[0].components.stay[0].guests[0]).toHaveProperty('resultingPrice');
        expect(rtbResult.prices[0].components.stay[0].guests[0].basePrice.format()).toBe(currency(60).format());
        expect(rtbResult.prices[0].components.stay[0].guests[0].resultingPrice.format()).toBe(currency(30).format());
        expect(rtbResult.prices[0].components.stay[0].guests[1]).toHaveProperty('guestId', 'g2');
        expect(rtbResult.prices[0].components.stay[0].guests[1]).toHaveProperty('ratePlanId', 'rpb');
        expect(rtbResult.prices[0].components.stay[0].guests[1]).toHaveProperty('basePrice');
        expect(rtbResult.prices[0].components.stay[0].guests[1]).not.toHaveProperty('modifier');
        expect(rtbResult.prices[0].components.stay[0].guests[1]).toHaveProperty('resultingPrice');
        expect(rtbResult.prices[0].components.stay[0].guests[1].basePrice.format()).toBe(currency(60).format());
        expect(rtbResult.prices[0].components.stay[0].guests[1].resultingPrice.format()).toBe(currency(60).format());
      });
    });
  });
});
