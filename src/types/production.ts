export type Production = {
  type: string;
  name: string;
  description: string;
  display: {
    image: string | null;
    svg: string | null;
  };
  color: string;
};
