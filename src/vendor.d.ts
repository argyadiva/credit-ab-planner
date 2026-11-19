declare module 'jstat' {
  export const jStat: {
    normal: {
      cdf(x: number, mean: number, sd: number): number;
      inv(p: number, mean: number, sd: number): number;
    };
  };
}
