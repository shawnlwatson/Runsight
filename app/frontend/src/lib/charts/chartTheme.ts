// Data-series colors are independent of the neutral page surfaces and text.
export const chartColors = Array.from({ length: 10 }, (_, index) => `var(--color-chart-${index + 1})`);
export const chartDashes = [undefined, "7 3", "2 3", "9 3 2 3", "12 4", "4 2", "10 2 2 2", "1 3", "8 4", "5 2 1 2"];
