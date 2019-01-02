import {
  indexAvailability, computeAvailability,
} from '../src/availability';

const availabilityRecord = (roomTypeId, date, quantity, restrictions) => ({
  roomTypeId,
  date,
  quantity,
  restrictions,
});

describe('availability', () => {
  describe('indexAvailability', () => {
    let availability;

    beforeEach(() => {
      availability = [
        availabilityRecord('rtb', '2018-01-01', 3),
        availabilityRecord('rtb', '2018-01-02', 2),
        availabilityRecord('rtb', '2018-01-03', 3),
        availabilityRecord('rtb', '2018-01-04', 4),
        availabilityRecord('rtb', '2018-01-05', 1),
        availabilityRecord('rta', '2018-01-01', 3),
        availabilityRecord('rta', '2018-01-02', 2),
        availabilityRecord('rta', '2018-01-03', 3),
        availabilityRecord('rta', '2018-01-04', 4),
      ];
    });

    it('should index by roomType and date', () => {
      const indexed = indexAvailability(availability);
      expect(indexed).toHaveProperty('rta');
      expect(indexed).toHaveProperty('rtb');
      expect(indexed.rta).toHaveProperty('2018-01-01');
      expect(indexed.rta).toHaveProperty('2018-01-02');
      expect(indexed.rta).toHaveProperty('2018-01-03');
      expect(indexed.rta).toHaveProperty('2018-01-04');
      expect(indexed.rtb).toHaveProperty('2018-01-01');
      expect(indexed.rtb).toHaveProperty('2018-01-02');
      expect(indexed.rtb).toHaveProperty('2018-01-03');
      expect(indexed.rtb).toHaveProperty('2018-01-04');
      expect(indexed.rtb).toHaveProperty('2018-01-05');
      expect(Object.keys(indexed.rta).length).toBe(4);
      expect(Object.keys(indexed.rtb).length).toBe(5);
    });
  });

  describe('computeAvailability', () => {
    let arrivalDate;
    let departureDate;
    let roomTypes;
    let availability;
    let indexedAvailability;

    beforeEach(() => {
      arrivalDate = '2018-01-03';
      departureDate = '2018-01-05';
      availability = [
        availabilityRecord('rtb', '2018-01-03', 3),
        availabilityRecord('rtb', '2018-01-04', 2),
        availabilityRecord('rtb', '2018-01-05', 1),
        availabilityRecord('rta', '2018-01-03', 3),
        availabilityRecord('rta', '2018-01-04', 2),
        availabilityRecord('rta', '2018-01-05', 1),
      ];
      indexedAvailability = indexAvailability(availability);
      roomTypes = [
        { id: 'rta',
          occupancy: {
            min: 1, max: 1,
          } },
        { id: 'rtb' },
        { id: 'rtc' },
      ];
    });

    it('should return availability for all roomTypes', () => {
      const availability = computeAvailability(arrivalDate, departureDate, 1, roomTypes, indexedAvailability);
      console.log(availability);
      expect(availability.length).toBe(3);
    });

    it('should return the lowest quantity available during the stay', () => {
      const availability = computeAvailability(arrivalDate, departureDate, 1, roomTypes, indexedAvailability);
      expect(availability.find((a) => a.roomTypeId === 'rta')).toHaveProperty('roomTypeId', 'rta');
      expect(availability.find((a) => a.roomTypeId === 'rta')).toHaveProperty('quantity', 1);
    });

    it('should return undefined if availability for given roomType is unknown', () => {
      const availability = computeAvailability(arrivalDate, departureDate, 1, roomTypes, indexedAvailability);
      expect(availability.find((a) => a.roomTypeId === 'rtc')).toHaveProperty('roomTypeId', 'rtc');
      expect(availability.find((a) => a.roomTypeId === 'rtc')).toHaveProperty('quantity', undefined);
    });

    it('should return undefined if availability is unknown for at least one day of the stay', () => {
      const availability = computeAvailability(arrivalDate, departureDate, 1, roomTypes, indexAvailability([
        availabilityRecord('rtb', '2018-01-03', 3),
        availabilityRecord('rtb', '2018-01-05', 1),
      ]));
      expect(availability.find((a) => a.roomTypeId === 'rtb')).toHaveProperty('roomTypeId', 'rtb');
      expect(availability.find((a) => a.roomTypeId === 'rtb')).toHaveProperty('quantity', undefined);
    });

    it('should return 0 if room is unavailable for at least one day during the stay', () => {
      const availability = computeAvailability(arrivalDate, departureDate, 1, roomTypes, indexAvailability([
        availabilityRecord('rtb', '2018-01-03', 3),
        availabilityRecord('rtb', '2018-01-04', 0),
        availabilityRecord('rtb', '2018-01-05', 1),
      ]));
      expect(availability.find((a) => a.roomTypeId === 'rtb')).toHaveProperty('roomTypeId', 'rtb');
      expect(availability.find((a) => a.roomTypeId === 'rtb')).toHaveProperty('quantity', 0);
    });

    it('should not return 0 if room is unavailable for the day of departure', () => {
      const availability = computeAvailability(arrivalDate, departureDate, 1, roomTypes, indexAvailability([
        availabilityRecord('rtb', '2018-01-03', 3),
        availabilityRecord('rtb', '2018-01-04', 1),
        availabilityRecord('rtb', '2018-01-05', 0),
      ]));
      expect(availability.find((a) => a.roomTypeId === 'rtb')).toHaveProperty('roomTypeId', 'rtb');
      expect(availability.find((a) => a.roomTypeId === 'rtb')).toHaveProperty('quantity', 1);
    });

    it('should return undefined if availability is unknown for the day of departure', () => {
      const availability = computeAvailability(arrivalDate, departureDate, 1, roomTypes, indexAvailability([
        availabilityRecord('rtb', '2018-01-03', 3),
        availabilityRecord('rtb', '2018-01-04', 1),
      ]));
      expect(availability.find((a) => a.roomTypeId === 'rtb')).toHaveProperty('roomTypeId', 'rtb');
      expect(availability.find((a) => a.roomTypeId === 'rtb')).toHaveProperty('quantity', undefined);
    });

    it('should return 0 if number of guests is bigger than max occupancy', () => {
      const availability = computeAvailability(arrivalDate, departureDate, 3, [
        { id: 'rta',
          occupancy: {
            max: 2,
          },
        },
      ], indexedAvailability);
      expect(availability.find((a) => a.roomTypeId === 'rta')).toHaveProperty('roomTypeId', 'rta');
      expect(availability.find((a) => a.roomTypeId === 'rta')).toHaveProperty('quantity', 0);
    });

    it('should return 0 if number of guests is lower than min occupancy', () => {
      const availability = computeAvailability(arrivalDate, departureDate, 1, [
        { id: 'rta',
          occupancy: {
            min: 2,
          },
        },
      ], indexedAvailability);
      expect(availability.find((a) => a.roomTypeId === 'rta')).toHaveProperty('roomTypeId', 'rta');
      expect(availability.find((a) => a.roomTypeId === 'rta')).toHaveProperty('quantity', 0);
    });

    it('should apply noArrival restriction', () => {
      const availability = computeAvailability(arrivalDate, departureDate, 1, roomTypes, indexAvailability([
        availabilityRecord('rtb', '2018-01-03', 3, { noArrival: true }),
        availabilityRecord('rtb', '2018-01-04', 1),
        availabilityRecord('rtb', '2018-01-05', 0),
      ]));
      expect(availability.find((a) => a.roomTypeId === 'rtb')).toHaveProperty('roomTypeId', 'rtb');
      expect(availability.find((a) => a.roomTypeId === 'rtb')).toHaveProperty('quantity', 0);
    });

    it('should apply noDeparture restriction', () => {
      const availability = computeAvailability(arrivalDate, departureDate, 1, roomTypes, indexAvailability([
        availabilityRecord('rtb', '2018-01-03', 3),
        availabilityRecord('rtb', '2018-01-04', 1),
        availabilityRecord('rtb', '2018-01-05', 0, { noDeparture: true }),
      ]));
      expect(availability.find((a) => a.roomTypeId === 'rtb')).toHaveProperty('roomTypeId', 'rtb');
      expect(availability.find((a) => a.roomTypeId === 'rtb')).toHaveProperty('quantity', 0);
    });
  });
});
