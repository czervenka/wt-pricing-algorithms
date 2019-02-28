# Winding Tree Pricing algorithms

Javascript implementation of pricing algorithms based on data stored in Winding Tree platform.

## Installation and usage

```sh
npm install @windingtree/wt-pricing-algorithms
```

```js
import {
  prices, availability, cancellationFees
} from '@windingtree/wt-pricing-algorithms';
```

```html
<script type="text/javascript" src="https://unpkg.com/@windingtree/wt-pricing-algorithms"></script>
<script type="text/javascript">
// Price
const pc = new window.wtPricingAlgorithms.prices.PriceComputer(
  hotelDataFromApi.roomTypes,
  hotelDataFromApi.ratePlans,
  hotelDataFromApi.currency
);
resultingPrice = pc.getBestPrice(
  new Date(), // Booking date
  arrival,
  departure,
  guests,
  hotelDataFromApi.currency,
  roomType
);

// Availability
const indexedAvailability = window.wtPricingAlgorithms.availability.indexAvailability(
  hotelDataFromApi.availability.roomTypes
 );
const roomAvailability = window.wtPricingAlgorithms.availability.computeAvailability(
  arrival,
  departure,
  guests.length,
  hotelDataFromApi.roomTypes,
  indexedAvailability
);

// Cancellation fees
const cancellationFees = window.wtPricingAlgorithms.cancellationFees.computeCancellationFees(
  new Date(),
  dayjs(arrivalDateInput.value),
  hotelDataFromApi.cancellationPolicies,
  hotelDataFromApi.defaultCancellationAmount
);
</script>
```

## Development

```sh
git clone https://github.com/windingtree/wt-pricing-algorithms
nvm install
npm install
npm test
```
