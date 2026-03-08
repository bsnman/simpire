export type HexLayout = 'pointy' | 'flat';

export type HexCoord = {
  q: number;
  r: number;
};

export type HexKey = `${number},${number}`;

export const toHexKey = (q: number, r: number): HexKey => `${q},${r}`;

export const fromHexKey = (key: HexKey): HexCoord => {
  const [qText, rText] = key.split(',');
  return {
    q: Number(qText),
    r: Number(rText),
  };
};
